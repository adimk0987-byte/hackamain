import os
import re
import math
import time
import uuid
import json
import random
import secrets
import hashlib
import logging
from pathlib import Path
from collections import defaultdict, deque
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

import asyncio
import httpx
import requests
from dotenv import load_dotenv
from cryptography.fernet import Fernet
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, Query, UploadFile, File, Form
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, field_validator

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

client = AsyncIOMotorClient(os.environ['MONGO_URL'])
db = client[os.environ['DB_NAME']]
fernet = Fernet(os.environ['FACE_ENC_KEY'].encode())
SESSION_MINUTES = int(os.environ['SESSION_MINUTES'])
FACE_THRESHOLD = float(os.environ['FACE_MATCH_THRESHOLD'])
DEMO_MODE = os.environ['DEMO_MODE'].lower() == 'true'
OWNER_EMAIL = os.environ['OWNER_EMAIL'].lower()

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("trustid")

app = FastAPI(title="TrustID API")
api = APIRouter(prefix="/api")

ROLES = ["citizen", "business", "government"]
CLAIMS = {
    "full_name": "Full name",
    "age_over_18": "Age 18+ eligibility",
    "identity_verified": "Identity verification status",
    "city": "City of residence",
    "trust_id": "TrustID reference",
    "email": "Email address",
    "documents_on_file": "Document types on file (no contents)",
}
DOC_TYPES = {"aadhaar": "Aadhaar Card", "pan": "PAN Card", "voter_id": "Voter ID", "driving_licence": "Driving Licence",
             "passport": "Passport", "other": "Other"}
DOC_MAGIC = {"image/jpeg": b"\xff\xd8\xff", "image/png": b"\x89PNG", "image/webp": b"RIFF", "application/pdf": b"%PDF"}
MAX_DOC_BYTES = 5 * 1024 * 1024
doc_fernet = Fernet(os.environ['DOC_ENC_KEY'].encode())
APP_NAME = os.environ['APP_NAME']
STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
_storage_key = None


def init_storage(force=False):
    global _storage_key
    if _storage_key and not force:
        return _storage_key
    r = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": os.environ['EMERGENT_LLM_KEY']}, timeout=30)
    r.raise_for_status()
    _storage_key = r.json()["storage_key"]
    return _storage_key


def put_object(path, data, content_type):
    for attempt in (0, 1):
        r = requests.put(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": init_storage(force=attempt == 1), "Content-Type": content_type},
                         data=data, timeout=120)
        if r.status_code == 404 and attempt == 0:
            continue
        r.raise_for_status()
        return r.json()


def get_object(path):
    for attempt in (0, 1):
        r = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": init_storage(force=attempt == 1)}, timeout=60)
        if r.status_code == 404 and attempt == 0:
            continue
        r.raise_for_status()
        return r.content
EXPIRY = {"5m": 5, "1h": 60, "24h": 1440, "7d": 10080}
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
DEMO_ORG_ID = "org_demo_northwind"


# ---------- helpers ----------
def now():
    return datetime.now(timezone.utc)


def iso(dt):
    return dt.isoformat()


def uid(prefix):
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def sha(v: str) -> str:
    return hashlib.sha256(v.encode()).hexdigest()


def err(status: int, code: str, message: str):
    raise HTTPException(status_code=status, detail={"code": code, "message": message})


def parse_dt(v):
    dt = datetime.fromisoformat(v) if isinstance(v, str) else v
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt


_rate = defaultdict(deque)


def rate_limit(key: str, limit: int, window: int):
    t = time.time()
    q = _rate[key]
    while q and q[0] < t - window:
        q.popleft()
    if len(q) >= limit:
        err(429, "RATE_LIMITED", "Too many attempts. Please wait a few minutes and try again.")
    q.append(t)


def client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    return (fwd.split(",")[0].strip() if fwd else (request.client.host if request.client else "unknown"))


async def audit(event: str, *, actor=None, org_id=None, subject_id=None, case_id=None, qr_id=None,
                decision=None, detail="", severity="info", request: Request = None):
    await db.audit_events.insert_one({
        "id": uid("evt"), "event": event, "actor_id": actor["user_id"] if actor else None,
        "actor_name": actor["name"] if actor else "Anonymous", "org_id": org_id, "subject_id": subject_id,
        "case_id": case_id, "qr_id": qr_id, "decision": decision, "detail": detail[:300], "severity": severity,
        "ip_hash": sha(client_ip(request))[:12] if request else None, "ts": iso(now()),
    })


def validate_descriptor(v: List[float]):
    if len(v) != 128 or not all(isinstance(x, (int, float)) and math.isfinite(x) and abs(x) < 10 for x in v):
        raise ValueError("Invalid face template")
    return v


def distance(a, b):
    return math.sqrt(sum((x - y) ** 2 for x, y in zip(a, b)))


async def best_face_match(descriptor, exclude_user=None):
    best, best_d = None, 99.0
    async for t in db.face_templates.find({}, {"_id": 0}):
        if t["user_id"] == exclude_user:
            continue
        vec = json.loads(fernet.decrypt(t["enc"].encode()).decode())
        d = distance(descriptor, vec)
        if d < best_d:
            best, best_d = t["user_id"], d
    return best, best_d


def public_user(u):
    return {k: u.get(k) for k in ["user_id", "email", "name", "picture", "roles", "org_id", "face_enrolled", "auth_method", "created_at"]}


async def make_profile(user_id, name, email):
    await db.profiles.insert_one({
        "user_id": user_id, "full_name": name, "display_name": name, "email": email, "dob": None, "city": None,
        "trust_id": f"TID-{secrets.token_hex(4).upper()}", "created_at": iso(now()),
    })


def age_of(dob):
    if not dob:
        return None
    d = datetime.fromisoformat(dob).date()
    t = now().date()
    return t.year - d.year - ((t.month, t.day) < (d.month, d.day))


async def derive_claims(profile, claims):
    age = age_of(profile.get("dob"))
    face = await db.face_templates.find_one({"user_id": profile["user_id"]}, {"_id": 1})
    types = await db.documents.distinct("doc_type", {"user_id": profile["user_id"], "is_deleted": False})
    vals = {
        "full_name": profile["full_name"], "age_over_18": (age >= 18) if age is not None else "not provided",
        "identity_verified": bool(face), "city": profile.get("city") or "not provided",
        "trust_id": profile["trust_id"], "email": profile["email"],
        "documents_on_file": ", ".join(DOC_TYPES[t] for t in types) or "none",
    }
    return {c: vals[c] for c in claims if c in vals}


