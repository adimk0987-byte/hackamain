import io
import hmac
import hashlib
import json
import os
from datetime import timedelta
from typing import List, Optional
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel, Field
from webauthn import (generate_registration_options, verify_registration_response, generate_authentication_options,
                      verify_authentication_response, options_to_json)
from webauthn.helpers import bytes_to_base64url, base64url_to_bytes
from webauthn.helpers.structs import (AuthenticatorSelectionCriteria, UserVerificationRequirement, ResidentKeyRequirement,
                                      AuthenticatorAttachment, PublicKeyCredentialDescriptor)
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.graphics.barcode import qr as rl_qr
from reportlab.graphics.shapes import Drawing
from reportlab.graphics import renderPDF

from server import (db, err, uid, iso, now, parse_dt, audit, rate_limit, client_ip, get_user, require, public_user, create_session,
                    best_face_match, derive_claims, get_org, check_liveness, LivenessIn, CLAIMS, FACE_THRESHOLD, logger)

ext = APIRouter(prefix="/api")
PROOF_SECRET = os.environ['PROOF_SECRET'].encode()
PUBLIC_APP_URL = os.environ['PUBLIC_APP_URL'].rstrip("/")
ORIGINS = [o.strip() for o in os.environ['CORS_ORIGINS'].split(",")]


# ---------- proofs ----------
def _sign(payload):
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(canonical.encode()).hexdigest(), hmac.new(PROOF_SECRET, canonical.encode(), hashlib.sha256).hexdigest()


async def make_proof(vs):
    prof = await db.profiles.find_one({"user_id": vs["citizen_id"]}, {"_id": 0, "trust_id": 1}) or {}
    payload = {"proof_id": uid("prf"), "session_id": vs["id"], "org_id": vs["org_id"], "org_name": vs["org_name"],
               "subject_ref": prof.get("trust_id"), "purpose": vs["purpose"], "claims": vs["released_claims"],
               "channel": vs.get("channel", "qr"), "issued_at": iso(now())}
    digest, sig = _sign(payload)
    return {**payload, "digest": digest, "signature": sig, "alg": "HMAC-SHA256"}


def proof_state(vs):
    p = vs.get("proof")
    payload = {k: v for k, v in p.items() if k not in ("digest", "signature", "alg")}
    digest, sig = _sign(payload)
    sig_ok = hmac.compare_digest(sig, p["signature"]) and digest == p["digest"]
    if not sig_ok:
        return "tampered", False
    if vs["status"] != "active" or vs["released_claims"] != p["claims"]:
        return "revoked", True
    return "valid", True


@ext.get("/proofs/{pid}")
async def public_proof(pid: str, request: Request):
    rate_limit(f"proof:{client_ip(request)}", 60, 300)
    vs = await db.verification_sessions.find_one({"proof.proof_id": pid}, {"_id": 0})
    if not vs:
        err(404, "NOT_FOUND", "No verification proof exists with this ID.")
    status, sig_ok = proof_state(vs)
    p = vs["proof"]
    ref = p.get("subject_ref") or ""
    return {"proof_id": pid, "status": status, "signature_valid": sig_ok, "issuer": "TrustID Trust Firewall", "org_name": p["org_name"],
            "purpose": p["purpose"], "channel": p["channel"], "issued_at": p["issued_at"], "subject_ref": ref[:6] + "••••" if ref else None,
            "claims": [CLAIMS.get(c, c) for c in p["claims"]], "digest": p["digest"], "alg": p["alg"]}


# ---------- citizen permissions ----------
class PermissionsIn(BaseModel):
    in_person_enabled: bool
    in_person_claims: List[str] = Field(default_factory=list, max_length=20)


class RevokeClaimsIn(BaseModel):
    claims: List[str] = Field(min_length=1, max_length=20)


PERM_EVENTS = ["qr_redeemed", "qr_declined", "consent_revoked", "consent_claims_revoked", "permissions_updated", "in_person_verified", "in_person_blocked"]


