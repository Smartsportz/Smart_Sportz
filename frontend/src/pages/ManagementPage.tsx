import { Page, PortalShell } from "../components/UI";
import { managementSidebar } from "../data/platform";
import { NoticeBuilder } from "./AdminPage";
import { DashboardGrid, MatchControlTable } from "./shared";

export function ManagementPage() {
  return (
    <Page>
      <PortalShell title="Tournament Management" subtitle="Operate assigned tournaments, registrations, matches, players, announcements, and reports." sidebar={managementSidebar}>
        <NoticeBuilder role="manager" />
        <DashboardGrid />
        <MatchControlTable />
      </PortalShell>
    </Page>
  );
}