def qr_status(q):
    if q["status"] == "revoked":
        return "revoked"
    if q["uses"] >= q["max_uses"]:
        return "completed"
    if parse_dt(q["expires_at"]) < now():
        return "expired"
    return "active"


# ---------- sessions & auth ----------
async def create_session(user, method, response: Response):
    token = secrets.token_urlsafe(32)
    exp = now() + timedelta(minutes=SESSION_MINUTES)
    await db.user_sessions.insert_one({"token_hash": sha(token), "user_id": user["user_id"], "method": method,
                                       "expires_at": iso(exp), "created_at": iso(now())})
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"auth_method": method}})
    response.set_cookie("session_token", token, httponly=True, secure=True, samesite="none", path="/",
                        max_age=SESSION_MINUTES * 60)
    return exp


async def get_user(request: Request):
    token = request.cookies.get("session_token")
    if not token:
        auth = request.headers.get("authorization", "")
        token = auth[7:] if auth.lower().startswith("bearer ") else None
    if not token:
        err(401, "NOT_AUTHENTICATED", "Please log in to continue.")
    sess = await db.user_sessions.find_one({"token_hash": sha(token)}, {"_id": 0})
    if not sess:
        err(401, "SESSION_INVALID", "Your session expired, please log in again.")
    if parse_dt(sess["expires_at"]) < now():
        await db.user_sessions.delete_one({"token_hash": sha(token)})
        err(401, "SESSION_EXPIRED", "Your session expired, please log in again.")
    user = await db.users.find_one({"user_id": sess["user_id"]}, {"_id": 0})
    if not user:
        err(401, "SESSION_INVALID", "Your session expired, please log in again.")
    user["session_expires_at"] = sess["expires_at"]
    return user


def require(role):
    async def dep(request: Request, user=Depends(get_user)):
        if role not in user.get("roles", []):
            await audit("access_denied", actor=user, decision="DENIED", severity="warn", request=request,
                        detail=f"Attempted {role}-only endpoint {request.url.path}")
            err(403, "FORBIDDEN", f"Your account does not have {role} access.")
        if role == "business" and not user.get("org_id"):
            err(403, "NO_ORG", "Your account is not linked to a business organisation.")
        return user
    return dep


# ---------- models ----------
class GoogleSessionIn(BaseModel):
    session_id: str = Field(min_length=4, max_length=500)


class FaceIn(BaseModel):
    descriptor: List[float]
    _v = field_validator("descriptor")(validate_descriptor)


class FaceRegisterIn(FaceIn):
    name: str = Field(min_length=2, max_length=60)
    email: str = Field(min_length=5, max_length=120)
    consent: bool

    @field_validator("email")
    @classmethod
    def v_email(cls, v):
        if not EMAIL_RE.match(v):
            raise ValueError("Enter a valid email address")
        return v.lower().strip()

    @field_validator("name")
    @classmethod
    def v_name(cls, v):
        v = v.strip()
        if len(v) < 2 or not re.match(r"^[\w .'-]+$", v):
            raise ValueError("Name may only contain letters, spaces, dots and hyphens")
        return v


class FaceEnrollIn(FaceIn):
    consent: bool


class DemoLoginIn(BaseModel):
    role: Literal["citizen", "business", "government"]


class ProfilePatch(BaseModel):
    display_name: Optional[str] = Field(None, min_length=2, max_length=60)
    city: Optional[str] = Field(None, min_length=2, max_length=60)
    dob: Optional[str] = None

    @field_validator("dob")
    @classmethod
    def v_dob(cls, v):
        if v is None:
            return v
        try:
            d = datetime.fromisoformat(v).date()
        except ValueError:
            raise ValueError("Date of birth must be YYYY-MM-DD")
        if d.year < 1900 or d > now().date():
            raise ValueError("Enter a realistic date of birth")
        return d.isoformat()


class DeleteIn(BaseModel):
    confirm: str


class QrIn(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    purpose: str = Field(min_length=3, max_length=120)
    description: str = Field("", max_length=500)
    claims: List[str] = Field(min_length=1)
    expiry: Literal["5m", "1h", "24h", "7d", "custom"]
    custom_minutes: Optional[int] = Field(None, ge=5, le=43200)
    max_uses: int = Field(1, ge=1, le=500)
    tags: List[str] = Field(default_factory=list, max_length=10)


class ShareIn(BaseModel):
    channel: Literal["whatsapp", "copy", "download", "native"]


class RespondIn(BaseModel):
    decision: Literal["approve", "deny"]


class NoteIn(BaseModel):
    body: str = Field(min_length=1, max_length=2000)
    tags: List[str] = Field(default_factory=list, max_length=10)


class NotePatch(BaseModel):
    body: Optional[str] = Field(None, min_length=1, max_length=2000)
    tags: Optional[List[str]] = None
    archived: Optional[bool] = None


class TaskIn(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    due_date: Optional[str] = None


class TaskPatch(BaseModel):
    done: bool


class AccessIn(BaseModel):
    reason: str = Field(min_length=10, max_length=300)


class RemarkIn(BaseModel):
    body: str = Field(min_length=2, max_length=2000)
    grant_id: str


class CaseStatusIn(BaseModel):
    status: Literal["open", "under_review", "cleared", "escalated"]
    reason: str = Field(min_length=10, max_length=300)
    grant_id: str


# ---------- auth endpoints ----------
@api.get("/")
async def root():
    return {"service": "TrustID", "status": "ok"}


@api.get("/config")
async def config():
    return {"demo_mode": DEMO_MODE, "session_minutes": SESSION_MINUTES, "face_threshold": FACE_THRESHOLD}


async def grant_owner(user):
    if user["email"].lower() == OWNER_EMAIL:
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"roles": ROLES, "org_id": DEMO_ORG_ID}})
        await db.cases.update_many({"demo": True, "ref": {"$ne": "CASE-2026-0099"}}, {"$addToSet": {"assigned_to": user["user_id"]}})


@api.post("/auth/google/session")
async def google_session(body: GoogleSessionIn, request: Request, response: Response):
    rate_limit(f"google:{client_ip(request)}", 20, 300)
    try:
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.get("https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                            headers={"X-Session-ID": body.session_id})
    except httpx.HTTPError:
        err(502, "AUTH_PROVIDER_UNAVAILABLE", "Google sign-in is temporarily unavailable. Please try again.")
    if r.status_code != 200:
        err(401, "INVALID_LOGIN", "Google sign-in could not be confirmed. Please try again.")
    data = r.json()
    email = data["email"].lower()
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user:
        user = {"user_id": uid("user"), "email": email, "name": data.get("name") or email.split("@")[0],
                "picture": data.get("picture"), "roles": ["citizen"], "org_id": None, "face_enrolled": False,
                "created_at": iso(now())}
        await db.users.insert_one(dict(user))
        await make_profile(user["user_id"], user["name"], email)
    else:
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"picture": data.get("picture")}})
    await grant_owner(user)
    user = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    exp = await create_session(user, "google", response)
    await audit("login_success", actor=user, decision="ALLOWED", detail="Google sign-in", request=request)
    return {"user": public_user(user), "session_expires_at": iso(exp)}