@ext.get("/vault/permissions")
async def get_permissions(user=Depends(require("citizen"))):
    prof = await db.profiles.find_one({"user_id": user["user_id"]}, {"_id": 0}) or {}
    history = await db.audit_events.find({"subject_id": user["user_id"], "event": {"$in": PERM_EVENTS}}, {"_id": 0}).sort("ts", -1).to_list(100)
    return {"in_person_enabled": bool(prof.get("in_person_enabled")), "in_person_claims": prof.get("in_person_claims", []),
            "claims": CLAIMS, "history": history}


@ext.put("/vault/permissions")
async def put_permissions(body: PermissionsIn, request: Request, user=Depends(require("citizen"))):
    claims = [c for c in dict.fromkeys(body.in_person_claims) if c in CLAIMS]
    if body.in_person_enabled and not claims:
        err(400, "VALIDATION_ERROR", "Select at least one claim to allow in-person face verification.")
    await db.profiles.update_one({"user_id": user["user_id"]}, {"$set": {"in_person_enabled": body.in_person_enabled, "in_person_claims": claims}})
    await audit("permissions_updated", actor=user, subject_id=user["user_id"], request=request,
                detail=("In-person sharing ON: " + ", ".join(claims)) if body.in_person_enabled else "In-person sharing OFF")
    return {"ok": True}


@ext.post("/vault/consents/{sid}/claims")
async def revoke_claims(sid: str, body: RevokeClaimsIn, request: Request, user=Depends(require("citizen"))):
    vs = await db.verification_sessions.find_one({"id": sid, "citizen_id": user["user_id"], "status": "active", "decision": "ALLOWED"}, {"_id": 0})
    if not vs:
        err(404, "NOT_FOUND", "Active consent not found.")
    left = {k: v for k, v in vs["released_claims"].items() if k not in body.claims}
    upd = {"released_claims": left}
    if not left:
        upd.update(status="revoked", revoked_at=iso(now()))
    await db.verification_sessions.update_one({"id": sid}, {"$set": upd})
    await audit("consent_claims_revoked", actor=user, org_id=vs["org_id"], qr_id=vs.get("qr_id"), subject_id=user["user_id"], request=request,
                detail=f"Withdrew {', '.join(CLAIMS.get(c, c) for c in body.claims)} from {vs['org_name']}")
    return {"ok": True}


# ---------- business: in-person face verification + verifications ----------
class FaceVerifyIn(LivenessIn):
    purpose: str = Field(min_length=3, max_length=120)
    claims: List[str] = Field(min_length=1, max_length=20)


