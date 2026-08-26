import { motion } from "framer-motion";
import { ArrowRight, ChevronRight, Download, Search, Settings } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type React from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { navItems, withRuntimeTournamentStatus } from "../data/platform";
import { mediaUrl } from "../lib/api";
import { ProgressiveImage } from "./ProgressiveImage";

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
      <img className="brand-mark" src={`${import.meta.env.BASE_URL}assets/logo.png`} alt="SmartSportz.in logo" loading="eager" fetchpriority="high" />
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
      <div className="footer-top">
        <div className="footer-brand-section">
          <BrandLogo compact />
          <p>Enterprise sports tournament management for registrations, payments, live scoring, and analytics.</p>
        </div>
        <div className="footer-social-section">
          <div className="footer-social-links">
            <a href="https://www.linkedin.com/in/smart-sportz-in-825454430/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
            </a>
            <a href="https://www.instagram.com/smartsportz.in/" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
              </svg>
            </a>
            <a href="https://www.facebook.com/profile.php?id=61593795923695" target="_blank" rel="noopener noreferrer" aria-label="Facebook">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
            </a>
            <a href="https://whatsapp.com/channel/0029VbDXEhUGehENTglonS34" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
            </a>
            <a href="https://youtube.com/@smartsportzin?si=GaemsUBAiH1ybYQc" target="_blank" rel="noopener noreferrer" aria-label="YouTube">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
              </svg>
            </a>
          </div>
        </div>
      </div>
      <div className="footer-grid">
        <div><b>Platform</b><Link to="/tournaments">Tournaments</Link><Link to="/live">Live</Link><Link to="/teams">Teams</Link></div>
        <div><b>Resources</b><Link to="/news">News</Link><Link to="/gallery">Gallery</Link><Link to="/faq">FAQ</Link></div>
        <div><b>Company</b><Link to="/about">About</Link><Link to="/contact">Contact</Link><Link to="/sponsors">Sponsors</Link></div>
      </div>
      <p className="footer-rights">
        <span>all rights received by smartsportz.in@2026</span>
        <span>powered by <span className="footer-brand-credit">Brillaris Global Pro</span></span>
      </p>
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const isUserPortal = user?.role === "user";
  const initials = user?.name
    ?.split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "U";
  return (
    <div className={`portal-shell ${isUserPortal ? "user-portal-shell" : ""} ${portalMenuOpen ? "portal-menu-open" : ""} ${sidebarCollapsed ? "portal-sidebar-collapsed" : ""}`}>
      <header className={`portal-mobile-header ${isUserPortal ? "user-portal-mobile-header" : ""}`}>
        <BrandLogo compact />
        <button className="icon-btn" type="button" aria-label={portalMenuOpen ? "Close dashboard menu" : "Open dashboard menu"} onClick={() => setPortalMenuOpen((value) => !value)}>
          <span className={`menu-glyph ${portalMenuOpen ? "is-open" : ""}`} aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </button>
      </header>
      <aside className="portal-sidebar">
        <div className="portal-sidebar-head">
          <button
            className="portal-sidebar-toggle"
            type="button"
            aria-label={sidebarCollapsed ? "Open dashboard navigation" : "Close dashboard navigation"}
            onClick={() => setSidebarCollapsed((value) => !value)}
          >
            <span className="portal-sidebar-toggle-glyph" aria-hidden="true" />
          </button>
          {!sidebarCollapsed && <BrandLogo />}
        </div>
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
        {!isUserPortal && <Link className="sidebar-link" to="/settings"><Settings size={16} /> Settings</Link>}
        <button className="sidebar-link sidebar-button" type="button" onClick={logout}><ArrowRight size={16} /> Logout</button>
      </aside>
      <section className="portal-main">
        {(title || subtitle || action) && (
          <div className="portal-topbar">
            {(title || subtitle) && (
              <div className="portal-title-stack">
                {sidebarCollapsed && <BrandLogo compact />}
                <div>
                  <p className="eyebrow">Smart Sportz Enterprise</p>
                  {title && <h1>{title}</h1>}
                  {subtitle && <p>{subtitle}</p>}
                </div>
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
  const isFeatureOnly = Boolean(item.featureOnly);
  const canRegister = tournament.status === "Registration Open";
  const isUpcoming = tournament.status === "Upcoming";
  const statusText = canRegister
    ? `Register: ${tournament.registrationStart} - ${tournament.registrationEnd}`
    : isUpcoming
      ? `Registration opens ${tournament.registrationStart}`
      : tournament.status === "Live"
        ? "Live tournament in progress"
        : `Registration closed ${tournament.registrationEnd}`;
  const destination = `/tournaments/${item.slug}`;
  const actionLabel = canRegister || isUpcoming ? "View details" : "Rounds";
  const minAge = Number((item as any).minAge ?? (item as any).min_age ?? 0);
  const maxAge = Number((item as any).maxAge ?? (item as any).max_age ?? 0);
  const ageLabel = minAge && maxAge ? `${minAge}-${maxAge} yrs` : minAge ? `${minAge}+ yrs` : maxAge ? `Up to ${maxAge} yrs` : "Open age";
  const publishedMatchCount = Number(item.published_match_count ?? item.publishedMatchCount ?? 0);
  const publishedRoundCount = Number(item.published_round_count ?? item.publishedRoundCount ?? 0);

  return (
    <Link to={destination} className="click-card">
    <motion.article className="tournament-card" whileHover={{ y: -6, scale: 1.01 }} transition={{ type: "spring", stiffness: 260, damping: 22 }}>
      <ProgressiveImage src={mediaUrl(tournament.image)} alt={`${tournament.name} visual`} />
      <div className="card-body">
        <span className={`status ${tournament.accent}`}>{tournament.status}</span>
        <h3>{tournament.name}</h3>
        <p className="registration-window">{statusText}</p>
        <p>{item.sport} • {item.location} • {item.date}</p>
        <div className="card-meta">
          <span>{tournament.teams}/{tournament.capacity} teams</span>
          <span>{tournament.prize}</span>
          <span>{publishedMatchCount > 0 ? `${publishedMatchCount} match${publishedMatchCount === 1 ? "" : "es"} / ${publishedRoundCount || 1} round${(publishedRoundCount || 1) === 1 ? "" : "s"}` : ageLabel}</span>
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
      <div className="live-media"><ProgressiveImage src={mediaUrl(match.image)} alt="" /><span className="live-dot">Live</span></div>
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

function cellText(value: React.ReactNode): string {
  if (value === null || value === undefined || typeof value === "boolean") return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(cellText).join(" ").trim();
  if (typeof value === "object" && "props" in value) return cellText((value as React.ReactElement<any>).props.children);
  return "";
}

function downloadTableCsv(columns: string[], rows: Array<Array<React.ReactNode>>) {
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const csv = [
    columns.map(escape).join(","),
    ...rows.map((row) => columns.map((_, index) => escape(cellText(row[index]))).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `smart-sportz-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function DataTable({
  columns,
  rows,
  topScrollbar = "auto",
  className = "",
  rowClassName,
}: {
  columns: string[];
  rows: Array<Array<React.ReactNode>>;
  topScrollbar?: "auto" | "always";
  className?: string;
  rowClassName?: (row: Array<React.ReactNode>, index: number) => string;
}) {
  const topScrollRef = useRef<HTMLDivElement | null>(null);
  const bodyScrollRef = useRef<HTMLDivElement | null>(null);
  const tableRef = useRef<HTMLTableElement | null>(null);
  const [scrollWidth, setScrollWidth] = useState(0);
  const [hasHorizontalScroll, setHasHorizontalScroll] = useState(false);

  useEffect(() => {
    const update = () => {
      const bodyWidth = bodyScrollRef.current?.clientWidth ?? 0;
      const contentWidth = bodyScrollRef.current?.scrollWidth ?? tableRef.current?.scrollWidth ?? 0;
      const measuredWidth = contentWidth > bodyWidth + 1 ? contentWidth : bodyWidth;
      setScrollWidth(measuredWidth);
      setHasHorizontalScroll(topScrollbar === "always" || contentWidth > bodyWidth + 1);
    };
    update();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    if (observer) {
      if (tableRef.current) observer.observe(tableRef.current);
      if (bodyScrollRef.current) observer.observe(bodyScrollRef.current);
    }
    window.addEventListener("resize", update);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [rows, columns, topScrollbar]);

  function syncScroll(source: "top" | "body") {
    const top = topScrollRef.current;
    const body = bodyScrollRef.current;
    if (!top || !body) return;
    if (source === "top") body.scrollLeft = top.scrollLeft;
    else top.scrollLeft = body.scrollLeft;
  }

  return (
    <div className={`table-wrap ${className}`.trim()}>
      {rows.length > 0 && (
        <div className="table-export-actions">
          <button type="button" onClick={() => downloadTableCsv(columns, rows)}><Download size={16} /> Download</button>
        </div>
      )}
      {hasHorizontalScroll && (
        <div className={`table-scroll-top ${topScrollbar === "always" ? "table-scroll-top-visible" : ""}`} ref={topScrollRef} onScroll={() => syncScroll("top")}><div style={{ width: scrollWidth }} /></div>
      )}
      <div className="table-scroll-body" ref={bodyScrollRef} onScroll={() => syncScroll("body")}>
        <table ref={tableRef}>
          <thead><tr>{columns.map((col) => <th key={col}>{col}</th>)}</tr></thead>
          <tbody>{rows.map((row, index) => <tr key={index} className={rowClassName?.(row, index) || undefined}>{row.map((cell, i) => <td key={i}>{cell}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}
