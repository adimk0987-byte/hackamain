import { PageHeader } from "@/components/Shared";

const FAQ = [
  ["Is my photo stored?", "No. Your browser turns one camera frame into a 128-number face template. Only that template is sent and stored, encrypted. The image is discarded."],
  ["Who can see my documents?", "Only you, after logging in. Files are encrypted before storage. Businesses and government reviewers never receive your files."],
  ["Does TrustID verify my Aadhaar or PAN with the government?", "No. TrustID keeps your uploaded copies securely. It does not connect to UIDAI, Income Tax or any official registry."],
  ["Can a photo fool face login?", "Possibly. FaceGate matches faces but does not detect liveness. Keep your session short and log out on shared devices."],
  ["How do I share my identity with a business?", "Open the verification link or QR the business gives you, review exactly which claims they ask for, then approve or decline. You can revoke later under Verifications."],
  ["How do I delete my data?", "Settings → delete face template or delete your account. Deleting your account removes your profile, face template and documents."],
];

export default function HelpPage() {
  return (
    <div data-testid="help-page">
      <PageHeader eyebrow="Help & Support" title="How TrustID works" subtitle="Plain answers about your face, your documents and your privacy." />
      <div className="grid gap-4 md:grid-cols-2">
        {FAQ.map(([q, a]) => (
          <div key={q} className="tid-card p-5"><p className="font-display font-semibold">{q}</p><p className="mt-2 text-sm leading-relaxed text-slate-600">{a}</p></div>
        ))}
      </div>
    </div>
  );
}