@ext.post("/nexus/face-verify")
async def face_verify(body: FaceVerifyIn, request: Request, user=Depends(require("business"))):
    rate_limit(f"fv:{user['user_id']}", 20, 300)
    if not check_liveness(body):
        err(400, "LIVENESS_REQUIRED", "Ask the person to complete the front, left, right and blink scan.")
    org = await get_org(user["org_id"])
    match, d = await best_face_match(body.descriptor)
    if not match or d >= FACE_THRESHOLD:
        await audit("in_person_no_match", actor=user, org_id=org["id"], decision="DENIED", severity="warn", request=request, detail="Face not registered")
        err(404, "NO_MATCH", "This face is not registered with TrustID.")
    prof = await db.profiles.find_one({"user_id": match}, {"_id": 0})
    if not prof.get("in_person_enabled"):
        await audit("in_person_blocked", actor=user, org_id=org["id"], subject_id=match, decision="CONSENT_REQUIRED", request=request,
                    detail=f"{org['name']} attempted in-person verification for '{body.purpose}'")
        return {"decision": "CONSENT_REQUIRED", "message": "This person has not enabled in-person sharing. Ask them to scan your verification QR instead."}
    allowed = [c for c in dict.fromkeys(body.claims) if c in CLAIMS and c in org["allowed_claims"] and c in prof.get("in_person_claims", [])]
    withheld = [c for c in body.claims if c not in allowed]
    if not allowed:
        await audit("in_person_blocked", actor=user, org_id=org["id"], subject_id=match, decision="DENIED", request=request,
                    detail="None of the requested claims are permitted")
        return {"decision": "DENIED", "message": "None of the requested claims are permitted by this person or your policy.", "withheld": withheld}
    citizen = await db.users.find_one({"user_id": match}, {"_id": 0})
    released = await derive_claims(prof, allowed)
    vs = {"id": uid("vs"), "qr_id": None, "qr_name": "In-person face verification", "org_id": org["id"], "org_name": org["name"],
          "purpose": body.purpose.strip(), "channel": "in_person", "citizen_id": match, "citizen_label": citizen["name"],
          "requested_claims": body.claims, "released_claims": released, "decision": "ALLOWED", "status": "active", "created_at": iso(now())}
    vs["proof"] = await make_proof(vs)
    await db.verification_sessions.insert_one(dict(vs))
    await audit("in_person_verified", actor=user, org_id=org["id"], subject_id=match, decision="ALLOWED", request=request,
                detail=f"{org['name']} verified {len(released)} claim(s) for '{vs['purpose']}'")
    vs.pop("_id", None)
    return {"decision": "ALLOWED", "message": "Identity matched. Claims released under the person's standing permission.", "session": vs,
            "withheld": withheld, "claim_labels": {c: CLAIMS[c] for c in released}}


def _out(vs):
    vs = dict(vs)
    if vs.get("proof"):
        vs["proof_status"] = proof_state(vs)[0]
    if vs["status"] != "active":
        vs["released_claims"] = {}
    return vs