@api.post("/auth/face/register")
async def face_register(body: FaceRegisterIn, request: Request):
    rate_limit(f"facereg:{client_ip(request)}", 10, 600)
    if not body.consent:
        err(400, "CONSENT_REQUIRED", "You must accept the biometric processing notice to register.")
    if await db.users.find_one({"email": body.email}):
        err(409, "EMAIL_TAKEN", "An account with this email already exists. Please log in instead.")
    match, d = await best_face_match(body.descriptor)
    if match and d < FACE_THRESHOLD:
        await audit("face_register_duplicate", decision="DENIED", severity="warn", request=request, detail="Duplicate face blocked")
        err(409, "DUPLICATE_FACE", "This face is already registered to another account. Please log in instead.")
    user = {"user_id": uid("user"), "email": body.email, "name": body.name, "picture": None, "roles": ["citizen"],
            "org_id": None, "face_enrolled": True, "created_at": iso(now())}
    await db.users.insert_one(dict(user))
    await db.face_templates.insert_one({"user_id": user["user_id"], "enc": fernet.encrypt(json.dumps(body.descriptor).encode()).decode(),
                                        "consent_at": iso(now()), "created_at": iso(now())})
    await make_profile(user["user_id"], body.name, body.email)
    await grant_owner(user)
    await audit("face_registered", actor=user, decision="ALLOWED", request=request, detail="Account created with FaceGate")
    return {"ok": True, "message": "Registration complete. You can now log in with your face."}


@api.post("/auth/face/login")
async def face_login(body: FaceIn, request: Request, response: Response):
    rate_limit(f"facelogin:{client_ip(request)}", 10, 300)
    match, d = await best_face_match(body.descriptor)
    if not match or d >= FACE_THRESHOLD:
        await audit("face_login_failed", decision="DENIED", severity="warn", request=request, detail="Face not recognized")
        err(401, "FACE_NOT_RECOGNIZED", "Face not recognized. Please register first.")
    user = await db.users.find_one({"user_id": match}, {"_id": 0})
    exp = await create_session(user, "face", response)
    await audit("login_success", actor=user, decision="ALLOWED", request=request, detail=f"FaceGate match (distance {d:.3f})")
    return {"user": public_user(user), "session_expires_at": iso(exp), "distance": round(d, 3)}


@api.post("/auth/demo-login")
async def demo_login(body: DemoLoginIn, request: Request, response: Response):
    if not DEMO_MODE:
        err(404, "NOT_FOUND", "Not found.")
    rate_limit(f"demo:{client_ip(request)}", 30, 300)
    user = await db.users.find_one({"email": f"demo.{body.role}@trustid.demo"}, {"_id": 0})
    exp = await create_session(user, "demo", response)
    await audit("login_success", actor=user, decision="ALLOWED", request=request, detail="Demo account sign-in")
    return {"user": public_user(user), "session_expires_at": iso(exp)}


@api.get("/auth/me")
async def me(user=Depends(get_user)):
    return {"user": public_user(user), "session_expires_at": user["session_expires_at"]}


@api.post("/auth/logout")
async def logout(request: Request, response: Response):
    token = request.cookies.get("session_token")
    if token:
        await db.user_sessions.delete_one({"token_hash": sha(token)})
    response.delete_cookie("session_token", path="/", secure=True, samesite="none")
    return {"ok": True}


# ---------- account / face management ----------
@api.post("/me/face")
async def enroll_face(body: FaceEnrollIn, request: Request, user=Depends(get_user)):
    rate_limit(f"enroll:{user['user_id']}", 10, 600)
    if not body.consent:
        err(400, "CONSENT_REQUIRED", "You must accept the biometric processing notice.")
    match, d = await best_face_match(body.descriptor, exclude_user=user["user_id"])
    if match and d < FACE_THRESHOLD:
        await audit("face_enroll_duplicate", actor=user, decision="DENIED", severity="warn", request=request)
        err(409, "DUPLICATE_FACE", "This face is already registered to another account.")
    await db.face_templates.update_one({"user_id": user["user_id"]}, {"$set": {
        "enc": fernet.encrypt(json.dumps(body.descriptor).encode()).decode(), "consent_at": iso(now()), "created_at": iso(now())}}, upsert=True)
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"face_enrolled": True}})
    await audit("face_enrolled", actor=user, decision="ALLOWED", request=request)
    return {"ok": True}


@api.delete("/me/face")
async def delete_face(request: Request, user=Depends(get_user)):
    await db.face_templates.delete_one({"user_id": user["user_id"]})
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"face_enrolled": False}})
    await audit("face_template_deleted", actor=user, request=request)
    return {"ok": True}


@api.post("/me/delete")
async def delete_account(body: DeleteIn, request: Request, response: Response, user=Depends(get_user)):
    if body.confirm != "DELETE":
        err(400, "CONFIRMATION_REQUIRED", "Type DELETE to confirm account deletion.")
    if user["email"].endswith("@trustid.demo"):
        err(403, "DEMO_ACCOUNT", "Demo accounts cannot be deleted.")
    uidv = user["user_id"]
    await db.face_templates.delete_one({"user_id": uidv})
    await db.profiles.delete_one({"user_id": uidv})
    await db.documents.update_many({"user_id": uidv}, {"$set": {"is_deleted": True, "deleted_at": iso(now())}})
    await db.user_sessions.delete_many({"user_id": uidv})
    await db.verification_sessions.update_many({"citizen_id": uidv}, {"$set": {"released_claims": {}, "citizen_id": None, "status": "subject_deleted"}})
    await db.users.delete_one({"user_id": uidv})
    await audit("account_deleted", decision="ALLOWED", request=request, detail="User deleted account and biometric template")
    response.delete_cookie("session_token", path="/", secure=True, samesite="none")
    return {"ok": True}


