import { Navigate, useLocation } from "react-router-dom";
import type React from "react";
import { useAuth, type Role } from "./AuthContext";
import { AccessDeniedPage } from "../pages/AccessDeniedPage";

export function ProtectedRoute({ roles, children }: { roles: Role[]; children: React.ReactNode }) {
  const { isAuthenticated, canAccessRole } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!canAccessRole(roles)) {
    return <AccessDeniedPage allowedRoles={roles} />;
  }

  return <>{children}</>;
}
