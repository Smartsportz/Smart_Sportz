from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

from build_phase1_docx import p, rich_callout, style_xml, table
from build_phase2_docx import image_paragraph
from build_phase9_docx import (
    NS_A,
    NS_PIC,
    NS_R,
    NS_W,
    NS_WP,
    app_xml,
    content_types_xml,
    font_table_xml,
    numbering_xml,
    root_rels_xml,
    sect_pr,
    settings_xml,
)


OUT = Path("docs/Smart_Sportz_Frontend_Master_Pages_Workflows_Specification.docx")
ASSET_DIR = Path("docs/assets")


def bullets(items: list[str]) -> list[str]:
    return [p(item, num_id=1) for item in items]


def document_xml() -> str:
    body: list[str] = []

    body.append(p("SMART SPORTZ - FRONTEND MASTER SPECIFICATION", style="Title"))
    body.append(p("", style="Subtitle"))
    body.append(p("Pages, Workflows, UI Architecture & Experience Blueprint", style="Subtitle"))
    body.append(p("Consolidated from Phases 1-11", style="Heading2"))
    body.append(p(""))
    body.append(table([
        ["Document", "Frontend Master Pages and Workflows Specification"],
        ["Project", "Smart Sportz"],
        ["Source Phases", "Phase 1 Foundation, Phase 2 Design System, Phase 3 Public Website, Phase 4 Registration and Payment, Phase 5 Super Admin Portal, Phase 6 Management Portal, Phase 7 Live Score, Phase 8 Backend APIs, Phase 9 Database, Phase 10 Frontend Architecture, Phase 11 DevOps"],
        ["Frontend Scope", "Public website, landing page, authentication, registration, payment, Super Admin Portal, Management User Portal, live score experience, CMS, reports, notifications, shared components, page states, workflows, routes, and production frontend behavior"],
        ["Reference Style", "Same compact spacing, alignment, borders, margins, and black document treatment as the approved phase documents"],
        ["Date", "July 5, 2026"],
        ["Version", "1.0"],
    ], [2400, 6960], header=False, fill="FFFFFF"))
    body.append(p(""))
    body.append(rich_callout("Frontend Master Intent", [
        "This document collects the frontend-facing requirements from all Smart Sportz phases into one implementation-ready experience specification.",
        "It defines pages, layouts, workflows, user states, components, data behavior, real-time interactions, and operational UX expectations for the React application without implementing the code."
    ]))

    body.append(p("1. Frontend Product Scope", style="Heading1"))
    body.append(p("The frontend is a multi-role React application for tournament discovery, registration, payment, live scoring, administration, tournament operations, reporting, and CMS-driven content."))
    body.extend(bullets([
        "Public visitors discover tournaments, view live scores, register teams or players, pay fees, and consume content.",
        "Super Admin users configure organizations, tournaments, users, permissions, finance, CMS, notifications, reports, and audit review.",
        "Management users operate assigned tournaments, verify participants, manage fixtures, control live matches, publish results, and send announcements.",
        "The same design system, component library, authentication model, page-state system, and API/service layer should support every experience.",
    ]))

    body.append(p("2. Phase-to-Frontend Reference Map", style="Heading1"))
    body.append(table([
        ["Phase", "Frontend Meaning"],
        ["1 Foundation", "Defines product roles, modules, enterprise SaaS expectations, target users, and quality bar."],
        ["2 Design System", "Defines premium SaaS visual language, typography, spacing, responsive behavior, component quality, and landing page direction."],
        ["3 Public Website", "Defines public information architecture, tournament discovery, live scores, results, content pages, SEO, and public UX."],
        ["4 Registration and Payment", "Defines team/player registration, document upload, Razorpay checkout, approval, refund, receipt, invoice, and notifications."],
        ["5 Super Admin", "Defines admin shell, dashboard, tables, forms, RBAC, tournaments, finance, CMS, reports, audit logs, and settings."],
        ["6 Management Portal", "Defines role-scoped tournament operations, assigned access, match control, player verification, announcements, reports, and live score operations."],
        ["7 Live Score", "Defines event-driven scoring UX, match lifecycle, sport-specific scoring controls, corrections, timelines, commentary, statistics, and Socket.IO updates."],
        ["8 Backend APIs", "Defines frontend service boundaries, REST API integration, auth, validation, Socket.IO, storage, payments, notifications, jobs, logging, and API errors."],
        ["9 Database", "Defines data domains that drive frontend screens: users, roles, tournaments, teams, players, matches, events, payments, CMS, reports, and audit logs."],
        ["10 Frontend Architecture", "Defines React, Vite, TypeScript, Tailwind, Redux Toolkit, TanStack Query, Socket.IO client, components, forms, tables, accessibility, and testing."],
        ["11 DevOps", "Defines environment-aware frontend configuration, CI/CD, Docker/Nginx delivery, monitoring hooks, health behavior, and release readiness."],
    ], [2200, 7160]))

    body.append(p("3. Frontend Experience Architecture", style="Heading1"))
    body.append(p("The application should be organized into five major experience zones connected by shared platform services: public website, registration/payment, Super Admin Portal, Management Portal, and live match center."))
    body.append(image_paragraph("rIdImage1", "Smart Sportz Frontend Experience Map", "Smart Sportz frontend experience map diagram", 1))

    body.append(p("4. Layouts and Route Groups", style="Heading1"))
    body.append(table([
        ["Layout", "Routes and Responsibilities"],
        ["Public Layout", "/, /live, /tournaments, /sports, /results, /gallery, /blogs, /faqs, /contact, /register. Includes sticky navigation, global search, footer, newsletter, SEO metadata, and public CTAs."],
        ["Auth Layout", "/login, /forgot-password, /otp, /reset-password. Minimal distraction, validation-first forms, remembered destination, auth errors, and refresh-token recovery."],
        ["Super Admin Layout", "/admin/* shell with sidebar, top bar, breadcrumbs, command palette, notifications, global search, quick actions, table-first screens, and audit-aware actions."],
        ["Management Layout", "/management/* shell with tournament switcher, connection status, live match status, assigned navigation, quick match controls, and mobile/tablet-friendly operations."],
        ["Live Layout", "/live and /live/:matchId for public scoreboards, timelines, commentary, statistics, standings, and low-latency updates."],
    ], [2300, 7060]))

    body.append(p("5. Public Website Pages", style="Heading1"))
    body.append(table([
        ["Page", "Required Content and Actions"],
        ["Home / Landing", "Premium hero, live tournament band, sponsors, statistics, upcoming tournaments, sports categories, gallery, testimonials, CTA, footer."],
        ["Tournament Listing", "Search, filters by sport/status/date/location, cards/table toggle, live/upcoming/completed tabs, pagination, empty state."],
        ["Tournament Detail", "Overview, schedule, registration CTA, fees, rules, venue, teams, players, fixtures, live matches, sponsors, gallery, FAQs."],
        ["Live Tournaments", "Live match cards, score summaries, timers, status indicators, sport filters, public share links."],
        ["Live Match Detail", "Scoreboard, teams, period/overs/sets, timeline, commentary, player stats, possession/events, connection status."],
        ["Results and Leaderboards", "Completed matches, standings, ranks, points table, filters, export/share where public."],
        ["Sports, Teams, Players", "Discovery pages that expose sport rules, teams, player profiles, achievements, statistics, and public registration links."],
        ["Gallery, Sponsors, Blogs, FAQs", "CMS-managed content with SEO metadata, responsive media, related content, and sponsor visibility."],
        ["Contact and Policies", "Contact form, maps/venue info, support links, privacy policy, terms, refund policy, and tournament rules."],
    ], [2300, 7060]))

    body.append(p("6. Landing Page Section Blueprint", style="Heading1"))
    body.append(p("The landing page should feel premium and sports-tech focused while remaining fast, responsive, and actionable. It should include enough content density to communicate scale without becoming a marketing-only page."))
    body.extend(bullets([
        "First viewport: Smart Sportz brand, strong tournament-management positioning, primary registration/discovery CTA, live signal, and visual tournament context.",
        "Core sections: live tournaments, upcoming events, statistics, sports, sponsors, gallery, testimonials, platform capabilities, management tools, registration/payment trust, live score experience, and final CTA.",
        "Utility sections: FAQs, blogs/news, newsletter, contact, footer links, policy links, and app-wide search.",
        "States: loading skeletons for live bands, empty states for no live tournaments, error fallback for public feed failure, and graceful mobile stacking.",
    ]))

    body.append(p("7. Registration and Payment Workflow", style="Heading1"))
    body.append(p("Registration must support individual, team, and hybrid modes, including documents, validation, payment, approval, waitlist, refunds, receipts, and notifications."))
    body.append(image_paragraph("rIdImage2", "Public Registration and Payment Workflow", "Public registration and payment workflow diagram", 2))
    body.append(table([
        ["Step", "Frontend Requirement"],
        ["Discover Tournament", "Show eligibility, categories, fees, available slots, deadlines, venue, rules, and registration status."],
        ["Choose Mode", "Individual, team, or hybrid registration with tournament-specific dynamic fields."],
        ["Enter Details", "React Hook Form with Zod validation, player arrays, captain/contact details, document upload, terms acceptance."],
        ["Apply Coupon", "Validate coupon, show discount, prevent invalid combinations, update payable amount."],
        ["Pay Online", "Razorpay checkout, payment pending state, success/failure handling, retry, receipt/invoice download."],
        ["Approval", "Show pending, approved, rejected, waitlisted, refunded, or verification-required status."],
        ["Notifications", "Email, SMS, WhatsApp, push, and in-app notifications for status changes."],
    ], [2300, 7060]))

    body.append(p("8. Authentication and Account Pages", style="Heading1"))
    body.append(table([
        ["Page / State", "Behavior"],
        ["Login", "Email/phone login, password, remember me, validation, loading state, bad credential state, account disabled state."],
        ["Forgot Password", "Request reset, throttle feedback, neutral success message, email/SMS delivery state."],
        ["OTP / Verification", "Code entry, resend timer, paste handling, failure count, expiry handling."],
        ["Reset Password", "Password policy, confirmation, expired token handling, success redirect."],
        ["Session Recovery", "JWT refresh token flow, silent refresh, logout on invalid refresh, remembered destination."],
        ["RBAC Handling", "Route guard, forbidden page, immediate permission revocation handling, scoped navigation visibility."],
    ], [2300, 7060]))

    body.append(p("9. Super Admin Portal Pages", style="Heading1"))
    body.append(table([
        ["Area", "Pages and UI Expectations"],
        ["Dashboard", "KPIs, revenue, tournament activity, registrations, live matches, alerts, quick actions, charts."],
        ["Organizations and Users", "Organization list/detail, users, roles, permissions, RBAC assignment, sessions, status, audit log."],
        ["Tournament Management", "Tournament list/detail, create/edit wizard, categories, stages, rules, fixtures, teams, players, announcements."],
        ["Sports and Venues", "Sports, sport rules, categories, venues, courts/areas, equipment, availability."],
        ["Registration Control", "Registrations, verification queue, documents, approvals, waitlist, coupon usage."],
        ["Finance", "Payments, refunds, invoices, receipts, Razorpay status, settlement-style reports, export."],
        ["CMS", "Homepage builder, sponsors, gallery, blogs, FAQs, pages, content status, preview/publish."],
        ["Notifications", "Templates, queues, campaigns, delivery logs, SMS/email/WhatsApp/push status."],
        ["Reports and Audit", "Revenue, participation, venue utilization, player/team reports, audit log search, exports."],
        ["Settings", "Platform settings, branding, integrations, security policies, environment-aware configuration display."],
    ], [2300, 7060]))

    body.append(p("10. Management User Portal Pages", style="Heading1"))
    body.append(table([
        ["Page", "Required Behavior"],
        ["Dashboard", "Assigned tournaments, live match status, pending verifications, today fixtures, announcements, activity feed."],
        ["Tournament Switcher", "Only assigned tournaments; switching updates route scope, query keys, permissions, and navigation."],
        ["Matches and Fixtures", "Fixture list, match detail, check-in, lineup, officials, schedule changes, match status transitions."],
        ["Live Score Control", "Sport-specific scoring controls, timer, period/overs/sets, cards/fouls/points, correction flow, connection status."],
        ["Teams and Players", "Team verification, player documents, roster management, status updates, eligibility checks."],
        ["Announcements", "Create announcements, target tournament/team/public audiences, schedule/publish, delivery status."],
        ["Results", "Confirm results, standings, leaderboards, correction request flow, publish to public site."],
        ["Reports", "Assigned tournament reports, exports, participation, match completion, activity logs."],
        ["Profile", "User profile, password/security, notification preferences, assigned permissions view."],
    ], [2300, 7060]))

    body.append(p("11. Admin and Management Workflow Map", style="Heading1"))
    body.append(p("The frontend should clearly separate Super Admin configuration from Management User operations. Super Admin defines the system; Management Users execute scoped tournament work."))
    body.append(image_paragraph("rIdImage3", "Admin and Management Operations Workflow", "Admin and management operations workflow diagram", 3))

    body.append(p("12. Live Score Frontend Workflow", style="Heading1"))
    body.append(p("Live scoring must feel venue-ready: fast, clear, tablet-friendly, permission-aware, resilient to reconnects, and transparent when score corrections occur."))
    body.append(image_paragraph("rIdImage4", "Live Score Frontend Workflow", "Live score frontend workflow diagram", 4))
    body.append(table([
        ["Live Score Area", "Frontend Requirement"],
        ["Match Lifecycle", "Scheduled, check-in, ready, live, paused, delayed, interrupted, completed, cancelled states."],
        ["Sport Adapters", "Controls adapt for cricket, football, basketball, volleyball, tennis, badminton, chess, athletics, and future sports."],
        ["Event Timeline", "Goals, wickets, fouls, cards, points, sets, substitutions, timeouts, commentary, corrections."],
        ["Correction Flow", "Authorized correction, mandatory reason, before/after preview, audit log, public update."],
        ["Public Broadcast", "Socket.IO updates for scoreboards, timelines, standings, statistics, and match cards."],
        ["Recovery", "Connection status, reconnect, pending action feedback, retry queue where offline support is enabled."],
    ], [2300, 7060]))

    body.append(p("13. Frontend State and Data Architecture", style="Heading1"))
    body.append(p("Separate UI state, server state, and real-time state so the application remains predictable and scalable."))
    body.append(image_paragraph("rIdImage5", "Frontend State and Data Architecture", "Frontend state and data architecture diagram", 5))
    body.append(table([
        ["State Type", "Owner"],
        ["Server Data", "TanStack Query for tournaments, teams, players, matches, payments, reports, CMS, notifications, and audit lists."],
        ["Client App State", "Redux Toolkit for auth profile, theme, notifications, command palette, selected tournament, selected live match."],
        ["Real-Time State", "Socket.IO provider and hooks for live match rooms, tournament feeds, and notifications."],
        ["Forms", "React Hook Form and Zod with shared field components, autosave where needed, dynamic arrays, file upload support."],
        ["Services", "Typed API modules for resources, uploads, exports, payments, auth, notifications, and reports."],
    ], [2300, 7060]))

    body.append(p("14. Route Guards and Page States", style="Heading1"))
    body.append(p("Every route must resolve authentication, permissions, assigned scope, data loading, empty states, and recovery behavior in a consistent way."))
    body.append(image_paragraph("rIdImage6", "Route Guards and Page State Model", "Route guards and page state model diagram", 6))
    body.extend(bullets([
        "Public routes should remain accessible while protected actions redirect to login with remembered destination.",
        "Admin routes require Super Admin permissions and feature-level action permissions.",
        "Management routes require assigned tournament, venue, sport, module, and action scope.",
        "Every table/form/detail page needs loading, empty, success, validation error, network error, forbidden, unauthorized, and retry states.",
    ]))

    body.append(p("15. Shared Component Library", style="Heading1"))
    body.append(table([
        ["Component Group", "Components and Expectations"],
        ["Core UI", "Button, Input, TextArea, Select, MultiSelect, Checkbox, Radio, Switch, Avatar, Badge, Chip, Tooltip, Dropdown."],
        ["Overlays and Navigation", "Tabs, Accordion, Modal, Drawer, Pagination, Breadcrumb, Command Palette, Toast Notifications."],
        ["Data Display", "Statistic card, revenue card, tournament card, live match card, activity feed, calendar widget, leaderboard widget."],
        ["Feedback", "Skeleton loader, loading spinner, empty state, error state, retry panel, forbidden page, offline/reconnect state."],
        ["Forms and Files", "Date picker, time picker, file upload, image preview, progress, retry, remove, document validation."],
        ["Tables", "Server pagination, sorting, filtering, search, column visibility, row selection, bulk actions, export, responsive layout."],
        ["Quality", "Variants, sizes, disabled/loading states, keyboard navigation, ARIA where needed, dark mode, responsive sizing."],
    ], [2300, 7060]))

    body.append(p("16. CMS and Content Workflows", style="Heading1"))
    body.append(table([
        ["CMS Area", "Frontend Workflow"],
        ["Homepage Builder", "Section reorder, content editing, preview, publish, validation, SEO fields."],
        ["Sponsors", "Logo upload, sponsor tier, link, active dates, tournament association, public visibility."],
        ["Gallery", "Image upload, captions, categories, featured state, responsive public gallery."],
        ["Blogs and FAQs", "Create/edit, tags, slug, SEO metadata, publish workflow, empty and preview states."],
        ["Announcements", "Audience selection, scheduling, publish status, delivery logs, public and portal rendering."],
    ], [2300, 7060]))

    body.append(p("17. Notifications and Real-Time UX", style="Heading1"))
    body.extend(bullets([
        "Global notification center should show registration status, payment events, match updates, announcements, admin alerts, and system messages.",
        "Toast notifications should communicate immediate action feedback without hiding important workflow state.",
        "Connection status should be visible on management/live score screens and non-intrusive on public screens.",
        "Socket hooks should support live match, tournament feed, and user notification rooms with automatic reconnect.",
    ]))

    body.append(p("18. Responsive, Accessibility, SEO, and Performance Rules", style="Heading1"))
    body.append(table([
        ["Area", "Requirement"],
        ["Responsive", "Mobile, tablet, desktop, and large display layouts. Live score and management screens must be comfortable on tablets used at venues."],
        ["Accessibility", "Semantic HTML, keyboard navigation, focus management, contrast, screen reader support, accessible custom components."],
        ["SEO", "Public pages require metadata, canonical URLs, structured content, fast loading, readable public routes, and social share previews."],
        ["Performance", "Route-based code splitting, lazy heavy charts/calendars/tables, image optimization, virtualized long lists, memoization where useful."],
        ["Error UX", "Friendly user messages, retry actions, support context, technical logging through the backend/frontend logging strategy."],
    ], [2300, 7060]))

    body.append(p("19. Testing and Delivery Expectations", style="Heading1"))
    body.extend(bullets([
        "Unit test reusable UI components, hooks, validators, reducers, and utilities.",
        "Integration test authentication, registration, payment, admin table actions, management score workflows, and CMS publishing.",
        "End-to-end test visitor registration, Razorpay success/failure, admin approval, public live score viewing, management score update, and permission denial.",
        "Frontend CI should run install, lint, type check, tests, build, security scan, staging deploy, smoke tests, and production approval flow.",
    ]))

    body.append(p("20. Implementation Rules for AI Coding", style="Heading1"))
    body.extend(bullets([
        "Build actual pages and workflows, not a marketing-only shell.",
        "Use React, Vite, TypeScript, Tailwind, Redux Toolkit, TanStack Query, React Hook Form, Zod, Framer Motion, Lucide React, TanStack Table, Recharts, Sonner, dnd-kit, and Socket.IO Client.",
        "Keep business logic out of presentational components and route pages.",
        "Use feature-based organization with shared components, services, types, hooks, providers, sockets, constants, utils, and styles.",
        "Use typed service modules and do not hard-code endpoint behavior inside UI components.",
        "Use RBAC-aware navigation, route guards, scoped queries, and immediate revocation handling.",
        "No page should ship without loading, empty, success, error, forbidden/unauthorized where relevant, and retry states.",
        "Use the design-system tokens and compact operational UI patterns from the phase documents.",
    ]))

    body.append(p("21. Tournament Registration, Sport Discovery, and Bracket Workspace Addendum", style="Heading1"))
    body.append(p("This addendum updates the frontend master plan with sport-specific tournament discovery, a stronger registration wizard, live and completed tournament detail behavior, manager registration approval, and a bracket allocation workspace based on real tournament management product patterns. Research references include Challonge for signup pages, roster management, seeding, brackets, and match chat; Toornament for single/double elimination, round-robin, league, Swiss, and custom brackets; and LeagueRepublic for automatic match creation as teams progress through tournament rounds."))
    body.append(table([
        ["Reference", "Pattern to Apply in Smart Sportz"],
        ["Challonge", "Use signup pages, roster management, seeding, bracket visibility, and match-level communication patterns as product references."],
        ["Toornament", "Support multiple tournament structures such as single elimination, double elimination, round-robin, league, Swiss, and custom brackets."],
        ["LeagueRepublic", "Allow tournament matches to be generated as teams progress, with manager control over schedule, winner/replay, and round changes."],
    ], [2200, 7160]))

    body.append(p("21.1 Updated Registration Wizard", style="Heading2"))
    body.append(p("Team tournament registration must add a new Team Member Details step immediately after Team Details. This keeps team identity and member identity separate, improves review quality for managers, and prepares the platform for sport-specific member validation later."))
    body.append(image_paragraph("rIdImage7", "Registration Wizard Team Member Step", "Registration wizard with new team member details step", 7))
    body.append(table([
        ["Step Order", "Step Name", "Frontend Requirement"],
        ["1", "Team Details", "Team name, logo, sport, category, city/location, captain contact, and basic eligibility fields."],
        ["2", "Team Member Details", "Captain name and team member names are required for team registrations. Optional future fields: member role, jersey number, phone/email, document status, and player category."],
        ["3", "Roster / Documents", "Player list review, verification files, identity documents, waiver/terms acceptance, and upload status."],
        ["4", "Payment", "Fee summary, coupon/discount where enabled, payment or local payment state, receipt/invoice preview."],
        ["5", "Review", "Final review, registration status, submitted summary, and next steps."],
    ], [1200, 2200, 5960]))
    body.extend(bullets([
        "The Team Member Details step should support adding/removing members before submission.",
        "Validation should prevent empty captain name and empty member names for team tournament registration.",
        "The review page should display team details and member details as separate sections.",
    ]))

    body.append(p("21.2 Sport-Specific Tournament Discovery", style="Heading2"))
    body.append(p("When a user selects a sport from the Sports menu, the application must show only tournaments for the selected sport. It must not mix all-sport tournament cards on the selected sport page. The selected sport tournament page must group tournaments by status in a predictable order."))
    body.append(image_paragraph("rIdImage8", "Sport Specific Tournament Sections", "Selected sport tournament page grouped by upcoming live and existing tournaments", 8))
    body.append(table([
        ["Section Order", "Section", "Behavior"],
        ["1", "Upcoming Tournaments", "Display upcoming/open-registration tournaments for the selected sport first. Cards open the upcoming tournament detail page with registration CTA."],
        ["2", "Live Tournaments", "Display active tournaments for the selected sport. Cards open the live tournament detail page with live video, score, team-wise individual scores, timing, highlights, records, and rounds."],
        ["3", "Existing / Completed Tournaments", "Display completed or historical tournaments for the selected sport. Cards open historical tournament detail with archived rounds, match/player score details, winners, highlights, and downloadable records."],
    ], [1500, 2500, 5360]))
    body.extend(bullets([
        "The Sports page card action should be View Tournament and route to the selected sport tournament listing page.",
        "A selected sport page should keep sport context visible through heading, breadcrumbs, filters, and empty states.",
        "If a sport has no tournaments in a status group, show a compact empty state for that group rather than hiding the entire sport page.",
    ]))

    body.append(p("21.3 Tournament Detail Behavior by Status", style="Heading2"))
    body.append(image_paragraph("rIdImage9", "Tournament Detail Status Model", "Upcoming live and existing tournament detail page model with rounds button", 9))
    body.append(table([
        ["Tournament Status", "Detail Page Requirements"],
        ["Upcoming", "Show tournament overview, rules, venue, schedule, team capacity, prize, registration status, eligibility, sponsors, FAQs, and a Register button that opens the registration wizard."],
        ["Live", "Show live video area, team score, individual scores separated team-wise, timing, live match status, highlights, score history, commentary/timeline, statistics, records, and Rounds button."],
        ["Existing / Completed", "Show completed rounds, final result, winners, match history, player/team score details, highlights, records, downloadable summaries, and archived Rounds button."],
    ], [2300, 7060]))
    body.extend(bullets([
        "Every tournament detail page should include a Rounds button inside the main tournament container and near round-related containers.",
        "For live tournaments, the Rounds button opens active round progression and current bracket/tree state.",
        "For completed tournaments, the Rounds button opens the archived bracket with clickable rounds and match/player score details.",
    ]))

    body.append(p("21.4 Manager Registration Approval and Bracket Entry", style="Heading2"))
    body.append(p("Management users must be able to review team registrations for assigned tournaments, accept or reject registrations, and use accepted teams as the source for bracket allocation. For example, accepted cricket tournament teams should appear in the manager bracket allocation page for that cricket tournament."))
    body.append(table([
        ["Manager Area", "Frontend Requirement"],
        ["Registration Approval", "Show pending team registrations with captain, members, payment state, documents, eligibility, and accept/reject actions."],
        ["Accepted Teams", "Accepted teams become eligible for bracket allocation and should appear in the bracket workspace team panel."],
        ["Audit Visibility", "Manager decisions should show reviewer, decision time, reason where required, and notification status."],
        ["User Visibility", "Accepted registration status should appear on the participant/user page after manager save/publish."],
    ], [2300, 7060]))

    body.append(p("21.5 Bracket Allocation Workspace", style="Heading2"))
    body.append(p("The default bracket workflow should be auto bracket first. Accepted teams automatically populate a tournament bracket/tree structure, then managers can manually adjust before saving. The workspace should support the user's circular node model while keeping real tournament operations clear and recoverable."))
    body.append(image_paragraph("rIdImage10", "Manager Bracket Workspace Canvas", "Bracket allocation workspace with accepted team panel circular nodes inspector and toolbar", 10))
    body.append(table([
        ["Workspace Zone", "Required UI / Behavior"],
        ["Left Team Panel", "Accepted team cards with logo, team name, seed/rank where available, status, and draggable behavior."],
        ["Main Workspace", "Canvas/tree workspace with circular nodes representing team slots, matches, round slots, or winner positions."],
        ["Node Add", "A node can receive a team by drag/drop from the left panel or by clicking the center plus icon and selecting an accepted team."],
        ["Node Remove", "Removing a mistaken team clears only the team assignment. It should not delete the node unless manager chooses Delete node."],
        ["Pair Action", "Selecting two nodes and clicking Pair connects teams into a match pair."],
        ["Next Round Action", "Clicking Next Round creates or connects the winner path to the next round node."],
        ["Repair / Delete", "Managers can repair broken connections, delete selected nodes/connections, and reassign teams before saving."],
        ["Cancel / Rematch", "Cancel selected round/match and create rematch or regenerate the next-round path with manager permission."],
        ["Save Rule", "No autosave. Save button becomes enabled after changes. Save validates bracket consistency before publish."],
    ], [2300, 7060]))
    body.extend(bullets([
        "The workspace should display round labels such as Round 1, Semi-Final, and Final.",
        "Connections should be flexible enough for custom brackets but validated before save.",
        "The UI should include zoom, fit-to-screen, undo/redo history where feasible, and selected-node inspector details.",
        "Saved bracket changes should display on public/user tournament pages only after save/publish, not while manager is still editing.",
    ]))

    body.append(p("21.6 Automatic Winner Progression", style="Heading2"))
    body.append(image_paragraph("rIdImage11", "Winner Progression Flow", "Live score result advancing winners to next round with override and rematch controls", 11))
    body.append(table([
        ["Progression Rule", "Frontend Requirement"],
        ["Score Linked Winner", "When a round/match score identifies a winner, the winner should automatically move to the next round node."],
        ["Manager Override", "Manager can override winner movement only with permission and audit reason."],
        ["Rematch", "Manager can create rematch after cancellation, disputed result, or operational issue."],
        ["Archived History", "Completed bracket history remains visible to public/user pages, including previous rounds and score details."],
        ["Draft vs Published", "Unsaved manager changes remain draft-only until Save/Publish is clicked."],
    ], [2300, 7060]))

    body.append(p("21.7 Manual SMS / Email Notification Flow", style="Heading2"))
    body.append(p("Notifications must be manager-controlled after saved changes. The system should not send SMS or email during every canvas edit because that would create noisy and incorrect communication. After saving bracket or registration changes, the manager gets a manual notification action."))
    body.append(image_paragraph("rIdImage12", "Manual SMS and Email Notification Flow", "Manual SMS and email notification flow after saved bracket or registration changes", 12))
    body.append(table([
        ["Notification Trigger", "Manual Channel Behavior"],
        ["Registration Accepted", "Manager can select SMS, Email, or both to notify team captain and members where contact data exists."],
        ["Bracket Published", "Manager can notify all accepted teams after bracket is saved/published."],
        ["Match Pair Created", "Manager can notify affected teams only."],
        ["Round Changed", "Manager can notify affected teams and optionally all tournament teams."],
        ["Match Cancelled / Rematch", "Manager can notify affected teams with cancellation/rematch details."],
        ["Winner Advanced", "Manager can notify winning team and next opponent after score-linked progression."],
    ], [2600, 6760]))
    body.extend(bullets([
        "Notification button should appear after saved changes, not while the bracket is dirty/unsaved.",
        "Notification modal should show audience, selected channel, message preview, and send confirmation.",
        "Delivery status should be visible in manager audit/activity area.",
    ]))

    body.append(p("21.8 Backend and API Notes for Frontend Planning", style="Heading2"))
    body.append(table([
        ["API / Data Need", "Frontend Contract Expectation"],
        ["Accepted Registration Feed", "Manager bracket workspace reads accepted teams from assigned tournament registrations."],
        ["Bracket Save", "Endpoint persists nodes, teams, connections, rounds, pairs, winner paths, cancelled state, rematch state, and draft/published state."],
        ["Winner Progression", "Live score result can auto-advance winner to next round and return updated bracket state."],
        ["Manual Override", "Override requires manager/admin role, audit reason, and refreshed bracket state."],
        ["Notification Send", "Endpoint accepts selected channel: SMS, Email, or both, plus audience and message context."],
    ], [2500, 6860]))

    body.append(p("21.9 Acceptance Scenarios for This Addendum", style="Heading2"))
    body.extend(bullets([
        "Register a team and add captain/member details in the new Team Member Details step.",
        "Select Cricket from Sports and see only Cricket tournaments grouped as Upcoming, Live, and Existing.",
        "Open an upcoming tournament and see registration button plus rules, venue, capacity, prize, and schedule.",
        "Open a live tournament and see live video area, team-wise scores, individual scores, timing, highlights, records, and Rounds button.",
        "Open an existing tournament and see archived rounds and score details.",
        "Manager accepts a registration and the accepted team appears in bracket allocation.",
        "Auto bracket generates from accepted teams, manager edits it, Save enables, and saved state appears on public/user pages.",
        "Winner advances automatically from live score result, with manager override, cancel, rematch, repair, and delete actions available by permission.",
        "Manager sends manual SMS/email notification after saved bracket or registration changes.",
    ]))

    body.append(rich_callout("Frontend Master Completion Criteria", [
        "This frontend master document is complete when it gives the implementation team a single source of truth for public pages, portal pages, route groups, user workflows, live score flows, registration/payment flows, shared components, frontend state, data fetching, permissions, page states, responsiveness, accessibility, SEO, performance, testing, and production delivery expectations."
    ]))

    body.append(sect_pr())
    return f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="{NS_W}" xmlns:r="{NS_R}" xmlns:wp="{NS_WP}" xmlns:a="{NS_A}" xmlns:pic="{NS_PIC}">
  <w:body>
    {''.join(body)}
  </w:body>