# ---------- vault (citizen) ----------
@api.get("/vault/overview")
async def vault_overview(user=Depends(require("citizen"))):
    profile = await db.profiles.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not profile:
        await make_profile(user["user_id"], user["name"], user["email"])
        profile = await db.profiles.find_one({"user_id": user["user_id"]}, {"_id": 0})
    sessions = await db.verification_sessions.find({"citizen_id": user["user_id"]}, {"_id": 0}).to_list(500)
    activity = await db.audit_events.find({"$or": [{"actor_id": user["user_id"]}, {"subject_id": user["user_id"]}]}, {"_id": 0}).sort("ts", -1).to_list(8)
    face = await db.face_templates.find_one({"user_id": user["user_id"]}, {"_id": 0, "consent_at": 1})
    docs = await db.documents.find({"user_id": user["user_id"], "is_deleted": False}, {"_id": 0, "storage_path": 0}).sort("created_at", -1).to_list(100)
    profile.pop("credentials", None)
    profile["identity_status"] = "face_verified" if face else "unverified"
    return {
        "profile": profile, "face_enrolled": bool(face), "face_consent_at": face["consent_at"] if face else None,
        "documents": docs, "doc_types": DOC_TYPES,
        "stats": {"documents": len(docs),
                  "verifications": sum(1 for s in sessions if s["decision"] == "ALLOWED"),
                  "active_shares": sum(1 for s in sessions if s["decision"] == "ALLOWED" and s["status"] == "active")},
        "activity": activity, "session_expires_at": user["session_expires_at"], "auth_method": user.get("auth_method"),
    }


@api.patch("/vault/profile")
async def update_profile(body: ProfilePatch, request: Request, user=Depends(require("citizen"))):
    upd = {k: v.strip() for k, v in body.model_dump().items() if v is not None}
    if not upd:
        err(400, "NOTHING_TO_UPDATE", "No changes provided.")
    await db.profiles.update_one({"user_id": user["user_id"]}, {"$set": upd})
    await audit("profile_updated", actor=user, subject_id=user["user_id"], request=request, detail=", ".join(upd))
    return await db.profiles.find_one({"user_id": user["user_id"]}, {"_id": 0, "credentials": 0})


@api.get("/vault/documents")
async def list_documents(user=Depends(require("citizen"))):
    docs = await db.documents.find({"user_id": user["user_id"], "is_deleted": False}, {"_id": 0, "storage_path": 0}).sort("created_at", -1).to_list(100)
    return {"items": docs, "doc_types": DOC_TYPES}


@api.post("/vault/documents")
async def upload_document(request: Request, file: UploadFile = File(...), doc_type: str = Form(...), title: str = Form(""),
                          user=Depends(require("citizen"))):
    rate_limit(f"docup:{user['user_id']}", 20, 600)
    if not await db.face_templates.find_one({"user_id": user["user_id"]}, {"_id": 1}):
        err(403, "FACE_REQUIRED", "Enrol FaceGate first so your documents are linked to your face.")
    if doc_type not in DOC_TYPES:
        err(400, "VALIDATION_ERROR", "Choose a valid document type.")
    ct = file.content_type
    if ct not in DOC_MAGIC:
        err(415, "UNSUPPORTED_FILE", "Upload a JPG, PNG, WEBP or PDF file.")
    data = await file.read(MAX_DOC_BYTES + 1)
    if len(data) > MAX_DOC_BYTES:
        err(413, "FILE_TOO_LARGE", "Files must be 5 MB or smaller.")
    if len(data) < 100 or not data.startswith(DOC_MAGIC[ct]):
        err(415, "UNSUPPORTED_FILE", "The file content does not match its type or is empty.")
    if await db.documents.count_documents({"user_id": user["user_id"], "is_deleted": False}) >= 50:
        err(400, "LIMIT_REACHED", "You can store up to 50 documents.")
    path = f"{APP_NAME}/docs/{user['user_id']}/{uuid.uuid4().hex}.enc"
    try:
        res = await asyncio.to_thread(put_object, path, doc_fernet.encrypt(data), "application/octet-stream")
    except Exception:
        logger.exception("document upload failed")
        err(502, "STORAGE_UNAVAILABLE", "Document storage is temporarily unavailable. Please try again.")
    name = re.sub(r"[^\w .()-]", "_", (file.filename or "document"))[:100]
    doc = {"id": uid("doc"), "user_id": user["user_id"], "doc_type": doc_type, "type_label": DOC_TYPES[doc_type],
           "title": (title.strip()[:80] or DOC_TYPES[doc_type]), "original_filename": name, "content_type": ct, "size": len(data),
           "sha256": hashlib.sha256(data).hexdigest(), "storage_path": res["path"], "status": "uploaded", "is_deleted": False,
           "created_at": iso(now())}
    await db.documents.insert_one(dict(doc))
    await audit("document_uploaded", actor=user, subject_id=user["user_id"], request=request, detail=f"{DOC_TYPES[doc_type]} added to vault")
    doc.pop("storage_path")
    return doc


@api.get("/vault/documents/{did}/file")
async def document_file(did: str, request: Request, user=Depends(require("citizen"))):
    doc = await db.documents.find_one({"id": did, "user_id": user["user_id"], "is_deleted": False}, {"_id": 0})
    if not doc:
        err(404, "NOT_FOUND", "Document not found.")
    try:
        blob = await asyncio.to_thread(get_object, doc["storage_path"])
        data = doc_fernet.decrypt(blob)
    except Exception:
        logger.exception("document download failed")
        err(502, "STORAGE_UNAVAILABLE", "Document storage is temporarily unavailable. Please try again.")
    return Response(content=data, media_type=doc["content_type"], headers={"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
                                                                         "Content-Disposition": f"inline; filename=\"{doc['original_filename']}\""})


@api.delete("/vault/documents/{did}")
async def delete_document(did: str, request: Request, user=Depends(require("citizen"))):
    res = await db.documents.update_one({"id": did, "user_id": user["user_id"], "is_deleted": False}, {"$set": {"is_deleted": True, "deleted_at": iso(now())}})
    if not res.matched_count:
        err(404, "NOT_FOUND", "Document not found.")
    await audit("document_deleted", actor=user, subject_id=user["user_id"], request=request, detail="Document removed from vault")
    return {"ok": True}


