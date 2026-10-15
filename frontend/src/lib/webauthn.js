import { api } from "@/lib/api";

const b64uToBuf = (s) => {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
  return Uint8Array.from(b, (c) => c.charCodeAt(0)).buffer;
};
const bufToB64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export const fingerprintSupported = () => typeof window.PublicKeyCredential === "function";

export async function enrollFingerprint() {
  const { data } = await api.post("/me/passkey/options");
  const o = data.options;
  const cred = await navigator.credentials.create({
    publicKey: {
      ...o,
      challenge: b64uToBuf(o.challenge),
      user: { ...o.user, id: b64uToBuf(o.user.id) },
      excludeCredentials: (o.excludeCredentials || []).map((c) => ({ ...c, id: b64uToBuf(c.id) })),
    },
  });
  const r = cred.response;
  const credential = {
    id: cred.id, rawId: bufToB64u(cred.rawId), type: cred.type,
    response: { clientDataJSON: bufToB64u(r.clientDataJSON), attestationObject: bufToB64u(r.attestationObject), transports: r.getTransports?.() || [] },
    clientExtensionResults: cred.getClientExtensionResults(), authenticatorAttachment: cred.authenticatorAttachment,
  };
  await api.post("/me/passkey/verify", { challenge_id: data.challenge_id, credential });
}

export async function loginFingerprint() {
  const { data } = await api.post("/auth/passkey/options");
  const o = data.options;
  const cred = await navigator.credentials.get({ publicKey: { ...o, challenge: b64uToBuf(o.challenge), allowCredentials: [] } });
  const r = cred.response;
  const credential = {
    id: cred.id, rawId: bufToB64u(cred.rawId), type: cred.type,
    response: { clientDataJSON: bufToB64u(r.clientDataJSON), authenticatorData: bufToB64u(r.authenticatorData), signature: bufToB64u(r.signature), userHandle: r.userHandle ? bufToB64u(r.userHandle) : null },
    clientExtensionResults: cred.getClientExtensionResults(), authenticatorAttachment: cred.authenticatorAttachment,
  };
  const res = await api.post("/auth/passkey/verify", { challenge_id: data.challenge_id, credential });
  return res.data;
}

export const webauthnError = (e) =>
  e?.name === "NotAllowedError" ? "Fingerprint prompt was cancelled or timed out." : e?.name === "InvalidStateError" ? "This device fingerprint is already registered." : null;
