import { BarChart3, FileText, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth, type Role } from "../auth/AuthContext";
import { Page, SectionTitle } from "../components/UI";

const roleContent: Record<Role, { title: string; text: string }> = {
  super_admin: {
    title: "Super Admin Programs",
    text: "Platform-wide programs for tournaments, users, roles, payments, CMS, reports, logs, and settings.",
  },
  management: {
    title: "Management User Programs",
    text: "Tournament-specific programs for registrations, players, matches, live score, announcements, and reports.",
  },
  user: {
    title: "Team / Participant Programs",
    text: "Participant programs for registration status, payments, receipts, certificates, schedules, and documents.",
  },
};

export function RoleProgramsPage({ role }: { role: Role }) {
  const { user } = useAuth();
  const content = roleContent[role];
  const programs = user?.programs ?? [];

  return (
    <Page>
      <section className="section">
        <SectionTitle eyebrow="Role Access" title={content.title} text={content.text} />
        <div className="role-program-grid">
          {programs.map((program, index) => {
            const Icon = index % 3 === 0 ? ShieldCheck : index % 3 === 1 ? BarChart3 : FileText;
            return (
              <Link className="panel role-program-card" to={program.path} key={program.permission}>
                <Icon size={24} />
                <h3>{program.label}</h3>
                <p>{program.permission}</p>
              </Link>
            );
          })}
        </div>
      </section>
    </Page>
  );
}
