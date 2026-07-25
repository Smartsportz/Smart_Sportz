import { ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth, type Role } from "../auth/AuthContext";
import { Page } from "../components/UI";

const labels: Record<Role, string> = {
  super_admin: "Super Admin",
  management: "Management User",
  user: "Team / Participant",
};

export function AccessDeniedPage({ allowedRoles }: { allowedRoles: Role[] }) {
  const { user, logout } = useAuth();

  return (
    <Page className="auth-page">
      <div className="panel access-panel">
        <ShieldCheck size={34} />
        <p className="eyebrow">RBAC Protected Area</p>
        <h1>Access denied</h1>
        <p>
          This page is protected for {allowedRoles.map((role) => labels[role]).join(", ")} access.
          {user ? ` You are logged in as ${user.roleLabel}.` : " Please login with the correct role."}
        </p>
        <div className="hero-actions">
          <Link className="btn btn-primary" to={user?.homePath ?? "/login"}>Open my dashboard</Link>
          <button className="btn btn-secondary" type="button" onClick={logout}>Logout</button>
        </div>
      </div>
    </Page>
  );
}