</w:document>'''


def document_rels_xml() -> str:
    return '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rIdNumbering" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
  <Relationship Id="rIdSettings" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>
  <Relationship Id="rIdFontTable" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/fontTable" Target="fontTable.xml"/>
  <Relationship Id="rIdImage1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/frontend_master_experience_map.png"/>
  <Relationship Id="rIdImage2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/frontend_registration_payment_workflow.png"/>
  <Relationship Id="rIdImage3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/frontend_admin_management_workflow.png"/>
  <Relationship Id="rIdImage4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/frontend_live_score_workflow.png"/>
  <Relationship Id="rIdImage5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/frontend_state_architecture.png"/>
  <Relationship Id="rIdImage6" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/frontend_route_state_model.png"/>
  <Relationship Id="rIdImage7" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/frontend_addendum_registration_member_step.png"/>
  <Relationship Id="rIdImage8" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/frontend_addendum_sport_tournament_sections.png"/>
  <Relationship Id="rIdImage9" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/frontend_addendum_tournament_detail_status_model.png"/>
  <Relationship Id="rIdImage10" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/frontend_addendum_bracket_workspace_canvas.png"/>
  <Relationship Id="rIdImage11" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/frontend_addendum_winner_progression_flow.png"/>
  <Relationship Id="rIdImage12" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/frontend_addendum_manual_notification_flow.png"/>
</Relationships>'''


