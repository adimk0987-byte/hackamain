import { PageHeader } from "@/components/Shared";
import { FaceSection } from "@/pages/SettingsPage";
import { FingerprintCard } from "@/components/FingerprintCard";
import { useAuth } from "@/context/AuthContext";

export default function VaultFace() {
  const { user, refresh } = useAuth();
  return (
    <div className="space-y-6" data-testid="vault-face">
      <PageHeader eyebrow="Biometrics" title="Face & Fingerprint Scan" subtitle="Front, left and right face scan with blink liveness, plus your device fingerprint. These unlock your document vault." />
      <FaceSection defaultOpen />
      <FingerprintCard enrolled={user.passkey_enrolled} onChange={refresh} />
    </div>
  );
}
