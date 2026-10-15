# TrustID backend regression tests: auth, FaceGate, RBAC, QR/Trust Firewall, notes/tasks, Sentinel, audit
import os
import random
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"


def rand_desc(seed=None):
    r = random.Random(seed)
    return [round(r.uniform(-0.3, 0.3), 5) for _ in range(128)]


def session_for(role):
    s = requests.Session()
    r = s.post(f"{API}/auth/demo-login", json={"role": role})
    assert r.status_code == 200, r.text
    assert "session_token" in s.cookies.get_dict()
    return s


@pytest.fixture(scope="module")
def citizen():
    return session_for("citizen")


@pytest.fixture(scope="module")
def business():
    return session_for("business")


@pytest.fixture(scope="module")
def gov():
    return session_for("government")


@pytest.fixture(scope="module")
def face_user():
    """Second citizen registered via FaceGate."""
    desc = rand_desc(uuid.uuid4().hex)
    email = f"test_{uuid.uuid4().hex[:8]}@example.com"
    r = requests.post(f"{API}/auth/face/register", json={"name": "TEST_Face User", "email": email, "consent": True, "descriptor": desc})
    assert r.status_code == 200, r.text
    s = requests.Session()
    r = s.post(f"{API}/auth/face/login", json={"descriptor": desc})
    assert r.status_code == 200, r.text
    return {"session": s, "desc": desc, "email": email, "user": r.json()["user"]}


def new_qr(business, **kw):
    body = {"name": "TEST_QR " + uuid.uuid4().hex[:5], "purpose": "KYC test", "claims": ["full_name", "email"], "expiry": "1h", "max_uses": 1,
            "tags": ["test"]}
    body.update(kw)
    r = business.post(f"{API}/nexus/qrs", json=body)
    assert r.status_code == 200, r.text
    return r.json()


