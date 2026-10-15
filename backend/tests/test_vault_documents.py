# TrustID regression: FaceGate register/login (TEST_ accounts @test.trustid), vault document upload/view/delete, ownership, FACE_REQUIRED
import os
import io
import random
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 300
PDF = b"%PDF-1.4\n" + b"0" * 300


def rand_desc(seed):
    r = random.Random(seed)
    return [round(r.uniform(-0.3, 0.3), 5) for _ in range(128)]


def demo(role):
    s = requests.Session()
    r = s.post(f"{API}/auth/demo-login", json={"role": role})
    assert r.status_code == 200, r.text
    return s


@pytest.fixture(scope="module")
def citizen():
    return demo("citizen")


@pytest.fixture(scope="module")
def face_citizen():
    """TEST_ citizen via FaceGate register + login (synthetic descriptor)."""
    desc = rand_desc(uuid.uuid4().hex)
    email = f"test_{uuid.uuid4().hex[:8]}@test.trustid"
    r = requests.post(f"{API}/auth/face/register", json={"name": "TEST_Doc User", "email": email, "consent": True, "descriptor": desc})
    assert r.status_code == 200, r.text
    assert r.json()["ok"] is True
    s = requests.Session()
    r = s.post(f"{API}/auth/face/login", json={"descriptor": desc})
    assert r.status_code == 200, r.text
    assert r.json()["user"]["name"] == "TEST_Doc User"
    assert r.json()["distance"] < 0.01
    assert "session_token" in s.cookies.get_dict()
    yield {"s": s, "desc": desc, "email": email}
    s.post(f"{API}/me/delete", json={"confirm": "DELETE"})


def upload(s, content=PNG, ct="image/png", doc_type="aadhaar", title="TEST_Aadhaar", name="a.png"):
    return s.post(f"{API}/vault/documents", files={"file": (name, io.BytesIO(content), ct)}, data={"doc_type": doc_type, "title": title})


class TestFaceGate:
    def test_duplicate_face_and_email(self, face_citizen):
        near = [x + 0.002 for x in face_citizen["desc"]]
        r = requests.post(f"{API}/auth/face/register", json={"name": "TEST_Dup", "email": f"test_{uuid.uuid4().hex[:6]}@test.trustid", "consent": True, "descriptor": near})
        assert r.status_code == 409 and r.json()["detail"]["code"] == "DUPLICATE_FACE"
        r = requests.post(f"{API}/auth/face/register", json={"name": "TEST_Dup", "email": face_citizen["email"], "consent": True, "descriptor": rand_desc("zz")})
        assert r.status_code == 409 and r.json()["detail"]["code"] == "EMAIL_TAKEN"

    def test_register_bad_inputs(self):
        e = f"test_{uuid.uuid4().hex[:6]}@test.trustid"
        r = requests.post(f"{API}/auth/face/register", json={"name": "TEST_C", "email": e, "consent": False, "descriptor": rand_desc("c")})
        assert r.status_code == 400 and r.json()["detail"]["code"] == "CONSENT_REQUIRED"
        r = requests.post(f"{API}/auth/face/register", json={"name": "TEST_C", "email": e, "consent": True, "descriptor": [0.1] * 127})
        assert r.status_code == 422

    def test_unknown_face(self):
        r = requests.post(f"{API}/auth/face/login", json={"descriptor": [5.0] * 128})
        assert r.status_code == 401
        assert r.json()["detail"]["message"] == "Face not recognized. Please register first."

    def test_logout_server_side(self):
        s = demo("citizen")
        tok = s.cookies.get("session_token")
        assert s.post(f"{API}/auth/logout").status_code == 200
        assert requests.get(f"{API}/auth/me", cookies={"session_token": tok}).status_code == 401


class TestDocuments:
    def test_upload_view_delete(self, citizen):
        r = upload(citizen)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["doc_type"] == "aadhaar" and d["title"] == "TEST_Aadhaar" and d["size"] == len(PNG)
        assert "storage_path" not in d
        lst = citizen.get(f"{API}/vault/documents").json()["items"]
        assert any(x["id"] == d["id"] for x in lst)
        f = citizen.get(f"{API}/vault/documents/{d['id']}/file")
        assert f.status_code == 200 and f.content == PNG and f.headers["content-type"].startswith("image/png")
        ov = citizen.get(f"{API}/vault/overview").json()
        assert ov["stats"]["documents"] == len(lst)
        assert citizen.delete(f"{API}/vault/documents/{d['id']}").status_code == 200
        assert citizen.get(f"{API}/vault/documents/{d['id']}/file").status_code == 404
        assert citizen.delete(f"{API}/vault/documents/{d['id']}").status_code == 404

    def test_pdf_upload(self, citizen):
        r = upload(citizen, PDF, "application/pdf", "pan", "TEST_PAN", "p.pdf")
        assert r.status_code == 200, r.text
        citizen.delete(f"{API}/vault/documents/{r.json()['id']}")

    def test_rejections(self, citizen):
        r = upload(citizen, b"hello this is text " * 20, "image/png")
        assert r.status_code == 415
        r = upload(citizen, b"hello" * 50, "text/plain", name="a.txt")
        assert r.status_code == 415
        r = upload(citizen, b"\x89PNG" + b"\x00" * (5 * 1024 * 1024 + 10))
        assert r.status_code == 413
        r = upload(citizen, doc_type="ssn")
        assert r.status_code == 400

    def test_non_citizen_forbidden(self):
        b = demo("business")
        assert upload(b).status_code == 403
        assert b.get(f"{API}/vault/documents").status_code == 403

    def test_owner_only_and_face_required(self, citizen, face_citizen):
        d = upload(citizen).json()
        other = face_citizen["s"]
        assert other.get(f"{API}/vault/documents/{d['id']}/file").status_code == 404
        assert other.delete(f"{API}/vault/documents/{d['id']}").status_code == 404
        citizen.delete(f"{API}/vault/documents/{d['id']}")
        # face-registered user can upload
        r = upload(other)
        assert r.status_code == 200, r.text
        other.delete(f"{API}/vault/documents/{r.json()['id']}")
        # remove face -> FACE_REQUIRED
        assert other.delete(f"{API}/me/face").status_code == 200
        r = upload(other)
        assert r.status_code == 403 and r.json()["detail"]["code"] == "FACE_REQUIRED"
        assert other.get(f"{API}/vault/overview").json()["face_enrolled"] is False

    def test_demo_delete_blocked(self, citizen):
        r = citizen.post(f"{API}/me/delete", json={"confirm": "DELETE"})
        assert r.status_code == 403 and r.json()["detail"]["code"] == "DEMO_ACCOUNT"