@api.get("/vault/consents")
async def vault_consents(user=Depends(require("citizen"))):
    rows = await db.verification_sessions.find({"citizen_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {"items": rows}


@api.post("/vault/consents/{sid}/revoke")
async def revoke_consent(sid: str, request: Request, user=Depends(require("citizen"))):
    res = await db.verification_sessions.update_one({"id": sid, "citizen_id": user["user_id"], "status": "active", "decision": "ALLOWED"},
                                                    {"$set": {"status": "revoked", "revoked_at": iso(now())}})
    if not res.matched_count:
        err(404, "NOT_FOUND", "Active consent not found.")
    s = await db.verification_sessions.find_one({"id": sid}, {"_id": 0})
    await audit("consent_revoked", actor=user, org_id=s["org_id"], qr_id=s["qr_id"], subject_id=user["user_id"], request=request,
                detail=f"Consent revoked for {s['org_name']}")
    return {"ok": True}


# ---------- nexus (business) ----------
async def get_org(org_id):
    return await db.orgs.find_one({"id": org_id}, {"_id": 0})


async def own_qr(qid, user):
    q = await db.qrs.find_one({"id": qid, "org_id": user["org_id"]}, {"_id": 0})
    if not q:
        err(404, "NOT_FOUND", "QR code not found.")
    return q


def qr_out(q, include_token=False):
    out = {k: v for k, v in q.items() if k not in ("token_hash", "token_enc")}
    out["status"] = qr_status(q)
    if include_token:
        out["token"] = fernet.decrypt(q["token_enc"].encode()).decode()
    return out


@api.get("/nexus/meta")
async def nexus_meta(user=Depends(require("business"))):
    org = await get_org(user["org_id"])
    return {"org": org, "claims": CLAIMS}


@api.get("/nexus/stats")
async def nexus_stats(user=Depends(require("business"))):
    qrs = await db.qrs.find({"org_id": user["org_id"]}, {"_id": 0}).to_list(5000)
    st = [qr_status(q) for q in qrs]
    sessions = await db.verification_sessions.find({"org_id": user["org_id"]}, {"_id": 0}).to_list(5000)
    rejected_events = await db.audit_events.count_documents({"org_id": user["org_id"], "event": "qr_redeem_rejected"})
    days = [(now() - timedelta(days=i)).date().isoformat() for i in range(6, -1, -1)]
    series = [{"day": d[5:], "completed": sum(1 for s in sessions if s["created_at"][:10] == d and s["decision"] == "ALLOWED"),
               "rejected": sum(1 for s in sessions if s["created_at"][:10] == d and s["decision"] != "ALLOWED")} for d in days]
    recent = await db.audit_events.find({"org_id": user["org_id"]}, {"_id": 0}).sort("ts", -1).to_list(8)
    completed = sum(1 for s in sessions if s["decision"] == "ALLOWED")
    return {"total": len(qrs), "active": st.count("active"), "expired": st.count("expired"), "revoked": st.count("revoked"),
            "completed_qrs": st.count("completed"), "attempts": len(sessions) + rejected_events, "completed": completed,
            "rejected": len(sessions) - completed + rejected_events, "series": series, "recent": recent}


@api.get("/nexus/qrs")
async def list_qrs(q: str = "", status: str = "all", page: int = Query(1, ge=1), page_size: int = Query(10, ge=1, le=50),
                   user=Depends(require("business"))):
    rows = [qr_out(x) for x in await db.qrs.find({"org_id": user["org_id"]}, {"_id": 0}).sort("created_at", -1).to_list(5000)]
    if q:
        ql = q.lower()
        rows = [r for r in rows if ql in r["name"].lower() or ql in r["purpose"].lower() or any(ql in t.lower() for t in r["tags"])]
    if status != "all":
        rows = [r for r in rows if r["status"] == status]
    total = len(rows)
    return {"items": rows[(page - 1) * page_size: page * page_size], "total": total, "page": page, "pages": max(1, math.ceil(total / page_size))}


@api.post("/nexus/qrs")
async def create_qr(body: QrIn, request: Request, user=Depends(require("business"))):
    org = await get_org(user["org_id"])
    unknown = [c for c in body.claims if c not in CLAIMS]
    if unknown:
        err(400, "INVALID_CLAIM", "One or more requested claims are not supported.")
    allowed = [c for c in dict.fromkeys(body.claims) if c in org["allowed_claims"]]
    reduced = [c for c in body.claims if c not in org["allowed_claims"]]
    if not allowed:
        await audit("policy_denied", actor=user, org_id=org["id"], decision="DENIED", severity="warn", request=request,
                    detail="QR requested only claims outside organisation policy")
        err(403, "POLICY_DENIED", "None of the requested claims are permitted for your organisation.")
    if body.expiry == "custom" and not body.custom_minutes:
        err(400, "VALIDATION_ERROR", "Enter a custom expiry in minutes.")
    minutes = body.custom_minutes if body.expiry == "custom" else EXPIRY[body.expiry]
    token = secrets.token_urlsafe(24)
    q = {"id": uid("qr"), "org_id": org["id"], "org_name": org["name"], "name": body.name.strip(), "purpose": body.purpose.strip(),
         "description": body.description.strip(), "claims": allowed, "reduced_claims": reduced, "max_uses": body.max_uses, "uses": 0,
         "tags": [t.strip()[:30] for t in body.tags if t.strip()], "status": "active", "created_by": user["name"],
         "created_at": iso(now()), "expires_at": iso(now() + timedelta(minutes=minutes)),
         "token_hash": sha(token), "token_enc": fernet.encrypt(token.encode()).decode()}
    await db.qrs.insert_one(dict(q))
    await audit("qr_created", actor=user, org_id=org["id"], qr_id=q["id"], decision="ALLOWED" if not reduced else "REDUCED", request=request,
                detail=f"QR '{q['name']}' created" + (f"; claims removed by policy: {', '.join(reduced)}" if reduced else ""))
    return qr_out(q, include_token=True)


@api.get("/nexus/qrs/{qid}")
async def get_qr(qid: str, user=Depends(require("business"))):
    q = await own_qr(qid, user)
    sessions = await db.verification_sessions.find({"qr_id": qid, "org_id": user["org_id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)
    for s in sessions:
        if s["status"] != "active":
            s["released_claims"] = {}
    history = await db.audit_events.find({"qr_id": qid, "org_id": user["org_id"]}, {"_id": 0}).sort("ts", -1).to_list(50)
    return {"qr": qr_out(q, include_token=True), "sessions": sessions, "history": history}


@api.post("/nexus/qrs/{qid}/revoke")
async def revoke_qr(qid: str, request: Request, user=Depends(require("business"))):
    q = await own_qr(qid, user)
    if q["status"] == "revoked":
        err(400, "ALREADY_REVOKED", "This QR code is already revoked.")
    await db.qrs.update_one({"id": qid}, {"$set": {"status": "revoked", "revoked_at": iso(now())}})
    await audit("qr_revoked", actor=user, org_id=user["org_id"], qr_id=qid, request=request, detail=f"QR '{q['name']}' revoked")
    return {"ok": True}


@api.post("/nexus/qrs/{qid}/share-event")
async def share_event(qid: str, body: ShareIn, request: Request, user=Depends(require("business"))):
    await own_qr(qid, user)
    await audit("qr_shared", actor=user, org_id=user["org_id"], qr_id=qid, request=request, detail=f"Shared via {body.channel}")
    return {"ok": True}


@api.get("/nexus/qrs/{qid}/notes")
async def list_notes(qid: str, q: str = "", tag: str = "", archived: bool = False, user=Depends(require("business"))):
    await own_qr(qid, user)
    flt = {"qr_id": qid, "org_id": user["org_id"], "archived": archived}
    if tag:
        flt["tags"] = tag
    rows = await db.notes.find(flt, {"_id": 0}).sort("updated_at", -1).to_list(500)
    if q:
        rows = [r for r in rows if q.lower() in r["body"].lower()]
    tasks = await db.tasks.find({"qr_id": qid, "org_id": user["org_id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {"notes": rows, "tasks": tasks}


@api.post("/nexus/qrs/{qid}/notes")
async def add_note(qid: str, body: NoteIn, request: Request, user=Depends(require("business"))):
    await own_qr(qid, user)
    n = {"id": uid("note"), "qr_id": qid, "org_id": user["org_id"], "body": body.body.strip(), "tags": [t.strip()[:30] for t in body.tags if t.strip()],
         "archived": False, "author": user["name"], "author_id": user["user_id"], "created_at": iso(now()), "updated_at": iso(now()), "history": []}
    await db.notes.insert_one(dict(n))
    await audit("note_created", actor=user, org_id=user["org_id"], qr_id=qid, request=request, detail="Private remark added")
    return n


@api.patch("/nexus/notes/{nid}")
async def edit_note(nid: str, body: NotePatch, request: Request, user=Depends(require("business"))):
    n = await db.notes.find_one({"id": nid, "org_id": user["org_id"]}, {"_id": 0})
    if not n:
        err(404, "NOT_FOUND", "Remark not found.")
    upd = {k: v for k, v in body.model_dump().items() if v is not None}
    if not upd:
        err(400, "NOTHING_TO_UPDATE", "No changes provided.")
    upd["updated_at"] = iso(now())
    hist = {"body": n["body"], "tags": n["tags"], "archived": n["archived"], "changed_by": user["name"], "changed_at": iso(now())}
    await db.notes.update_one({"id": nid}, {"$set": upd, "$push": {"history": hist}})
    action = "note_archived" if body.archived else ("note_restored" if body.archived is False else "note_edited")
    await audit(action, actor=user, org_id=user["org_id"], qr_id=n["qr_id"], request=request, detail="Private remark changed")
    return await db.notes.find_one({"id": nid}, {"_id": 0})


@api.post("/nexus/qrs/{qid}/tasks")
async def add_task(qid: str, body: TaskIn, request: Request, user=Depends(require("business"))):
    await own_qr(qid, user)
    if body.due_date:
        try:
            datetime.fromisoformat(body.due_date)
        except ValueError:
            err(400, "VALIDATION_ERROR", "Invalid due date.")
    t = {"id": uid("task"), "qr_id": qid, "org_id": user["org_id"], "title": body.title.strip(), "due_date": body.due_date,
         "done": False, "author": user["name"], "created_at": iso(now())}
    await db.tasks.insert_one(dict(t))
    await audit("task_created", actor=user, org_id=user["org_id"], qr_id=qid, request=request, detail=f"Follow-up: {t['title'][:60]}")
    return t


@api.patch("/nexus/tasks/{tid}")
async def toggle_task(tid: str, body: TaskPatch, request: Request, user=Depends(require("business"))):
    res = await db.tasks.find_one_and_update({"id": tid, "org_id": user["org_id"]}, {"$set": {"done": body.done}}, projection={"_id": 0})
    if not res:
        err(404, "NOT_FOUND", "Task not found.")
    await audit("task_updated", actor=user, org_id=user["org_id"], qr_id=res["qr_id"], request=request, detail="Task completed" if body.done else "Task reopened")
    return {"ok": True}


# ---------- public verification + trust firewall ----------
async def find_qr_by_token(token: str):
    if not (10 <= len(token) <= 100):
        err(404, "INVALID_LINK", "This verification link is invalid.")
    q = await db.qrs.find_one({"token_hash": sha(token)}, {"_id": 0})
    if not q:
        err(404, "INVALID_LINK", "This verification link is invalid.")
    return q


@api.get("/verify/{token}")
async def verify_info(token: str, request: Request):
    rate_limit(f"vinfo:{client_ip(request)}", 60, 300)
    q = await find_qr_by_token(token)
    org = await get_org(q["org_id"])
    return {"org_name": org["name"], "org_verified": org.get("verified", False), "org_type": org.get("type"),
            "name": q["name"], "purpose": q["purpose"], "description": q["description"],
            "claims": [{"key": c, "label": CLAIMS[c]} for c in q["claims"]], "expires_at": q["expires_at"],
            "status": qr_status(q), "single_use": q["max_uses"] == 1}


def trust_firewall(q, user, org, consent: bool):
    st = qr_status(q)
    if st == "revoked":
        return "REVOKED", "This verification request was revoked by the business."
    if st == "expired":
        return "EXPIRED", "This verification request has expired."
    if st == "completed":
        return "DENIED", "This QR code has already been used the maximum number of times."
    if "citizen" not in user.get("roles", []):
        return "DENIED", "Only citizen identity holders can respond to verification requests."
    if q["org_id"] == user.get("org_id"):
        return "DENIED", "You cannot verify against your own organisation's request."
    if not set(q["claims"]).issubset(set(org["allowed_claims"])):
        return "DENIED", "Requested claims exceed the organisation's authorised scope."
    if not consent:
        return "CONSENT_REQUIRED", "You declined to share. No information was released."
    return "ALLOWED", "Verification completed. Only the listed claims were shared."


@api.post("/verify/{token}/respond")
async def verify_respond(token: str, body: RespondIn, request: Request, user=Depends(get_user)):
    rate_limit(f"vresp:{client_ip(request)}", 20, 300)
    q = await find_qr_by_token(token)
    org = await get_org(q["org_id"])
    if await db.verification_sessions.find_one({"qr_id": q["id"], "citizen_id": user["user_id"]}):
        err(409, "ALREADY_RESPONDED", "You have already responded to this verification request.")
    decision, message = trust_firewall(q, user, org, body.decision == "approve")
    if decision == "ALLOWED":
        claimed = await db.qrs.find_one_and_update(
            {"id": q["id"], "status": "active", "expires_at": {"$gt": iso(now())}, "$expr": {"$lt": ["$uses", "$max_uses"]}},
            {"$inc": {"uses": 1}}, projection={"_id": 0})
        if not claimed:
            decision, message = "DENIED", "This QR code was just used or expired. Please ask for a new one."
    released = {}
    if decision == "ALLOWED":
        profile = await db.profiles.find_one({"user_id": user["user_id"]}, {"_id": 0})
        released = await derive_claims(profile, q["claims"])
    if decision in ("ALLOWED", "CONSENT_REQUIRED"):
        await db.verification_sessions.insert_one({
            "id": uid("vs"), "qr_id": q["id"], "qr_name": q["name"], "org_id": q["org_id"], "org_name": org["name"], "purpose": q["purpose"],
            "citizen_id": user["user_id"], "citizen_label": user["name"], "requested_claims": q["claims"], "released_claims": released,
            "decision": decision, "status": "active" if decision == "ALLOWED" else "declined", "created_at": iso(now())})
    event = {"ALLOWED": "qr_redeemed", "CONSENT_REQUIRED": "qr_declined"}.get(decision, "qr_redeem_rejected")
    await audit(event, actor=user, org_id=q["org_id"], qr_id=q["id"], subject_id=user["user_id"], decision=decision,
                severity="info" if decision in ("ALLOWED", "CONSENT_REQUIRED") else "warn", request=request, detail=message)
    return {"decision": decision, "message": message, "released_claims": released,
            "claim_labels": {c: CLAIMS[c] for c in released}}


# ---------- sentinel (government) ----------
async def assigned_case(cid, user, request):
    c = await db.cases.find_one({"id": cid}, {"_id": 0})
    if not c:
        err(404, "NOT_FOUND", "Case not found.")
    if user["user_id"] not in c["assigned_to"]:
        await audit("case_access_denied", actor=user, case_id=cid, decision="DENIED", severity="high", request=request,
                    detail=f"Unassigned access attempt on {c['ref']}")
        err(403, "NOT_ASSIGNED", "You are not assigned to this case. Access is limited to assigned reviewers.")
    return c


async def check_grant(grant_id, cid, user):
    g = await db.case_grants.find_one({"id": grant_id, "case_id": cid, "user_id": user["user_id"]}, {"_id": 0})
    if not g or parse_dt(g["expires_at"]) < now():
        err(403, "ACCESS_REASON_REQUIRED", "Declare an access reason to open this case. Grants last 15 minutes.")
    return g


def case_summary(c):
    return {k: c[k] for k in ["id", "ref", "title", "status", "priority", "category", "created_at", "demo"]}


@api.get("/sentinel/stats")
async def sentinel_stats(user=Depends(require("government"))):
    cases = await db.cases.find({"assigned_to": user["user_id"]}, {"_id": 0}).to_list(1000)
    since = iso(now() - timedelta(days=7))
    alerts = await db.audit_events.count_documents({"severity": {"$in": ["warn", "high"]}, "ts": {"$gte": since}})
    return {"assigned": len(cases), "open": sum(1 for c in cases if c["status"] in ("open", "under_review")),
            "escalated": sum(1 for c in cases if c["status"] == "escalated"), "alerts_7d": alerts}


@api.get("/sentinel/cases")
async def sentinel_cases(request: Request, q: str = "", user=Depends(require("government"))):
    rows = await db.cases.find({"assigned_to": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    denied = None
    if q:
        ql = q.lower().strip()
        rows = [r for r in rows if ql in r["ref"].lower() or ql in r["title"].lower()]
        if not rows:
            other = await db.cases.find_one({"ref": q.strip().upper()}, {"_id": 0})
            if other:
                await audit("case_access_denied", actor=user, case_id=other["id"], decision="DENIED", severity="high", request=request,
                            detail=f"Search hit unassigned case {other['ref']}")
                denied = {"ref": other["ref"], "reason": "This case exists but is not assigned to you. Request assignment from your supervising officer."}
    return {"items": [case_summary(r) for r in rows], "denied": denied}


@api.post("/sentinel/cases/{cid}/access")
async def case_access(cid: str, body: AccessIn, request: Request, user=Depends(require("government"))):
    c = await assigned_case(cid, user, request)
    g = {"id": uid("grant"), "case_id": cid, "user_id": user["user_id"], "reason": body.reason.strip(),
         "created_at": iso(now()), "expires_at": iso(now() + timedelta(minutes=15))}
    await db.case_grants.insert_one(dict(g))
    await audit("case_opened", actor=user, case_id=cid, decision="ALLOWED", request=request, detail=f"{c['ref']} — purpose: {g['reason']}")
    return {"grant_id": g["id"], "expires_at": g["expires_at"]}


@api.get("/sentinel/cases/{cid}")
async def case_detail(cid: str, request: Request, grant_id: str = "", user=Depends(require("government"))):
    c = await assigned_case(cid, user, request)
    g = await check_grant(grant_id, cid, user)
    remarks = await db.case_remarks.find({"case_id": cid}, {"_id": 0}).sort("created_at", -1).to_list(200)
    history = await db.audit_events.find({"case_id": cid}, {"_id": 0}).sort("ts", -1).to_list(100)
    access_log = await db.case_grants.find({"case_id": cid}, {"_id": 0}).sort("created_at", -1).to_list(50)
    names = {u["user_id"]: u["name"] async for u in db.users.find({"user_id": {"$in": [a["user_id"] for a in access_log]}}, {"_id": 0, "user_id": 1, "name": 1})}
    for a in access_log:
        a["user_name"] = names.get(a["user_id"], "Deleted user")
    out = {k: v for k, v in c.items() if k != "assigned_to"}
    return {"case": out, "grant": g, "remarks": remarks, "history": history, "access_log": access_log}


@api.post("/sentinel/cases/{cid}/remarks")
async def case_remark(cid: str, body: RemarkIn, request: Request, user=Depends(require("government"))):
    await assigned_case(cid, user, request)
    await check_grant(body.grant_id, cid, user)
    r = {"id": uid("rmk"), "case_id": cid, "body": body.body.strip(), "author": user["name"], "created_at": iso(now())}
    await db.case_remarks.insert_one(dict(r))
    await audit("case_remark_added", actor=user, case_id=cid, request=request, detail="Case remark recorded")
    return r


@api.post("/sentinel/cases/{cid}/status")
async def case_status(cid: str, body: CaseStatusIn, request: Request, user=Depends(require("government"))):
    c = await assigned_case(cid, user, request)
    await check_grant(body.grant_id, cid, user)
    await db.cases.update_one({"id": cid}, {"$set": {"status": body.status}})
    await audit("case_status_changed", actor=user, case_id=cid, decision="ALLOWED", severity="warn" if body.status == "escalated" else "info",
                request=request, detail=f"{c['ref']}: {c['status']} → {body.status}. Reason: {body.reason.strip()}")
    return {"ok": True}


@api.get("/sentinel/alerts")
async def sentinel_alerts(user=Depends(require("government"))):
    since = iso(now() - timedelta(days=7))
    rows = await db.audit_events.find({"severity": {"$in": ["warn", "high"]}, "ts": {"$gte": since}}, {"_id": 0}).sort("ts", -1).to_list(50)
    counts = defaultdict(int)
    for r in rows:
        if r.get("ip_hash"):
            counts[r["ip_hash"]] += 1
    for r in rows:
        base = 70 if r["severity"] == "high" else 40
        r["risk"] = min(99, base + 5 * (counts.get(r.get("ip_hash"), 1) - 1))
    return {"items": rows}


# ---------- audit history ----------
@api.get("/audit")
async def audit_history(portal: Literal["citizen", "business", "government"], page: int = Query(1, ge=1),
                        event: str = "", user=Depends(get_user)):
    if portal not in user.get("roles", []):
        err(403, "FORBIDDEN", "You do not have access to this audit scope.")
    if portal == "citizen":
        flt = {"$or": [{"actor_id": user["user_id"]}, {"subject_id": user["user_id"]}]}
    elif portal == "business":
        flt = {"org_id": user["org_id"]}
    else:
        case_ids = [c["id"] async for c in db.cases.find({"assigned_to": user["user_id"]}, {"id": 1, "_id": 0})]
        flt = {"$or": [{"case_id": {"$in": case_ids}}, {"severity": {"$in": ["warn", "high"]}}]}
    if event:
        flt = {"$and": [flt, {"event": event}]}
    total = await db.audit_events.count_documents(flt)
    rows = await db.audit_events.find(flt, {"_id": 0}).sort("ts", -1).skip((page - 1) * 20).to_list(20)
    return {"items": rows, "total": total, "page": page, "pages": max(1, math.ceil(total / 20))}


# ---------- seed ----------
async def seed():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.user_sessions.create_index("token_hash", unique=True)
    await db.face_templates.create_index("user_id", unique=True)
    await db.profiles.create_index("user_id", unique=True)
    await db.qrs.create_index("token_hash", unique=True)
    await db.qrs.create_index([("org_id", 1), ("created_at", -1)])
    await db.verification_sessions.create_index([("qr_id", 1), ("citizen_id", 1)])
    await db.audit_events.create_index([("ts", -1)])
    await db.notes.create_index([("qr_id", 1), ("org_id", 1)])
    await db.cases.create_index("ref", unique=True)
    await db.documents.create_index([("user_id", 1), ("is_deleted", 1)])
    await db.orgs.update_one({"id": DEMO_ORG_ID}, {"$setOnInsert": {
        "id": DEMO_ORG_ID, "name": "Northwind Bank (Demo)", "type": "Financial services", "verified": True, "created_at": iso(now())},
        "$set": {"allowed_claims": ["full_name", "age_over_18", "identity_verified", "city", "trust_id", "documents_on_file"]}}, upsert=True)
    try:
        await asyncio.to_thread(init_storage)
    except Exception:
        logger.error("Object storage init failed")
    if not DEMO_MODE:
        return
    demo = [("citizen", "Dev Sharma (Demo Citizen)", None), ("business", "Priya Nair (Demo Business Admin)", DEMO_ORG_ID),
            ("government", "Officer R. Iyer (Demo Reviewer)", None)]
    ids = {}
    for role, name, org in demo:
        email = f"demo.{role}@trustid.demo"
        u = await db.users.find_one({"email": email}, {"_id": 0})
        if not u:
            u = {"user_id": uid("user"), "email": email, "name": name, "picture": None, "roles": [role], "org_id": org,
                 "face_enrolled": False, "created_at": iso(now())}
            await db.users.insert_one(dict(u))
            if role == "citizen":
                await make_profile(u["user_id"], "Dev Sharma", email)
        ids[role] = u["user_id"]
    if not await db.cases.find_one({"demo": True}):
        base = [("CASE-2026-0012", "Suspected duplicate identity enrolment", "Identity fraud", "high", "open"),
                ("CASE-2026-0027", "Credential status dispute — driving licence", "Credential review", "medium", "under_review"),
                ("CASE-2026-0041", "Repeated failed FaceGate logins from one network", "Security incident", "high", "escalated"),
                ("CASE-2026-0058", "Business QR over-collection complaint", "Consent complaint", "low", "open"),
                ("CASE-2026-0099", "Restricted case — other jurisdiction", "Inter-agency", "high", "open")]
        for i, (ref, title, cat, pr, stt) in enumerate(base):
            await db.cases.insert_one({
                "id": uid("case"), "ref": ref, "title": title, "category": cat, "priority": pr, "status": stt, "demo": True,
                "assigned_to": [] if ref.endswith("0099") else [ids["government"]],
                "subject": {"label": f"Synthetic Subject {chr(65 + i)}", "trust_id": f"TID-DEMO{i + 1:03d}", "city": ["Pune", "Kochi", "Jaipur", "Chennai", "Delhi"][i]},
                "claims": [{"claim": "Identity verified", "result": "match" if i % 2 == 0 else "mismatch"},
                           {"claim": "Age 18+", "result": "match"},
                           {"claim": "Face template unique", "result": "flagged" if i in (0, 2) else "match"}],
                "credentials": [{"type": "National ID (Synthetic)", "issuer": "TrustID Demo Issuer", "issuer_status": "trusted", "status": "revoked" if i == 1 else "valid"},
                                {"type": "Driving Licence (Synthetic)", "issuer": "Demo Transport Authority", "issuer_status": "trusted", "status": "valid"}],
                "summary": "Synthetic demo case for TrustID Sentinel. No real person or government system is involved.",
                "created_at": iso(now() - timedelta(days=i * 3 + 1))})
    owner = await db.users.find_one({"email": OWNER_EMAIL}, {"_id": 0})
    if owner:
        await grant_owner(owner)


@app.on_event("startup")
async def startup():
    await seed()


@app.exception_handler(RequestValidationError)
async def validation_handler(request: Request, exc: RequestValidationError):
    first = exc.errors()[0] if exc.errors() else {}
    msg = str(first.get("msg", "Invalid input")).replace("Value error, ", "")
    field = ".".join(str(x) for x in first.get("loc", [])[1:])
    return JSONResponse(status_code=422, content={"detail": {"code": "VALIDATION_ERROR", "message": f"{field}: {msg}" if field else msg}})


@app.exception_handler(Exception)
async def generic_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s", request.url.path)
    return JSONResponse(status_code=500, content={"detail": {"code": "SERVER_ERROR", "message": "Something went wrong. Please try again."}})


app.include_router(api)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=os.environ['CORS_ORIGINS'].split(','),
                   allow_methods=["*"], allow_headers=["*"])


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
