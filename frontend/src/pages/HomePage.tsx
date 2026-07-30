import { motion } from "framer-motion";
import { BarChart3, CheckCircle2, MapPin, Radio, ShieldCheck, Trophy, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import { Page, SectionTitle, TournamentCard } from "../components/UI";
import { assets, leaderboardRecords, newsPosts, sportHomeVisibility, sports, tournamentNotices, tournaments, withRuntimeTournamentStatus } from "../data/platform";
import type { TournamentNotice } from "../data/platform";

const fade = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.55 },
};

const heroCopy = {
  initial: {},
  animate: { transition: { staggerChildren: 0.11, delayChildren: 0.08 } },
};

const heroLine = {
  initial: { opacity: 0, y: 34, filter: "blur(10px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.72, ease: [0.22, 1, 0.36, 1] } },
};

const featureLinks = [
  "Real-time score sync",
  "Razorpay-ready registration",
  "Tournament fixture control",
  "CMS and sponsor content",
  "Role-based dashboards",
];

const noticeStorageKey = "smart-sportz-tournament-notices";

function readStoredNotices() {
  try {
    const raw = localStorage.getItem(noticeStorageKey);
    return raw ? JSON.parse(raw) as TournamentNotice[] : [];
  } catch {
    return [];
  }
}

export function HomePage() {
  const [leaderboardSport, setLeaderboardSport] = useState("Cricket");
  const leaderboardFilterRef = useRef<HTMLDivElement>(null);
  const upcomingTournamentsRef = useRef<HTMLDivElement>(null);
  const registrationOpenRef = useRef<HTMLDivElement>(null);
  const oldTournamentsRef = useRef<HTMLDivElement>(null);
  const newsRef = useRef<HTMLDivElement>(null);
  const organizerRef = useRef<HTMLDivElement>(null);
  const organizerCardRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [organizerIndex, setOrganizerIndex] = useState(0);
  const [activeNotice, setActiveNotice] = useState<TournamentNotice | null>(null);
  const runtimeTournaments = tournaments.map((item) => withRuntimeTournamentStatus(item));
  const featuredGroups = [
    {
      key: "upcoming",
      title: "Upcoming tournaments",
      text: "Tournaments announced for future play. Registration opens on the published date.",
      ref: upcomingTournamentsRef,
      items: runtimeTournaments.filter((item) => item.status === "Upcoming"),
    },
    {
      key: "registration-open",
      title: "Open registration",
      text: "Active registration windows where teams can enter before the closing date.",
      ref: registrationOpenRef,
      items: runtimeTournaments.filter((item) => item.status === "Registration Open"),
    },
    {
      key: "old",
      title: "Old tournaments",
      text: "Completed tournament records and previous season archives.",
      ref: oldTournamentsRef,
      items: runtimeTournaments.filter((item) => item.status === "Completed"),
    },
  ].filter((group) => group.items.length > 0);
  const homeSports = sportHomeVisibility
    .filter((item) => item.showOnHome)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((visibility) => sports.find((sport) => sport.slug === visibility.sportSlug))
    .filter(Boolean) as typeof sports;
  const sportCounts = (name: string) => ({
    upcoming: runtimeTournaments.filter((item) => item.sport === name && ["Upcoming", "Registration Open", "Registration Closed"].includes(item.status)).length,
    live: runtimeTournaments.filter((item) => item.sport === name && item.status === "Live").length,
    old: runtimeTournaments.filter((item) => item.sport === name && item.status === "Completed").length,
  });
  const oldMatchNews = newsPosts.filter((item) => item.category === "Winner Teams").slice(0, 3);
  const lifecycle = ["Register Team", "Secure Payment", "Fixture Draw", "Venue Check In", "Live Scoring", "Real-time Stats", "Finals & Awards", "Media Gallery", "Certificates"];
  const organizerTools = [
    "Online Registration",
    "Secure Payments",
    "Automated Brackets",
    "Live Scoring App",
    "Advanced Analytics",
    "Social Hub",
    "Anti-Fraud Engine",
    "E-Certificates",
  ];
  const selectedLeaders = useMemo(
    () => leaderboardRecords.filter((record) => record.sport === leaderboardSport).sort((a, b) => a.rank - b.rank),
    [leaderboardSport],
  );
  const scrollLeaderboardFilter = (direction: "left" | "right") => {
    leaderboardFilterRef.current?.scrollBy({ left: direction === "left" ? -180 : 180, behavior: "smooth" });
  };
  const scrollCarousel = (ref: RefObject<HTMLDivElement | null>, direction: "left" | "right") => {
    ref.current?.scrollBy({ left: direction === "left" ? -360 : 360, behavior: "smooth" });
  };
  const moveOrganizer = (direction: "left" | "right") => {
    setOrganizerIndex((current) => {
      const next = direction === "left"
        ? (current - 1 + organizerTools.length) % organizerTools.length
        : (current + 1) % organizerTools.length;
      return next;
    });
  };

  useEffect(() => {
    const timer = window.setInterval(() => moveOrganizer("right"), 3200);
    return () => window.clearInterval(timer);
  }, [organizerTools.length]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("screenshot") === "1") return;
    const allNotices = [...readStoredNotices(), ...tournamentNotices]
      .filter((notice) => notice.published)
      .filter((notice, index, list) => list.findIndex((item) => item.id === notice.id) === index);
    const notice = allNotices[0];
    if (!notice) return;
    const dismissedKey = `smart-sportz-notice-dismissed:${notice.id}`;
    if (sessionStorage.getItem(dismissedKey)) return;
    const timer = window.setTimeout(() => setActiveNotice(notice), 650);
    return () => window.clearTimeout(timer);
  }, []);

  function closeNotice() {
    if (activeNotice) {
      sessionStorage.setItem(`smart-sportz-notice-dismissed:${activeNotice.id}`, "1");
    }
    setActiveNotice(null);
  }

  useEffect(() => {
    const container = organizerRef.current;
    const card = organizerCardRefs.current[organizerIndex];
    if (!container || !card) return;
    container.scrollTo({
      left: card.offsetLeft - (container.clientWidth - card.clientWidth) / 2,
      behavior: "smooth",
    });
  }, [organizerIndex]);

  return (
    <Page className="home-reference-page">
      {activeNotice && (
        <div className="notice-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="home-notice-title">
          <article className="notice-modal">
            <button className="notice-close" type="button" aria-label="Close notice" onClick={closeNotice}>×</button>
            <img src={activeNotice.image} alt="" />
            <div>
              <span className="status emerald">Tournament Notice</span>
              <h2 id="home-notice-title">{activeNotice.title}</h2>
              <p>{activeNotice.description}</p>
              <Link className="btn btn-primary" to={`/tournaments/${activeNotice.tournamentSlug}`} onClick={closeNotice}>Open Tournament</Link>
            </div>
          </article>
        </div>
      )}
      <section className="reference-hero">
        <video className="reference-hero-video" autoPlay muted loop playsInline preload="auto">
          <source src={`${import.meta.env.BASE_URL}media/hero-video-short.mp4`} type="video/mp4" />
        </video>
        <div className="reference-hero-overlay" />
        <motion.div className="reference-hero-copy" variants={heroCopy} initial="initial" animate="animate">
          <motion.span className="eyebrow animated-eyebrow" variants={heroLine}>SmartSportz</motion.span>
          <motion.h1 aria-label="Where Champions Compete. Where Tournaments Come Alive.">
            {["Where Champions", "Compete. Where", "Tournaments", "Come Alive."].map((line) => (
              <motion.span key={line} variants={heroLine}>{line}</motion.span>
            ))}
          </motion.h1>
          <motion.p variants={heroLine}>India's most sophisticated ecosystem for managing elite tournaments, scoring, registration, payments, content, and leaderboards.</motion.p>
          <motion.div className="hero-actions" variants={heroLine}>
            <Link className="btn btn-primary" to="/tournaments">Register Tournament</Link>
            <Link className="btn btn-secondary glass-btn" to="/sports">Explore Sports</Link>
          </motion.div>
          <motion.div className="match-chip-row hero-copy-chips" variants={heroLine}>
            {[
              "Mumbai Live Matches",
              "Book a Facility",
              "Live Scoring",
              "News Updates",
            ].map((item) => <span key={item}>{item}</span>)}
          </motion.div>
        </motion.div>
      </section>
      <section className="hero-below-panel" aria-label="Live tournament scores">
        <div className="hero-score-strip">
          {[
            ["India", "Mumbai Mavericks", "156/4"],
            ["Bengaluru", "Corporate T20", "Live"],
            ["Chennai", "Pro Elite", "58-62"],
          ].map(([city, team, score]) => (
            <div key={team}>
              <small>{city}</small>
              <strong>{team}</strong>
              <span>{score}</span>
            </div>
          ))}
        </div>
      </section>
      <section className="trusted-section">
        <SectionTitle title="Trusted by the Sports Community" />
        <div className="trusted-grid">
          {[
            ["500+", "Active Tournaments"],
            ["50,000+", "Verified Players"],
            ["1,200+", "Sports Facilities"],
            ["INR 10Cr+", "Prizes Distributed"],
          ].map(([value, label], index) => (
            <motion.div
              className="trusted-card"
              key={label}
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.45, delay: index * 0.06 }}
            >
              <strong>{value}</strong>
              <span>{label}</span>
            </motion.div>
          ))}
        </div>
      </section>
      <section className="section">
        <div className="section-title row-title">
          <div>
            <p className="eyebrow">Explore Your Sport</p>
            <h2>Discover tournaments across categories</h2>
            <p>Upcoming, live, and old tournaments are grouped inside each sport card.</p>
          </div>
          <Link className="inline-link" to="/sports">View All Sports</Link>
        </div>
        <div className="sport-home-grid">
          {homeSports.map((sport) => {
            const Icon = sport.icon;
            const counts = sportCounts(sport.name);
            return (
              <Link className="sport-home-card click-card" to={`/sports/${sport.slug}`} key={sport.slug}>
                <Icon size={26} />
                <span className={`status ${sport.color}`}>{sport.name}</span>
                <div className="sport-home-metrics">
                  {[
                    ["Upcoming", counts.upcoming],
                    ["Live", counts.live],
                    ["Old", counts.old],
                  ].map(([label, value]) => (
                    <span className="sport-home-metric" key={label}>
                      <small>{label}</small>
                      <b>{value}</b>
                    </span>
                  ))}
                </div>
              </Link>
            );
          })}
        </div>
      </section>
      <section className="section">
        <div className="section-title row-title">
          <div>
            <p className="eyebrow">Tournament Discovery</p>
            <h2>Featured tournaments</h2>
            <p>Grouped by status so teams can quickly find upcoming, open, and previous tournaments.</p>
          </div>
        </div>
        <div className="featured-status-stack">
          {featuredGroups.map((group) => (
            <section className="featured-status-row" key={group.key}>
              <div className="featured-status-head">
                <div>
                  <h3>{group.title}</h3>
                  <p>{group.text}</p>
                </div>
                <div className="carousel-controls top-carousel-controls">
                  <button type="button" aria-label={`Previous ${group.title}`} onClick={() => scrollCarousel(group.ref, "left")}>&lt;</button>
                  <button type="button" aria-label={`Next ${group.title}`} onClick={() => scrollCarousel(group.ref, "right")}>&gt;</button>
                </div>
              </div>
              <div className="carousel-shell">
                <div className="card-grid carousel-row featured-carousel featured-status-carousel" ref={group.ref}>
                  {group.items.map((item) => <TournamentCard key={item.slug} item={item} />)}
                </div>
              </div>
            </section>
          ))}
        </div>
      </section>
      <section className="section lifecycle-section">
        <SectionTitle title="The Tournament Lifecycle" text="A connected flow from registration to certificates." />
        <div className="lifecycle-row">
          {lifecycle.map((item, index) => (
            <div key={item}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <b>{item}</b>
            </div>
          ))}
        </div>
      </section>
      <section className="section split live-analytics-section">
        <motion.div className="live-video-card" {...fade}>
          <img src={assets.football} alt="Live analytics match" />
          <button type="button"><Radio size={24} /></button>
        </motion.div>
        <motion.div {...fade}>
          <span className="live-dot">Live Now</span>
          <h2>Experience Every Match Live with Pro Analytics</h2>
          <div className="live-action-row">
            <div className="score-mini-card">
              <span>Wings SC</span>
              <strong>128 - 110</strong>
              <span>Titans Acad.</span>
            </div>
            <Link className="btn btn-primary live-center-btn" to="/live">Open Match Center</Link>
          </div>
          <div className="feature-list">
            {["Instant AI-powered highlights for every match", "Heatmaps and advanced performance telemetry"].map((feature) => (
              <div className="feature-label" key={feature}><CheckCircle2 size={18} />{feature}</div>
            ))}
          </div>
        </motion.div>
      </section>
      <section className="section">
        <div className="section-title row-title">
          <div>
            <h2>Empowering Tournament Organizers</h2>
            <p>All-in-one suite of professional tools to run world-class sports competitions.</p>
          </div>        </div>
        <div className="carousel-shell organizer-shell">
          <button className="carousel-edge carousel-edge-left" type="button" aria-label="Previous organizer tool" onClick={() => moveOrganizer("left")}>&lt;</button>
          <div className="organizer-grid" ref={organizerRef}>
          {organizerTools.map((tool, index) => (
            <div
              className={`panel organizer-card ${index === organizerIndex ? "is-active" : ""}`}
              key={tool}
              ref={(element) => { organizerCardRefs.current[index] = element; }}
            >
              <ShieldCheck size={18} /><h3>{tool}</h3><p>Premium workflow controls for secure tournament operations.</p>
            </div>
          ))}
        </div>
          <button className="carousel-edge carousel-edge-right" type="button" aria-label="Next organizer tool" onClick={() => moveOrganizer("right")}>&gt;</button>
        </div>
      </section>
      <section className="section">
        <div className="section-title row-title">
          <div>
            <p className="eyebrow">Old Match News</p>
            <h2>Completed match records and winner stories</h2>
            <p>Open a card to read the full news article and match archive details.</p>
          </div>
          <div className="section-actions news-section-actions">
            <Link className="inline-link" to="/news">View More News</Link>
            <div className="carousel-controls top-carousel-controls">
              <button type="button" aria-label="Previous completed match records" onClick={() => scrollCarousel(newsRef, "left")}>&lt;</button>
              <button type="button" aria-label="Next completed match records" onClick={() => scrollCarousel(newsRef, "right")}>&gt;</button>
            </div>
          </div>
        </div>
        <div className="carousel-shell">
          <div className="content-grid carousel-row news-carousel" ref={newsRef}>
          {oldMatchNews.map((post) => (
            <Link className="panel news-card home-news-card click-card" to={`/news/${post.slug}`} key={post.slug}>
              <div className="news-card-media">
                <img src={post.image} alt="" />
              </div>
              <div className="news-card-copy">
                <span className="status emerald">{post.category}</span>
                <h3>{post.title}</h3>
                <p>{post.shortDescription}</p>
              </div>
            </Link>
          ))}
        </div>
        </div>
      </section>
      <section className="section" id="home-leaderboards">
        <div className="section-title row-title">
          <div>
            <p className="eyebrow">Rankings</p>
            <h2>Sport Leaderboards</h2>
            <p>Select any sport category here and inspect records by rank without leaving the homepage.</p>
          </div>
        </div>
        <div className="leaderboard-filter-shell">
          <button className="filter-arrow filter-arrow-left" type="button" aria-label="Scroll sports left" onClick={() => scrollLeaderboardFilter("left")}>&lt;</button>
          <div className="leaderboard-filter home-leaderboard-filter" ref={leaderboardFilterRef}>
            {sports.map((sport) => (
              <button className={sport.name === leaderboardSport ? "active" : ""} type="button" onClick={() => setLeaderboardSport(sport.name)} key={sport.slug}>{sport.name}</button>
            ))}
          </div>
          <button className="filter-arrow filter-arrow-right" type="button" aria-label="Scroll sports right" onClick={() => scrollLeaderboardFilter("right")}>&gt;</button>
        </div>
        <div className="leaderboard-preview panel">
          {selectedLeaders.map((record) => (
            <div className="leaderboard-preview-row" key={record.teamName}>
              <span>{String(record.rank).padStart(2, "0")}</span>
              <b>{record.teamName}</b>
              <small><MapPin size={13} />{record.city}</small>
              <em>{record.winRate}%</em>
              <strong>{record.points.toLocaleString("en-IN")}</strong>
              <i>{record.recordLabel}</i>
            </div>
          ))}
        </div>
      </section>
      <section className="section split">
        <motion.div {...fade}>
          <SectionTitle eyebrow="Platform Capability" title="Complete enterprise operations" text="Public website, participant portal, management portal, super admin, live score engine, CMS, reports, payments, and notifications are structured in one frontend." />
          <div className="feature-list">
            {featureLinks.map((feature) => (
              <div className="feature-label" key={feature}><CheckCircle2 size={18} />{feature}</div>
            ))}
          </div>
        </motion.div>
        <motion.div className="visual-card" {...fade}>
          <div className="operations-visual">
            <div className="ops-visual-header">
              <span>Smart Sportz Control Layer</span>
              <strong>Enterprise Operations</strong>
            </div>
            <div className="ops-visual-grid">
              <div><Radio size={24} /><span>Live Score</span><b>Realtime</b></div>
              <div><Trophy size={24} /><span>Fixtures</span><b>Auto</b></div>
              <div><ShieldCheck size={24} /><span>RBAC</span><b>Secure</b></div>
              <div><BarChart3 size={24} /><span>Reports</span><b>Export</b></div>
            </div>
            <div className="ops-flow">
              <span>Registration</span>
              <Zap size={18} />
              <span>Payment</span>
              <Zap size={18} />
              <span>Live Match</span>
            </div>
          </div>
        </motion.div>
      </section>
    </Page>
  );
}

