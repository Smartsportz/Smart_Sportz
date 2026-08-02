import { AnimatePresence } from "framer-motion";
import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { Footer, PublicHeader } from "./components/UI";
import { ScreenLoader } from "./loading/ScreenLoader";
import { useLoading } from "./loading/LoadingContext";
import {
  AdminPage,
  AdminManagerCreatePage,
  AdminManagerDetailPage,
  AdminRegistrationTeamDetailPage,
  AdminTeamEditPage,
  AdminTournamentEditorPage,
  AdminTournamentPaymentsPage,
  AdminTournamentTeamsPage,
  AdminUserCreatePage,
  AdminUserDetailPage,
  CmsSectionPage,
  ContentPage,
  DiscoveryDetailPage,
  GalleryAlbumPage,
  GalleryPage,
  HomePage,
  LeaderboardsPage,
  LiveHubPage,
  LiveMatchPage,
  LoginPage,
  ManagementPage,
  NewsDetailPage,
  NewsPage,
  RegistrationPaymentPage,
  RegistrationPassPage,
  RegistrationPage,
  RegistrationReviewPage,
  RegistrationRosterPage,
  SettingsPage,
  SportDetailPage,
  SportsPage,
  TeamDetailPage,
  TeamsPage,
  TournamentDetailPage,
  TournamentsPage,
  ManagementSectionPage,
  UserSectionPage,
  UtilityDetailPage,
  UserDashboardPage,
  RoleProgramsPage,
  BracketWorkspacePage,
  TournamentRoundsPage,
} from "./pages";

