# TrustID / FaceGate

Privacy-first identity verification MVP: **Vault** (citizen), **Nexus** (business QR verification), **Sentinel** (government case review), with **FaceGate** face login.

## Stack
React (CRA + Tailwind) · FastAPI · MongoDB · `@vladmandic/face-api` (in-browser face detection + 128-d embeddings) · `qrcode.react`.

## How FaceGate works
1. Browser loads face models from `/models` (served locally from `frontend/public/models`).
2. One user-initiated frame is analysed in the browser; exactly one face is required.
3. Only the 128-number descriptor is sent. The server encrypts it (Fernet, `FACE_ENC_KEY`) and stores it in `face_templates`.
4. Login: server compares Euclidean distance to all templates; match only if `< FACE_MATCH_THRESHOLD` (default 0.5).
5. Duplicate faces are rejected at registration. No images are ever stored.

**Limitations:** face matching is NOT liveness detection — a photo or screen can fool it. Requires HTTPS (or localhost) for camera access. A "Use a photo" upload fallback exists for devices without a camera.

## Sessions
Random 256-bit token in an HttpOnly, Secure, SameSite=None cookie; only its SHA-256 hash is stored. Expires after `SESSION_MINUTES` (30). Validated on every protected request; logout deletes it server-side.

## Backend environment (`backend/.env`)
`MONGO_URL`, `DB_NAME`, `CORS_ORIGINS`, `FACE_ENC_KEY`, `SESSION_MINUTES`, `FACE_MATCH_THRESHOLD`, `DEMO_MODE`, `OWNER_EMAIL`.

## Demo mode (development only)
With `DEMO_MODE=true` the server seeds (idempotently, on startup):
- `demo.citizen@trustid.demo` – citizen
- `demo.business@trustid.demo` – business admin of *Northwind Bank (Demo)*
- `demo.gov@trustid.demo` – government reviewer, assigned to 4 synthetic cases (`CASE-2026-0099` is deliberately unassigned)

Sign in via the "Development demo accounts" buttons on `/login` (no passwords). **Set `DEMO_MODE=false` in production** — the endpoint then returns 404 and the buttons disappear.
`OWNER_EMAIL` receives all three roles on Google sign-in.

## Trust Firewall
`trust_firewall()` in `server.py` checks QR status (revoked/expired/used up), caller role, own-org conflicts, organisation claim policy and consent, returning `ALLOWED`, `DENIED`, `EXPIRED`, `REVOKED` or `CONSENT_REQUIRED`. Redemption uses an atomic `find_one_and_update` with `uses < max_uses` to prevent replay. QR tokens are stored hashed (lookup) and encrypted (so the owner can re-display the QR).

## Backup / reset
- Backup: `mongodump --uri "$MONGO_URL" --db "$DB_NAME" --out ./backup`
- Restore: `mongorestore --uri "$MONGO_URL" ./backup`
- Reset demo data: drop the database (`mongosh "$MONGO_URL/$DB_NAME" --eval "db.dropDatabase()"`) and restart the backend; seed data is recreated.

## Data deletion
Settings → delete face template, or delete account (removes user, profile, template, sessions; anonymises shared verification records).
