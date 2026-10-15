import { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth, entryFor } from "@/context/AuthContext";
import { Loader } from "@/components/Shared";

export function ProtectedRoute({ role, children }) {
  const { user, loading, refresh } = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (!loading) {
      refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  if (loading) return <Loader label="Checking your session…" />;
  if (!user) return <Navigate to={role === "business" ? "/business" : role === "government" ? "/government" : entryFor(location.pathname)} replace state={{ from: location.pathname + location.search }} />;
  if (role && !user.roles.includes(role)) return <Navigate to="/unauthorized" replace state={{ role }} />;
  return children;
}
