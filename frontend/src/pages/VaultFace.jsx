import { PageHeader } from "@/components/Shared";
import { FaceSection } from "@/pages/SettingsPage";

export default function VaultFace() {
  return (
    <div data-testid="vault-face">
      <PageHeader eyebrow="FaceGate" title="Face Scan" subtitle="Your face is the key to your account and your document vault." />
      <FaceSection defaultOpen />
    </div>
  );
}
