import { Link } from "react-router-dom";
import { DataTable, Page, PortalShell } from "../components/UI";
import { managementSidebar, newsPosts, registrationQueue, sportHomeVisibility, sports, tournaments, userSidebar } from "../data/platform";
import { DashboardGrid, InfoPanel, MatchControlTable } from "./shared";
import { RichTextToolbarPreview } from "./NewsPages";

const userContent = {
  profile: ["Identity verification", "Captain and player details", "Emergency contact", "Document upload"],
  registrations: ["Approved tournaments", "Pending review", "Payment required", "Waitlisted entries"],
  payments: ["Receipts", "Invoices", "Refunds", "Webhook status"],
  certificates: ["Participation certificates", "Winner certificates", "MVP awards", "Download history"],
  schedules: ["Upcoming fixtures", "Venue reporting time", "Match reminders", "Calendar export"],
  documents: ["Identity documents", "Team roster files", "Medical forms", "Private downloads"],
  settings: ["Theme preference", "Notification channels", "Password policy", "Session devices"],
};

const managementContent = {
  tournaments: ["Assigned tournament setup", "Fixture builder", "Venue allocation", "Official assignments"],
  registrations: ["Team approval queue", "Document review", "Payment checks", "Roster validation"],
  matches: ["Live score control", "Timeline events", "Score correction", "Match closure"],
  players: ["Roster management", "Eligibility status", "Player documents", "Captain updates"],
  announcements: ["Tournament notices", "Team broadcast", "Schedule change alert", "Delivery status"],
  news: ["Create winner-team news", "Upload match update image", "Format article sections", "Publish city-scoped updates"],
  reports: ["Revenue reports", "Registration funnel", "Live score audit", "Export center"],
};

export function UserSectionPage({ section }: { section: keyof typeof userContent }) {
  const title = section.replace("-", " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <Page>
      <PortalShell title={title} subtitle="Participant portal detail page connected from the user dashboard and sidebar." sidebar={userSidebar} action={<Link className="btn btn-primary" to="/user/dashboard">Dashboard</Link>}>
        <DashboardGrid />
        <div className="detail-grid">
          <InfoPanel title={`${title} Workflow`} items={userContent[section]} highlight />
          <InfoPanel title="Related Actions" items={["Open tournament", "View live match", "Download document", "Contact organizer"]} to="/tournaments" />
        </div>
      </PortalShell>
    </Page>
  );
}

export function ManagementSectionPage({ section }: { section: keyof typeof managementContent }) {
  const title = section.replace("-", " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const primaryContent = section === "matches" ? (
    <MatchControlTable />
  ) : section === "registrations" ? (
    <DataTable
      columns={["Team", "Captain", "Members", "Payment", "Action"]}
      rows={registrationQueue.map((item) => [
        item.team,
        item.captain,
        `${item.members} members`,
        item.payment,
        <span className="table-actions"><button>Accept</button><button>Reject</button><Link to="/management/tournaments/bangalore-corporate-t20/bracket">Allocate</Link></span>,
      ])}
    />
  ) : section === "tournaments" ? (
    <DataTable
      columns={["Tournament", "Status", "Cities", "Registration Window", "Team Size", "Action"]}
      rows={tournaments.filter((item) => item.status !== "Completed").map((item) => [
        item.name,
        <span className={`status ${item.accent}`}>{item.status}</span>,
        item.cities.join(", "),
        `${item.registrationStart} - ${item.registrationEnd}`,
        `${item.teamSize} members`,
        <span className="table-actions"><Link to={`/tournaments/${item.slug}`}>Open</Link><Link to={`/management/tournaments/${item.slug}/bracket`}>Bracket</Link></span>,
      ])}
    />
  ) : section === "news" ? (
    <div className="manager-news-layout">
      <section className="panel news-editor-panel">
        <span className="status emerald">Manager News Editor</span>
        <h2>Create or edit news</h2>
        <p>Managers publish only for assigned cities. Rich sections are stored as structured blocks.</p>
        <RichTextToolbarPreview />
        <div className="form-grid">
          <label>Image<select>{newsPosts.map((post) => <option key={post.slug}>{post.image}</option>)}</select></label>
          <label>Category<select><option>Winner Teams</option><option>Match Updates</option><option>Tournament Updates</option><option>Announcements</option></select></label>
          <label>Title<input placeholder="Winner team headline" /></label>
          <label>City<select><option>Bengaluru</option><option>Mysuru</option><option>Mumbai</option></select></label>
          <label>Sport<select>{sports.map((sport) => <option key={sport.slug}>{sport.name}</option>)}</select></label>
          <label>Tournament<select>{tournaments.map((item) => <option key={item.slug}>{item.name}</option>)}</select></label>
        </div>
        <label>Short description<textarea placeholder="Summary shown on news cards" /></label>
        <label>Article section<textarea placeholder="Add heading, paragraph, quote, list, or image block content" /></label>
        <div className="hero-actions"><button className="btn btn-primary">Save Draft</button><button className="btn btn-secondary">Publish</button></div>
      </section>
      <section className="panel">
        <h2>Homepage sport containers</h2>
        <p>Managers choose which sport cards display in the Explore Your Sport section.</p>
        <div className="visibility-list">
          {sportHomeVisibility.map((item) => {
            const sport = sports.find((entry) => entry.slug === item.sportSlug);
            return (
              <label className="visibility-row" key={item.sportSlug}>
                <span>{sport?.name}</span>
                <input type="checkbox" defaultChecked={item.showOnHome} />
              </label>
            );
          })}
        </div>
      </section>
      <DataTable
        columns={["News", "Category", "City", "Status", "Action"]}
        rows={newsPosts.map((post) => [
          post.title,
          post.category,
          post.city,
          <span className="status emerald">{post.status}</span>,
          <span className="table-actions"><Link to={`/news/${post.slug}`}>Open</Link><button>Edit</button></span>,
        ])}
      />
    </div>
  ) : <DashboardGrid />;

  return (
    <Page>
      <PortalShell title={title} subtitle="Management portal section for tournament-specific operations." sidebar={managementSidebar} action={<Link className="btn btn-primary" to="/management/dashboard">Dashboard</Link>}>
        {section === "tournaments" && (
          <section className="panel tournament-create-panel">
            <div>
              <span className="status emerald">Tournament City Setup</span>
              <h2>Allowed registration cities</h2>
              <p>Set one or more cities per assigned tournament. Registration city dropdowns use only the selected tournament city list.</p>
            </div>
            <div className="form-grid">
              <label>Tournament<select>{tournaments.filter((item) => item.status !== "Completed").map((item) => <option key={item.slug}>{item.name}</option>)}</select></label>
              <label>Cities<input placeholder="Bengaluru, Mysuru" /></label>
            </div>
          </section>
        )}
        {primaryContent}
        <div className="detail-grid">
          <InfoPanel title={`${title} Controls`} items={managementContent[section]} highlight />
          <InfoPanel title="Operational Links" items={["Tournament detail", "Live match center", "Bracket allocation", "Audit trail"]} to={section === "registrations" ? "/management/tournaments/bangalore-corporate-t20/bracket" : "/admin/logs"} />
        </div>
      </PortalShell>
    </Page>
  );
}