function ScrollToTop() {
  const { hash, pathname, search } = useLocation();
  const { showFor } = useLoading();

  useEffect(() => {
    function handleInternalNavigation(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      const link = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (!link || link.target || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      const destination = new URL(link.href);
      const current = new URL(window.location.href);
      if (destination.origin !== current.origin || destination.pathname === current.pathname) {
        return;
      }
      showFor(1300);
    }

    document.addEventListener("click", handleInternalNavigation, true);
    return () => document.removeEventListener("click", handleInternalNavigation, true);
  }, [showFor]);

  useEffect(() => {
    if (hash) {
      window.requestAnimationFrame(() => {
        document.getElementById(hash.slice(1))?.scrollIntoView({ block: "start" });
      });
    } else {
      window.scrollTo(0, 0);
    }
    (window as any).gtag?.("config", "G-YFZSW0TZP1", {
      page_path: `${pathname}${search}${hash}`,
    });
    showFor(window.location.search.includes("loading=1") ? 3000 : 1200);
  }, [hash, pathname, search]);

  return null;
}

export default function App() {
  const location = useLocation();
  const isPortal = location.pathname.startsWith("/admin") || location.pathname.startsWith("/management") || location.pathname.startsWith("/user");

  useEffect(() => {
    document.documentElement.classList.remove("dark");
    localStorage.setItem("smart-sportz-theme", "light");
  }, []);

  return (
    <div className={`app-shell ${isPortal ? "portal-app-shell" : "public-shell"}`}>
      <ScrollToTop />
      <ScreenLoader />
      {!isPortal && <PublicHeader />}
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<HomePage />} />
          <Route path="/tournaments" element={<TournamentsPage />} />
          <Route path="/tournaments/:slug" element={<TournamentDetailPage />} />
          <Route path="/tournaments/:slug/rounds" element={<TournamentRoundsPage />} />
          <Route path="/tournaments/:slug/register" element={<ProtectedRoute roles={["user"]}><RegistrationPage /></ProtectedRoute>} />
          <Route path="/tournaments/:slug/register/roster" element={<ProtectedRoute roles={["user"]}><RegistrationRosterPage /></ProtectedRoute>} />
          <Route path="/tournaments/:slug/register/payment" element={<ProtectedRoute roles={["user"]}><RegistrationPaymentPage /></ProtectedRoute>} />
          <Route path="/tournaments/:slug/register/review" element={<ProtectedRoute roles={["user"]}><RegistrationReviewPage /></ProtectedRoute>} />
          <Route path="/tournaments/:slug/registration-pass" element={<ProtectedRoute roles={["user"]}><RegistrationPassPage /></ProtectedRoute>} />
          <Route path="/registration/:id/payment" element={<ProtectedRoute roles={["user"]}><RegistrationPaymentPage /></ProtectedRoute>} />
          <Route path="/payments/:id/receipt" element={<ProtectedRoute roles={["user", "super_admin"]}><UtilityDetailPage type="payment" /></ProtectedRoute>} />
          <Route path="/sports" element={<SportsPage />} />
          <Route path="/sports/:slug" element={<SportDetailPage />} />
          <Route path="/discover/:slug" element={<DiscoveryDetailPage />} />
          <Route path="/live" element={<LiveHubPage />} />
          <Route path="/live/:matchId" element={<LiveMatchPage />} />
          <Route path="/leaderboards" element={<LeaderboardsPage />} />
          <Route path="/teams" element={<TeamsPage />} />
          <Route path="/teams/:slug" element={<TeamDetailPage />} />
          <Route path="/athletes/:slug" element={<AdminPage section="players" />} />
          <Route path="/gallery" element={<GalleryPage />} />
          <Route path="/gallery/:slug" element={<GalleryAlbumPage />} />
          <Route path="/news" element={<NewsPage />} />
          <Route path="/news/:slug" element={<NewsDetailPage />} />
          <Route path="/blog" element={<Navigate to="/news" replace />} />
          <Route path="/blog/:slug" element={<NewsDetailPage />} />
          <Route path="/about" element={<ContentPage type="about" />} />
          <Route path="/contact" element={<ContentPage type="contact" />} />
          <Route path="/sponsors" element={<ContentPage type="sponsors" />} />
          <Route path="/faq" element={<ContentPage type="faq" />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<LoginPage recovery />} />
          <Route path="/otp" element={<LoginPage recovery />} />
          <Route path="/reset-password" element={<LoginPage recovery />} />
          <Route path="/participant" element={<Navigate to="/participant/programs" replace />} />
          <Route path="/participant/programs" element={<ProtectedRoute roles={["user"]}><RoleProgramsPage role="user" /></ProtectedRoute>} />
          <Route path="/participant/*" element={<Navigate to="/user/dashboard" replace />} />
          <Route path="/user/profile" element={<ProtectedRoute roles={["user"]}><UserSectionPage section="profile" /></ProtectedRoute>} />
          <Route path="/user/registrations" element={<ProtectedRoute roles={["user"]}><UserSectionPage section="registrations" /></ProtectedRoute>} />
          <Route path="/user/payments" element={<ProtectedRoute roles={["user"]}><UserSectionPage section="payments" /></ProtectedRoute>} />
          <Route path="/user/members" element={<ProtectedRoute roles={["user"]}><UserSectionPage section="members" /></ProtectedRoute>} />
          <Route path="/user/certificates" element={<ProtectedRoute roles={["user"]}><UserSectionPage section="certificates" /></ProtectedRoute>} />
          <Route path="/user/schedules" element={<ProtectedRoute roles={["user"]}><UserSectionPage section="schedules" /></ProtectedRoute>} />
          <Route path="/user/documents" element={<ProtectedRoute roles={["user"]}><UserSectionPage section="documents" /></ProtectedRoute>} />
          <Route path="/user/settings" element={<ProtectedRoute roles={["user"]}><SettingsPage /></ProtectedRoute>} />
          <Route path="/user/*" element={<ProtectedRoute roles={["user"]}><UserDashboardPage /></ProtectedRoute>} />
          <Route path="/management/programs" element={<ProtectedRoute roles={["management"]}><RoleProgramsPage role="management" /></ProtectedRoute>} />
          <Route path="/management/tournaments" element={<ProtectedRoute roles={["management", "super_admin"]}><ManagementSectionPage section="tournaments" /></ProtectedRoute>} />
          <Route path="/management/registrations" element={<ProtectedRoute roles={["management", "super_admin"]}><ManagementSectionPage section="registrations" /></ProtectedRoute>} />
          <Route path="/management/matches" element={<ProtectedRoute roles={["management", "super_admin"]}><ManagementSectionPage section="matches" /></ProtectedRoute>} />
          <Route path="/management/players" element={<ProtectedRoute roles={["management", "super_admin"]}><ManagementSectionPage section="players" /></ProtectedRoute>} />
          <Route path="/management/announcements" element={<ProtectedRoute roles={["management", "super_admin"]}><ManagementSectionPage section="announcements" /></ProtectedRoute>} />
          <Route path="/management/news" element={<ProtectedRoute roles={["management", "super_admin"]}><ManagementSectionPage section="news" /></ProtectedRoute>} />
          <Route path="/management/reports" element={<ProtectedRoute roles={["management", "super_admin"]}><ManagementSectionPage section="reports" /></ProtectedRoute>} />
          <Route path="/management/matches/:id/control" element={<ProtectedRoute roles={["management", "super_admin"]}><LiveMatchPage /></ProtectedRoute>} />
          <Route path="/management/tournaments/:slug/bracket" element={<ProtectedRoute roles={["management", "super_admin"]}><BracketWorkspacePage /></ProtectedRoute>} />
          <Route path="/management/*" element={<ProtectedRoute roles={["management", "super_admin"]}><ManagementPage /></ProtectedRoute>} />
          <Route path="/super-admin" element={<Navigate to="/super-admin/programs" replace />} />
          <Route path="/super-admin/programs" element={<ProtectedRoute roles={["super_admin"]}><RoleProgramsPage role="super_admin" /></ProtectedRoute>} />
          <Route path="/super-admin/*" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="/admin/dashboard" element={<ProtectedRoute roles={["super_admin"]}><AdminPage /></ProtectedRoute>} />
          <Route path="/admin/tournaments/new" element={<ProtectedRoute roles={["super_admin"]}><AdminTournamentEditorPage /></ProtectedRoute>} />
          <Route path="/admin/tournaments/:slug/edit" element={<ProtectedRoute roles={["super_admin"]}><AdminTournamentEditorPage /></ProtectedRoute>} />
          <Route path="/admin/tournaments" element={<ProtectedRoute roles={["super_admin"]}><AdminPage section="tournaments" /></ProtectedRoute>} />
          <Route path="/admin/users/add" element={<ProtectedRoute roles={["super_admin"]}><AdminUserCreatePage /></ProtectedRoute>} />
          <Route path="/admin/users/:id" element={<ProtectedRoute roles={["super_admin"]}><AdminUserDetailPage /></ProtectedRoute>} />
          <Route path="/admin/users" element={<ProtectedRoute roles={["super_admin"]}><AdminPage section="users" /></ProtectedRoute>} />
          <Route path="/admin/managers/new" element={<ProtectedRoute roles={["super_admin"]}><AdminManagerCreatePage /></ProtectedRoute>} />
          <Route path="/admin/managers/:id" element={<ProtectedRoute roles={["super_admin"]}><AdminManagerDetailPage /></ProtectedRoute>} />
          <Route path="/admin/managers" element={<ProtectedRoute roles={["super_admin"]}><AdminPage section="managers" /></ProtectedRoute>} />
          <Route path="/admin/roles" element={<ProtectedRoute roles={["super_admin"]}><AdminPage section="roles" /></ProtectedRoute>} />
          <Route path="/admin/teams/:id/edit" element={<ProtectedRoute roles={["super_admin"]}><AdminTeamEditPage /></ProtectedRoute>} />
          <Route path="/admin/teams/tournament/:slug" element={<ProtectedRoute roles={["super_admin"]}><AdminTournamentTeamsPage /></ProtectedRoute>} />
          <Route path="/admin/teams/registrations/:id" element={<ProtectedRoute roles={["super_admin"]}><AdminRegistrationTeamDetailPage /></ProtectedRoute>} />
          <Route path="/admin/teams" element={<ProtectedRoute roles={["super_admin"]}><AdminPage section="teams" /></ProtectedRoute>} />
          <Route path="/admin/players" element={<ProtectedRoute roles={["super_admin"]}><AdminPage section="players" /></ProtectedRoute>} />
          <Route path="/admin/payments/tournament/:slug" element={<ProtectedRoute roles={["super_admin"]}><AdminTournamentPaymentsPage /></ProtectedRoute>} />
          <Route path="/admin/payments" element={<ProtectedRoute roles={["super_admin"]}><AdminPage section="payments" /></ProtectedRoute>} />
          <Route path="/admin/payments/operations" element={<ProtectedRoute roles={["super_admin"]}><UtilityDetailPage type="admin-payments" /></ProtectedRoute>} />
          <Route path="/admin/cms" element={<ProtectedRoute roles={["super_admin"]}><AdminPage section="cms" /></ProtectedRoute>} />
          <Route path="/admin/cms/:section" element={<ProtectedRoute roles={["super_admin"]}><CmsSectionPage /></ProtectedRoute>} />
          <Route path="/admin/reports" element={<ProtectedRoute roles={["super_admin"]}><AdminPage section="reports" /></ProtectedRoute>} />
          <Route path="/admin/reports/detail" element={<ProtectedRoute roles={["super_admin"]}><UtilityDetailPage type="admin-reports" /></ProtectedRoute>} />
          <Route path="/admin/logs" element={<ProtectedRoute roles={["super_admin"]}><AdminPage section="logs" /></ProtectedRoute>} />
          <Route path="/admin/logs/detail" element={<ProtectedRoute roles={["super_admin"]}><UtilityDetailPage type="admin-logs" /></ProtectedRoute>} />
          <Route path="/admin/settings" element={<ProtectedRoute roles={["super_admin"]}><SettingsPage /></ProtectedRoute>} />
          <Route path="/live-ops/*" element={<ProtectedRoute roles={["management", "super_admin"]}><LiveMatchPage /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute roles={["super_admin", "management", "user"]}><SettingsPage /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AnimatePresence>
      {!isPortal && <Footer />}
    </div>
  );
}