@ext.get("/nexus/verifications")
async def nexus_verifications(user=Depends(require("business"))):
    rows = await db.verification_sessions.find({"org_id": user["org_id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {"items": [_out(r) for r in rows], "claim_labels": CLAIMS}


@ext.get("/nexus/verifications/{sid}")
async def nexus_verification(sid: str, user=Depends(require("business"))):
    vs = await db.verification_sessions.find_one({"id": sid, "org_id": user["org_id"]}, {"_id": 0})
    if not vs:
        err(404, "NOT_FOUND", "Verification not found.")
    return {"item": _out(vs), "claim_labels": CLAIMS, "proof_url": f"{PUBLIC_APP_URL}/proof/{vs['proof']['proof_id']}" if vs.get("proof") else None}


@ext.get("/nexus/verifications/{sid}/certificate")
async def certificate(sid: str, request: Request, user=Depends(require("business"))):
    vs = await db.verification_sessions.find_one({"id": sid, "org_id": user["org_id"], "decision": "ALLOWED"}, {"_id": 0})
    if not vs or not vs.get("proof"):
        err(404, "NOT_FOUND", "No certificate for this verification.")
    status, _ = proof_state(vs)
    if status != "valid":
        err(410, "PROOF_REVOKED", "The person withdrew consent. This certificate can no longer be issued.")
    p = vs["proof"]
    url = f"{PUBLIC_APP_URL}/proof/{p['proof_id']}"
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    w, h = A4
    c.setFillColorRGB(0.04, 0.09, 0.15)
    c.rect(0, h - 120, w, 120, fill=1, stroke=0)
    c.setFillColorRGB(1, 1, 1)
    c.setFont("Helvetica-Bold", 22)
    c.drawString(40, h - 60, "TrustID Verification Certificate")
    c.setFont("Helvetica", 10)
    c.drawString(40, h - 82, f"Proof {p['proof_id']}  ·  Issued {p['issued_at'][:19].replace('T', ' ')} UTC  ·  {p['alg']}")
    c.setFillColorRGB(0.06, 0.09, 0.16)
    y = h - 160
    for label, val in [("Verified for", p["org_name"]), ("Purpose", p["purpose"]), ("Channel", "In-person face scan" if p["channel"] == "in_person" else "Consented QR request"),
                       ("Subject", f"{vs['citizen_label']}  ({p['subject_ref']})")]:
        c.setFont("Helvetica", 9)
        c.drawString(40, y, label.upper())
        c.setFont("Helvetica-Bold", 12)
        c.drawString(160, y, str(val)[:70])
        y -= 24
    y -= 10
    c.setFont("Helvetica-Bold", 13)
    c.drawString(40, y, "Released claims")
    y -= 22
    for k, v in p["claims"].items():
        c.setFont("Helvetica", 11)
        c.drawString(50, y, CLAIMS.get(k, k))
        c.setFont("Helvetica-Bold", 11)
        c.drawString(330, y, "Yes" if v is True else "No" if v is False else str(v)[:40])
        y -= 18
    y -= 16
    c.setFont("Helvetica", 8)
    c.drawString(40, y, f"SHA-256 digest: {p['digest']}")
    c.drawString(40, y - 12, f"Signature: {p['signature']}")
    widget = rl_qr.QrCodeWidget(url)
    b = widget.getBounds()
    d = Drawing(120, 120, transform=[120 / (b[2] - b[0]), 0, 0, 120 / (b[3] - b[1]), 0, 0])
    d.add(widget)
    renderPDF.draw(d, c, w - 170, 60)
    c.setFont("Helvetica", 8)
    c.drawString(40, 90, "Scan the QR or open the link to check this proof is authentic and still valid:")
    c.drawString(40, 78, url)
    c.drawString(40, 56, "Claims are attested by TrustID from the holder's FaceGate match and self-held documents. Not an official government verification.")
    c.showPage()
    c.save()
    await audit("certificate_downloaded", actor=user, org_id=user["org_id"], subject_id=vs["citizen_id"], request=request, detail=f"Proof {p['proof_id']}")
    return Response(content=buf.getvalue(), media_type="application/pdf",
                    headers={"Content-Disposition": f"attachment; filename=trustid-proof-{p['proof_id']}.pdf", "Cache-Control": "no-store"})


# ---------- WebAuthn fingerprint / passkey ----------
def _rp(request: Request):
    origin = request.headers.get("origin", "")
    if origin not in ORIGINS:
        err(400, "BAD_ORIGIN", "Fingerprint sign-in is not available from this address.")
    return origin, urlparse(origin).hostname


async def _store_challenge(challenge: bytes, kind: str, user_id: Optional[str]):
    cid = uid("chl")
    await db.webauthn_challenges.insert_one({"id": cid, "challenge": bytes_to_base64url(challenge), "kind": kind, "user_id": user_id,
                                             "expires_at": iso(now() + timedelta(minutes=5))})
    return cid


async def _pop_challenge(cid: str, kind: str):
    ch = await db.webauthn_challenges.find_one_and_delete({"id": cid, "kind": kind}, projection={"_id": 0})
    if not ch or parse_dt(ch["expires_at"]) < now():
        err(400, "CHALLENGE_EXPIRED", "The fingerprint request expired. Please try again.")
    return ch


class WebAuthnVerifyIn(BaseModel):
    challenge_id: str
    credential: dict


@ext.post("/me/passkey/options")
async def passkey_reg_options(request: Request, user=Depends(get_user)):
    _, rp_id = _rp(request)
    existing = await db.passkeys.find({"user_id": user["user_id"]}, {"_id": 0, "credential_id": 1}).to_list(20)
    opts = generate_registration_options(
        rp_id=rp_id, rp_name="TrustID", user_id=user["user_id"].encode(), user_name=user["email"], user_display_name=user["name"],
        authenticator_selection=AuthenticatorSelectionCriteria(authenticator_attachment=AuthenticatorAttachment.PLATFORM,
                                                               resident_key=ResidentKeyRequirement.REQUIRED,
                                                               user_verification=UserVerificationRequirement.REQUIRED),
        exclude_credentials=[PublicKeyCredentialDescriptor(id=base64url_to_bytes(e["credential_id"])) for e in existing])
    cid = await _store_challenge(opts.challenge, "reg", user["user_id"])
    return {"challenge_id": cid, "options": json.loads(options_to_json(opts))}


@ext.post("/me/passkey/verify")
async def passkey_reg_verify(body: WebAuthnVerifyIn, request: Request, user=Depends(get_user)):
    origin, rp_id = _rp(request)
    ch = await _pop_challenge(body.challenge_id, "reg")
    if ch["user_id"] != user["user_id"]:
        err(400, "CHALLENGE_EXPIRED", "The fingerprint request expired. Please try again.")
    try:
        v = verify_registration_response(credential=body.credential, expected_challenge=base64url_to_bytes(ch["challenge"]),
                                         expected_origin=origin, expected_rp_id=rp_id, require_user_verification=True)
    except Exception:
        logger.exception("passkey registration failed")
        err(400, "PASSKEY_FAILED", "Fingerprint could not be registered on this device.")
    await db.passkeys.insert_one({"id": uid("pk"), "user_id": user["user_id"], "credential_id": bytes_to_base64url(v.credential_id),
                                  "public_key": bytes_to_base64url(v.credential_public_key), "sign_count": v.sign_count, "created_at": iso(now())})
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"passkey_enrolled": True}})
    await audit("fingerprint_enrolled", actor=user, subject_id=user["user_id"], decision="ALLOWED", request=request, detail="Device fingerprint / passkey bound")
    return {"ok": True}


