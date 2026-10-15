import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@/context/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppShell } from "@/components/AppShell";
import Landing from "@/pages/Landing";
import IndividualEntry from "@/pages/IndividualEntry";
import PortalLogin from "@/pages/PortalLogin";
import VaultDocuments from "@/pages/VaultDocuments";
import VaultFace from "@/pages/VaultFace";
import HelpPage from "@/pages/HelpPage";
import AuthCallback from "@/pages/AuthCallback";
import VaultHome from "@/pages/VaultHome";
import VaultIdentity from "@/pages/VaultIdentity";
import VaultConsents from "@/pages/VaultConsents";
import NexusHome from "@/pages/NexusHome";
import NexusQrs from "@/pages/NexusQrs";
import QrDetail from "@/pages/QrDetail";
import SentinelHome from "@/pages/SentinelHome";
import SentinelAlerts from "@/pages/SentinelAlerts";
import CaseDetail from "@/pages/CaseDetail";
import AuditPage from "@/pages/AuditPage";
import SettingsPage from "@/pages/SettingsPage";
import Verify from "@/pages/Verify";
import { Unauthorized, NotFound } from "@/pages/ErrorPages";

const shell = (el, role) => <ProtectedRoute role={role}><AppShell>{el}</AppShell></ProtectedRoute>;

function AppRouter() {
  const location = useLocation();
  // Process Emergent OAuth return synchronously before any route renders.
  if (location.hash?.includes("session_id=")) return <AuthCallback />;
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/individual" element={<IndividualEntry />} />
      <Route path="/business" element={<PortalLogin role="business" />} />
      <Route path="/government" element={<PortalLogin role="government" />} />
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="/register" element={<Navigate to="/individual" replace state={{ mode: "register" }} />} />
      <Route path="/v/:token" element={<Verify />} />
      <Route path="/vault" element={shell(<VaultHome />, "citizen")} />
      <Route path="/vault/identity" element={shell(<VaultIdentity />, "citizen")} />
      <Route path="/vault/documents" element={shell(<VaultDocuments />, "citizen")} />
      <Route path="/vault/face" element={shell(<VaultFace />, "citizen")} />
      <Route path="/help" element={shell(<HelpPage />)} />
      <Route path="/vault/consents" element={shell(<VaultConsents />, "citizen")} />
      <Route path="/nexus" element={shell(<NexusHome />, "business")} />
      <Route path="/nexus/qrs" element={shell(<NexusQrs />, "business")} />
      <Route path="/nexus/qrs/:id" element={shell(<QrDetail />, "business")} />
      <Route path="/sentinel" element={shell(<SentinelHome />, "government")} />
      <Route path="/sentinel/alerts" element={shell(<SentinelAlerts />, "government")} />
      <Route path="/sentinel/cases/:id" element={shell(<CaseDetail />, "government")} />
      <Route path="/audit" element={shell(<AuditPage />)} />
      <Route path="/settings" element={shell(<SettingsPage />)} />
      <Route path="/unauthorized" element={<Unauthorized />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <AppRouter />
          <Toaster richColors position="top-right" />
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}