# ---- Auth ----
class TestAuth:
    def test_demo_login_all_roles_and_me(self):
        for role in ["citizen", "business", "government"]:
            s = session_for(role)
            me = s.get(f"{API}/auth/me")
            assert me.status_code == 200
            assert role in me.json()["user"]["roles"]

    def test_logout_invalidates(self):
        s = session_for("citizen")
        tok = s.cookies.get("session_token")
        assert s.post(f"{API}/auth/logout").status_code == 200
        r = requests.get(f"{API}/auth/me", cookies={"session_token": tok})
        assert r.status_code == 401
        assert r.json()["detail"]["code"] in ("SESSION_INVALID", "SESSION_EXPIRED")

    def test_me_unauth(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401
        assert r.json()["detail"]["code"] == "NOT_AUTHENTICATED"


# ---- FaceGate ----
class TestFace:
    def test_register_validation(self):
        d = rand_desc()
        cases = [
            ({"name": "TEST_A", "email": "bad-email", "consent": True, "descriptor": d}, 422),
            ({"name": "T", "email": "test_x1@example.com", "consent": True, "descriptor": d}, 422),
            ({"name": "TEST_A", "email": "test_x2@example.com", "consent": False, "descriptor": d}, 400),
            ({"name": "TEST_A", "email": "test_x3@example.com", "consent": True, "descriptor": d[:100]}, 422),
        ]
        for body, code in cases:
            r = requests.post(f"{API}/auth/face/register", json=body)
            assert r.status_code == code, (body["email"], r.status_code, r.text)
            det = r.json()["detail"]
            assert "code" in det and "message" in det

    def test_duplicate_face_and_email(self, face_user):
        near = [x + 0.001 for x in face_user["desc"]]
        r = requests.post(f"{API}/auth/face/register", json={"name": "TEST_Dup", "email": f"test_{uuid.uuid4().hex[:8]}@example.com", "consent": True, "descriptor": near})
        assert r.status_code == 409 and r.json()["detail"]["code"] == "DUPLICATE_FACE"
        r = requests.post(f"{API}/auth/face/register", json={"name": "TEST_Dup", "email": face_user["email"], "consent": True, "descriptor": rand_desc("x")})
        assert r.status_code == 409 and r.json()["detail"]["code"] == "EMAIL_TAKEN"

    def test_face_login_unknown(self):
        r = requests.post(f"{API}/auth/face/login", json={"descriptor": [9.0] * 128})
        assert r.status_code == 401
        assert r.json()["detail"]["code"] == "FACE_NOT_RECOGNIZED"
        assert r.json()["detail"]["message"] == "Face not recognized. Please register first."

    def test_face_login_session(self, face_user):
        me = face_user["session"].get(f"{API}/auth/me")
        assert me.status_code == 200 and me.json()["user"]["email"] == face_user["email"]
        assert me.json()["user"]["roles"] == ["citizen"]


# ---- RBAC ----
class TestRBAC:
    def test_citizen_forbidden(self, citizen):
        for p in ["/nexus/stats", "/nexus/qrs", "/sentinel/cases", "/sentinel/alerts"]:
            r = citizen.get(f"{API}{p}")
            assert r.status_code == 403, p

    def test_business_sentinel_denied_and_audited(self, business, gov):
        assert business.get(f"{API}/sentinel/cases").status_code == 403
        r = gov.get(f"{API}/sentinel/alerts")
        assert r.status_code == 200
        assert any(e["event"] == "access_denied" and "/api/sentinel/cases" in e["detail"] for e in r.json()["items"])

    def test_audit_scope(self, citizen, business):
        assert citizen.get(f"{API}/audit", params={"portal": "business"}).status_code == 403
        r = business.get(f"{API}/audit", params={"portal": "business"})
        assert r.status_code == 200
        assert all(e["org_id"] == "org_demo_northwind" for e in r.json()["items"])
        assert citizen.get(f"{API}/audit", params={"portal": "citizen"}).status_code == 200


# ---- QR + Trust Firewall ----
class TestQrFirewall:
    def test_full_flow(self, business, citizen, face_user):
        q = new_qr(business)
        assert q["claims"] == ["full_name"] and q["reduced_claims"] == ["email"]
        token = q["token"]
        pub = requests.get(f"{API}/verify/{token}")
        assert pub.status_code == 200
        body = pub.json()
        assert "notes" not in body and "tags" not in body and "token" not in body
        assert [c["key"] for c in body["claims"]] == ["full_name"]
        # unauth respond
        assert requests.post(f"{API}/verify/{token}/respond", json={"decision": "approve"}).status_code == 401
        r = citizen.post(f"{API}/verify/{token}/respond", json={"decision": "approve"})
        assert r.status_code == 200 and r.json()["decision"] == "ALLOWED"
        assert set(r.json()["released_claims"].keys()) == {"full_name"}
        assert citizen.post(f"{API}/verify/{token}/respond", json={"decision": "approve"}).status_code == 409
        r2 = face_user["session"].post(f"{API}/verify/{token}/respond", json={"decision": "approve"})
        assert r2.status_code == 200 and r2.json()["decision"] == "DENIED" and r2.json()["released_claims"] == {}
        # business sees released claims
        d = business.get(f"{API}/nexus/qrs/{q['id']}").json()
        sess = [s for s in d["sessions"] if s["decision"] == "ALLOWED"][0]
        assert "full_name" in sess["released_claims"]
        # citizen revokes consent -> hidden
        cons = citizen.get(f"{API}/vault/consents").json()["items"]
        sid = [c for c in cons if c["qr_id"] == q["id"]][0]["id"]
        assert citizen.post(f"{API}/vault/consents/{sid}/revoke").status_code == 200
        assert citizen.post(f"{API}/vault/consents/{sid}/revoke").status_code == 404
        d = business.get(f"{API}/nexus/qrs/{q['id']}").json()
        sess = [s for s in d["sessions"] if s["id"] == sid][0]
        assert sess["released_claims"] == {} and sess["status"] == "revoked"

    def test_revoked_and_deny(self, business, citizen):
        q = new_qr(business, claims=["full_name", "age_over_18"])
        assert business.post(f"{API}/nexus/qrs/{q['id']}/revoke").status_code == 200
        assert business.post(f"{API}/nexus/qrs/{q['id']}/revoke").status_code == 400
        r = citizen.post(f"{API}/verify/{q['token']}/respond", json={"decision": "approve"})
        assert r.json()["decision"] == "REVOKED" and r.json()["released_claims"] == {}
        q2 = new_qr(business, claims=["full_name"])
        r = citizen.post(f"{API}/verify/{q2['token']}/respond", json={"decision": "deny"})
        assert r.json()["decision"] == "CONSENT_REQUIRED" and r.json()["released_claims"] == {}

    def test_policy_denied_and_invalid(self, business):
        r = business.post(f"{API}/nexus/qrs", json={"name": "TEST_x", "purpose": "abc", "claims": ["email"], "expiry": "1h"})
        assert r.status_code == 403 and r.json()["detail"]["code"] == "POLICY_DENIED"
        r = business.post(f"{API}/nexus/qrs", json={"name": "TEST_x", "purpose": "abc", "claims": ["ssn"], "expiry": "1h"})
        assert r.status_code == 400
        assert requests.get(f"{API}/verify/aaaaaaaaaaaaaaaaaaaaaa").status_code == 404
        assert business.get(f"{API}/nexus/qrs/qr_doesnotexist").status_code == 404

    def test_list_search_stats(self, business):
        q = new_qr(business, name="TEST_SearchMe Unique")
        r = business.get(f"{API}/nexus/qrs", params={"q": "searchme unique"}).json()
        assert any(x["id"] == q["id"] for x in r["items"])
        r = business.get(f"{API}/nexus/qrs", params={"status": "revoked", "page_size": 50}).json()
        assert all(x["status"] == "revoked" for x in r["items"])
        st = business.get(f"{API}/nexus/stats").json()
        allq = business.get(f"{API}/nexus/qrs", params={"page_size": 50}).json()
        assert st["total"] == allq["total"]
        assert st["active"] + st["expired"] + st["revoked"] + st["completed_qrs"] == st["total"]


# ---- Notes & tasks ----
class TestNotes:
    def test_notes_tasks(self, business):
        q = new_qr(business, claims=["full_name"])
        n = business.post(f"{API}/nexus/qrs/{q['id']}/notes", json={"body": "TEST_note alpha", "tags": ["vip"]}).json()
        e = business.patch(f"{API}/nexus/notes/{n['id']}", json={"body": "TEST_note beta"}).json()
        assert e["body"] == "TEST_note beta" and len(e["history"]) == 1 and e["history"][0]["body"] == "TEST_note alpha"
        lst = business.get(f"{API}/nexus/qrs/{q['id']}/notes", params={"tag": "vip"}).json()
        assert [x["id"] for x in lst["notes"]] == [n["id"]]
        assert business.get(f"{API}/nexus/qrs/{q['id']}/notes", params={"tag": "nope"}).json()["notes"] == []
        assert len(business.get(f"{API}/nexus/qrs/{q['id']}/notes", params={"q": "BETA"}).json()["notes"]) == 1
        a = business.patch(f"{API}/nexus/notes/{n['id']}", json={"archived": True}).json()
        assert a["archived"] is True
        assert business.get(f"{API}/nexus/qrs/{q['id']}/notes").json()["notes"] == []
        assert len(business.get(f"{API}/nexus/qrs/{q['id']}/notes", params={"archived": "true"}).json()["notes"]) == 1
        t = business.post(f"{API}/nexus/qrs/{q['id']}/tasks", json={"title": "TEST_call back", "due_date": "2026-02-01"}).json()
        assert business.patch(f"{API}/nexus/tasks/{t['id']}", json={"done": True}).status_code == 200
        tasks = business.get(f"{API}/nexus/qrs/{q['id']}/notes").json()["tasks"]
        assert tasks[0]["done"] is True
        assert business.patch(f"{API}/nexus/notes/note_x", json={"body": "x"}).status_code == 404
        assert business.post(f"{API}/nexus/qrs/qr_x/notes", json={"body": "x"}).status_code == 404


# ---- Sentinel ----
class TestSentinel:
    def test_cases(self, gov):
        r = gov.get(f"{API}/sentinel/cases").json()
        refs = sorted(c["ref"] for c in r["items"])
        assert refs == ["CASE-2026-0012", "CASE-2026-0027", "CASE-2026-0041", "CASE-2026-0058"]
        s = gov.get(f"{API}/sentinel/cases", params={"q": "CASE-2026-0099"}).json()
        assert s["items"] == [] and s["denied"]["ref"] == "CASE-2026-0099"

    def test_case_access_flow(self, gov):
        c = gov.get(f"{API}/sentinel/cases").json()["items"][0]
        r = gov.get(f"{API}/sentinel/cases/{c['id']}")
        assert r.status_code == 403 and r.json()["detail"]["code"] == "ACCESS_REASON_REQUIRED"
        assert gov.post(f"{API}/sentinel/cases/{c['id']}/access", json={"reason": "short"}).status_code == 422
        g = gov.post(f"{API}/sentinel/cases/{c['id']}/access", json={"reason": "TEST_routine review of case"}).json()
        d = gov.get(f"{API}/sentinel/cases/{c['id']}", params={"grant_id": g["grant_id"]})
        assert d.status_code == 200 and "assigned_to" not in d.json()["case"]
        rm = gov.post(f"{API}/sentinel/cases/{c['id']}/remarks", json={"body": "TEST_remark", "grant_id": g["grant_id"]})
        assert rm.status_code == 200
        orig = d.json()["case"]["status"]
        st = gov.post(f"{API}/sentinel/cases/{c['id']}/status", json={"status": "under_review", "reason": "TEST_status change reason", "grant_id": g["grant_id"]})
        assert st.status_code == 200
        d2 = gov.get(f"{API}/sentinel/cases/{c['id']}", params={"grant_id": g["grant_id"]}).json()
        assert d2["case"]["status"] == "under_review"
        assert any(x["body"] == "TEST_remark" for x in d2["remarks"])
        gov.post(f"{API}/sentinel/cases/{c['id']}/status", json={"status": orig, "reason": "TEST_restore original status", "grant_id": g["grant_id"]})

    def test_unassigned_case(self, gov):
        from pymongo import MongoClient  # look up 0099 id directly
        mc = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
        dbn = os.environ.get("DB_NAME")
        if not dbn:
            pytest.skip("DB_NAME not set")
        cid = mc[dbn].cases.find_one({"ref": "CASE-2026-0099"})["id"]
        r = gov.post(f"{API}/sentinel/cases/{cid}/access", json={"reason": "TEST_trying unassigned case"})
        assert r.status_code == 403 and r.json()["detail"]["code"] == "NOT_ASSIGNED"
        assert gov.get(f"{API}/sentinel/cases/{cid}").status_code == 403


# ---- Rate limit (run last) ----
class TestZRateLimit:
    def test_xff_spoof_bypass(self):
        """Security check: rate-limit key derives from client-supplied X-Forwarded-For."""
        codes = []
        for i in range(12):
            r = requests.post(f"{API}/auth/face/login", json={"descriptor": [9.0] * 128}, headers={"X-Forwarded-For": f"10.9.{i}.1"})
            codes.append(r.status_code)
        print("spoofed XFF codes:", codes)
        assert 429 in codes, "Rate limit bypassable by spoofing X-Forwarded-For"

    def test_face_login_rate_limit(self):
        codes = [requests.post(f"{API}/auth/face/login", json={"descriptor": [9.0] * 128}).status_code for _ in range(12)]
        assert 429 in codes, codes
