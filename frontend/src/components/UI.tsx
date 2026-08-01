import { motion } from "framer-motion";
import { ArrowRight, ChevronRight, Search, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import type React from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { navItems, withRuntimeTournamentStatus } from "../data/platform";
import { apiRequest } from "../lib/api";
import { getCompletedRegistration } from "../lib/registrationStatus";

export function Page({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.main
      className={`page ${className}`}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.main>
  );
}

function BrandLogo({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className={`brand ${compact ? "compact" : ""}`}>
      <img className="brand-mark" src={`${import.meta.env.BASE_URL}assets/logo.png`} alt="SmartSportz.in logo" />
      <span>SmartSportz.in</span>
    </Link>
  );
}

export function PublicHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const { user, logout } = useAuth();
  const visibleNavItems = navItems.slice(0, 7).filter((item) => item.label !== "Teams");
  const showSearch = false;
  const showRegisterAction = false;

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  return (
    <header className={`site-header ${menuOpen ? "menu-open" : ""}`}>
      <div className="header-row">
        <BrandLogo />
        <nav className="site-nav">
          {visibleNavItems.map((item) => (
            <NavLink key={item.path} to={item.path}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="header-actions">
          {showSearch && (
            <div className="search-pill">
              <Search size={16} />
              <span>Search events...</span>
            </div>
          )}
          {user ? (
            <Link to={user.homePath} className="btn btn-secondary desktop-action">{user.roleLabel}</Link>
          ) : (
            <Link to="/login" className="btn btn-secondary desktop-action">Login</Link>
          )}
          {showRegisterAction && <Link to="/tournaments" className="btn btn-primary desktop-action">Register</Link>}
          <button
            className="icon-btn mobile-menu-btn"
            type="button"
            aria-expanded={menuOpen}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen((value) => !value)}
          >
            <span className={`menu-glyph ${menuOpen ? "is-open" : ""}`} aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          </button>
        </div>
      </div>
      <nav className="mobile-menu" aria-label="Mobile navigation">
        {showSearch && (
          <div className="mobile-search">
            <Search size={16} />
            <span>Search events...</span>
          </div>
        )}
        {visibleNavItems.map((item) => (
          <NavLink key={item.path} to={item.path}>
            {item.label}
          </NavLink>
        ))}
        <div className="mobile-actions">
          {user ? (
            <>
              <Link to={user.homePath} className="btn btn-secondary">{user.roleLabel}</Link>
              <button type="button" className="btn btn-secondary" onClick={logout}>Logout</button>
            </>
          ) : (
            <Link to="/login" className="btn btn-secondary">Login</Link>
          )}
          {showRegisterAction && <Link to="/tournaments" className="btn btn-primary">Register</Link>}
        </div>
      </nav>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div>
        <BrandLogo compact />
        <p>Enterprise sports tournament management for registrations, payments, live scoring, and analytics.</p>
      </div>
      <div className="footer-grid">
        <div><b>Platform</b><Link to="/tournaments">Tournaments</Link><Link to="/live">Live</Link><Link to="/teams">Teams</Link></div>
        <div><b>Resources</b><Link to="/news">News</Link><Link to="/gallery">Gallery</Link><Link to="/faq">FAQ</Link></div>
        <div><b>Company</b><Link to="/about">About</Link><Link to="/contact">Contact</Link><Link to="/sponsors">Sponsors</Link></div>
      </div>
    </footer>
  );
}

export function PortalShell({
  title,
  subtitle,
  sidebar,
  children,
  action,
}: {
  title: string;
  subtitle: string;
  sidebar: Array<{ label: string; path: string; icon: React.ComponentType<{ size?: number | string }>; hidden?: boolean }>;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  const { user, logout } = useAuth();
  const [portalMenuOpen, setPortalMenuOpen] = useState(false);
  const isUserPortal = user?.role === "user";
  const initials = user?.name
    ?.split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "U";
  const primaryAction = user?.role === "super_admin"
    ? { label: "Create Tournament", path: "/admin/tournaments" }
    : user?.role === "management"
      ? { label: "Live Control", path: "/management/matches" }
      : { label: "Register Team", path: "/tournaments/mumbai-premier-bash/register" };

  return (
    <div className={`portal-shell ${isUserPortal ? "user-portal-shell" : ""} ${portalMenuOpen ? "portal-menu-open" : ""}`}>
      {isUserPortal && (
        <header className="user-portal-mobile-header">
          <BrandLogo compact />
          <button className="icon-btn" type="button" aria-label={portalMenuOpen ? "Close dashboard menu" : "Open dashboard menu"} onClick={() => setPortalMenuOpen((value) => !value)}>
            <span className={`menu-glyph ${portalMenuOpen ? "is-open" : ""}`} aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          </button>
        </header>
      )}
      <aside className="portal-sidebar">
        <BrandLogo />
        <nav>
          {sidebar.filter((item) => !item.hidden).map((item) => {
            const Icon = item.icon;
            return (
              <NavLink key={item.path} to={item.path}>
                <Icon size={18} />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
        <Link className="btn btn-primary wide" to={primaryAction.path}>{primaryAction.label}</Link>
        {!isUserPortal && <Link className="sidebar-link" to="/settings"><Settings size={16} /> Settings</Link>}
        <button className="sidebar-link sidebar-button" type="button" onClick={logout}><ArrowRight size={16} /> Logout</button>
      </aside>
      <section className="portal-main">
        {(title || subtitle || action) && (
          <div className="portal-topbar">
            {(title || subtitle) && (
              <div>
                <p className="eyebrow">Smart Sportz Enterprise</p>
                {title && <h1>{title}</h1>}
                {subtitle && <p>{subtitle}</p>}
              </div>
            )}
            <div className="portal-actions">
              {user && (isUserPortal ? (
                <Link className="user-profile-avatar" to="/user/settings" aria-label="Open profile settings">
                  <span>{initials}</span>
                </Link>
              ) : <span className="status blue">{user.roleLabel}</span>)}
              {action}
            </div>
          </div>
        )}
        {children}
      </section>
    </div>
  );
}

export function SectionTitle({ eyebrow, title, text }: { eyebrow?: string; title: string; text?: string }) {
  return (
    <div className="section-title">
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h2>{title}</h2>
      {text && <p>{text}</p>}
    </div>
  );
}

export function MetricCard({
  label,
  value,
  trend,
  icon: Icon,
  to,
}: {
  label: string;
  value: string;
  trend: string;
  icon: React.ComponentType<{ size?: number | string }>;
  to?: string;
}) {
  const content = (
    <motion.div className="metric-card" whileHover={{ y: -4 }} transition={{ type: "spring", stiffness: 280, damping: 22 }}>
      <div className="metric-icon"><Icon size={22} /></div>
      <span className="trend">{trend}</span>
      <p>{label}</p>
      <strong>{value}</strong>
      <div className="meter"><span /></div>
    </motion.div>
  );

  return to ? <Link to={to} className="click-card">{content}</Link> : content;
}

export function TournamentCard({ item }: { item: any }) {
  const tournament = withRuntimeTournamentStatus(item);
  const { token } = useAuth();
  const [completedRegistration, setCompletedRegistration] = useState(() => Boolean(getCompletedRegistration(item.slug)));
  const isFeatureOnly = Boolean(item.featureOnly);
  const canRegister = tournament.status === "Registration Open";
  const isUpcoming = tournament.status === "Upcoming";

  useEffect(() => {
    if (getCompletedRegistration(item.slug)) {
      setCompletedRegistration(true);
      return;
    }
    if (!token || isFeatureOnly) return;
    apiRequest(`/registrations/by-tournament/${item.slug}/mine`, {}, token)
      .then(() => setCompletedRegistration(true))
      .catch(() => setCompletedRegistration(false));
  }, [token, item.slug, isFeatureOnly]);

  const statusText = completedRegistration
    ? "Already registered - payment complete"
    : canRegister
    ? `Register: ${tournament.registrationStart} - ${tournament.registrationEnd}`
    : isUpcoming
      ? `Registration opens ${tournament.registrationStart}`
      : tournament.status === "Live"
        ? "Live tournament in progress"
        : `Registration closed ${tournament.registrationEnd}`;
  const destination = completedRegistration ? `/tournaments/${item.slug}/registration-pass` : `/tournaments/${item.slug}`;
  const actionLabel = completedRegistration ? "View your register" : "View details";

  return (
    <Link to={destination} className="click-card">
    <motion.article className="tournament-card" whileHover={{ y: -6, scale: 1.01 }} transition={{ type: "spring", stiffness: 260, damping: 22 }}>
      <img src={tournament.image} alt={`${tournament.name} visual`} />
      <div className="card-body">
        <span className={`status ${completedRegistration ? "emerald" : tournament.accent}`}>{completedRegistration ? "Already registered" : tournament.status}</span>
        <h3>{tournament.name}</h3>
        <p className="registration-window">{statusText}</p>
        <p>{item.sport} • {item.location} • {item.date}</p>
        <div className="card-meta">
          <span>{tournament.teams}/{tournament.capacity} teams</span>
          <span>{tournament.prize}</span>
        </div>
        <span className="inline-link">{actionLabel} <ChevronRight size={16} /></span>
      </div>
    </motion.article>
    </Link>
  );
}

export function LiveMatchCard({ match }: { match: any }) {
  return (
    <Link className="live-card click-card" to={`/live/${match.id}`}>
      <div className="live-media"><img src={match.image} alt="" /><span className="live-dot">Live</span></div>
      <div>
        <p className="eyebrow">{match.tournament}</p>
        <h3>{match.home} vs {match.away}</h3>
        <div className="score-line"><strong>{match.score}</strong><span>{match.awayScore}</span></div>
        <p>{match.sport} • {match.stage}</p>
        <span className="inline-link">Open center <ArrowRight size={16} /></span>
      </div>
    </Link>
  );
}

export function DataTable({ columns, rows }: { columns: string[]; rows: Array<Array<React.ReactNode>> }) {
  return (
    <div className="table-wrap">
      <table>
        <thead><tr>{columns.map((col) => <th key={col}>{col}</th>)}</tr></thead>
        <tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, i) => <td key={i}>{cell}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}