def core_xml() -> str:
    now = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    return f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>Smart Sportz - Frontend Master Pages and Workflows Specification</dc:title>
  <dc:subject>Consolidated frontend specification covering pages, workflows, route layouts, admin and management portals, public website, registration, payments, live scores, shared components, state, data, accessibility, performance, testing, and deployment expectations</dc:subject>
  <dc:creator>OpenAI Codex</dc:creator>
  <cp:lastModifiedBy>OpenAI Codex</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">{now}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">{now}</dcterms:modified>
</cp:coreProperties>'''


def build() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    assets = {
        "word/media/frontend_master_experience_map.png": ASSET_DIR / "frontend_master_experience_map.png",
        "word/media/frontend_registration_payment_workflow.png": ASSET_DIR / "frontend_registration_payment_workflow.png",
        "word/media/frontend_admin_management_workflow.png": ASSET_DIR / "frontend_admin_management_workflow.png",
        "word/media/frontend_live_score_workflow.png": ASSET_DIR / "frontend_live_score_workflow.png",
        "word/media/frontend_state_architecture.png": ASSET_DIR / "frontend_state_architecture.png",
        "word/media/frontend_route_state_model.png": ASSET_DIR / "frontend_route_state_model.png",
        "word/media/frontend_addendum_registration_member_step.png": ASSET_DIR / "frontend_addendum_registration_member_step.png",
        "word/media/frontend_addendum_sport_tournament_sections.png": ASSET_DIR / "frontend_addendum_sport_tournament_sections.png",
        "word/media/frontend_addendum_tournament_detail_status_model.png": ASSET_DIR / "frontend_addendum_tournament_detail_status_model.png",
        "word/media/frontend_addendum_bracket_workspace_canvas.png": ASSET_DIR / "frontend_addendum_bracket_workspace_canvas.png",
        "word/media/frontend_addendum_winner_progression_flow.png": ASSET_DIR / "frontend_addendum_winner_progression_flow.png",
        "word/media/frontend_addendum_manual_notification_flow.png": ASSET_DIR / "frontend_addendum_manual_notification_flow.png",
    }
    for source in assets.values():
        if not source.exists():
            raise FileNotFoundError(source)

    files = {
        "[Content_Types].xml": content_types_xml(),
        "_rels/.rels": root_rels_xml(),
        "docProps/core.xml": core_xml(),
        "docProps/app.xml": app_xml(),
        "word/document.xml": document_xml(),
        "word/_rels/document.xml.rels": document_rels_xml(),
        "word/styles.xml": style_xml(),
        "word/numbering.xml": numbering_xml(),
        "word/settings.xml": settings_xml(),
        "word/fontTable.xml": font_table_xml(),
    }
    with ZipFile(OUT, "w", ZIP_DEFLATED) as zf:
        for name, data in files.items():
            zf.writestr(name, data)
        for target, source in assets.items():
            zf.write(source, target)
    print(OUT.resolve())


if __name__ == "__main__":
    build()