@ext.delete("/me/passkey")
async def passkey_delete(request: Request, user=Depends(get_user)):
    await db.passkeys.delete_many({"user_id": user["user_id"]})
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"passkey_enrolled": False}})
    await audit("fingerprint_removed", actor=user, subject_id=user["user_id"], request=request)
    return {"ok": True}


@ext.post("/auth/passkey/options")
async def passkey_login_options(request: Request):
    rate_limit(f"pkopt:{client_ip(request)}", 20, 300)
    _, rp_id = _rp(request)
    opts = generate_authentication_options(rp_id=rp_id, user_verification=UserVerificationRequirement.REQUIRED)
    cid = await _store_challenge(opts.challenge, "auth", None)
    return {"challenge_id": cid, "options": json.loads(options_to_json(opts))}


@ext.post("/auth/passkey/verify")
async def passkey_login_verify(body: WebAuthnVerifyIn, request: Request, response: Response):
    rate_limit(f"pklogin:{client_ip(request)}", 10, 300)
    origin, rp_id = _rp(request)
    ch = await _pop_challenge(body.challenge_id, "auth")
    pk = await db.passkeys.find_one({"credential_id": body.credential.get("id")}, {"_id": 0})
    if not pk:
        await audit("fingerprint_login_failed", decision="DENIED", severity="warn", request=request, detail="Unknown passkey")
        err(401, "FINGERPRINT_NOT_RECOGNIZED", "This fingerprint is not linked to a TrustID account.")
    try:
        v = verify_authentication_response(credential=body.credential, expected_challenge=base64url_to_bytes(ch["challenge"]),
                                           expected_rp_id=rp_id, expected_origin=origin, credential_public_key=base64url_to_bytes(pk["public_key"]),
                                           credential_current_sign_count=pk["sign_count"], require_user_verification=True)
    except Exception:
        await audit("fingerprint_login_failed", decision="DENIED", severity="warn", request=request, detail="Signature check failed")
        err(401, "FINGERPRINT_NOT_RECOGNIZED", "Fingerprint verification failed. Please try again.")
    await db.passkeys.update_one({"id": pk["id"]}, {"$set": {"sign_count": v.new_sign_count}})
    user = await db.users.find_one({"user_id": pk["user_id"]}, {"_id": 0})
    exp = await create_session(user, "fingerprint", response)
    await audit("login_success", actor=user, decision="ALLOWED", request=request, detail="Fingerprint / passkey sign-in")
    return {"user": public_user(user), "session_expires_at": iso(exp)}
