import { motion } from "framer-motion";
import { BarChart3, CheckCircle2, MapPin, Radio, ShieldCheck, Trophy, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Page, SectionTitle, TournamentCard } from "../components/UI";
import { assets, leaderboardRecords, newsPosts, sportHomeVisibility, sports, tournamentNotices, tournaments, withRuntimeTournamentStatus } from "../data/platform";
import type { TournamentNotice } from "../data/platform";
import { apiRequest } from "../lib/api";
import { useWheelHorizontal } from "../lib/useWheelHorizontal";

function assetUrl(path?: string) {
  if (!path) return "";
  if (/^(https?:|data:|blob:)/i.test(path)) return path;
  if (path.startsWith(import.meta.env.BASE_URL)) return path;
  if (/^\/(assets|media)\//.test(path)) return `${import.meta.env.BASE_URL}${path.replace(/^\//, "")}`;
  return path;
}

function externalUrl(path?: string) {
  if (!path) return "#";
  if (/^https?:\/\//i.test(path)) return path;
  return `https://${path.replace(/^\/+/, "")}`;
}

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

function FeaturedTournamentMiniCard({ item }: { item: any }) {
  return (
    <Link className="featured-mini-card click-card" to={`/tournaments/${item.slug}`}>
      <img src={assetUrl(item.image)} alt="" />
      <div>
        <h3>{item.name}</h3>
        <p><MapPin size={15} />{item.location}</p>
        {item.tournamentDescription && <small>{item.tournamentDescription}</small>}
      </div>
    </Link>
  );
}

const sportStoryImages: Record<string, string> = {
  chess: "/assets/generated/sport-chess-sponsor.png",
  cricket: assets.cricket,
  football: assets.football,
  basketball: assets.basketball,
  volleyball: assets.volleyball,
  badminton: "/assets/generated/sport-badminton-sponsor.png",
  "table-tennis": "/assets/generated/sport-table-tennis-sponsor.png",
  esports: assets.basketball,
  athletics: "/assets/generated/sport-athletics-sponsor.png",
};

const sportStoryCopy: Record<string, { title: string; date: string; sponsor: string; text: string }> = {
  cricket: {
    title: "Premier cricket leagues with city sponsors",
    date: "Aug 2026 season",
    sponsor: "SmartSportz Premier Partners",
    text: "Cricket tournaments combine structured registrations, player verification, match scoring, sponsor placements, live highlights, and final award records for corporate and youth leagues.",
  },
  football: {
    title: "Youth and club football circuits",
    date: "Sep 2026 window",
    sponsor: "Grassroots Football Network",
    text: "Football events support city-based team discovery, fixture rounds, live match centers, venue details, and sponsor-backed community tournament storytelling.",
  },
  basketball: {
    title: "Indoor pro-series basketball events",
    date: "Oct 2026 series",
    sponsor: "Arena Sports Collective",
    text: "Basketball programs focus on compact rosters, fast scoring, player statistics, highlights, and clean public pages for fans, teams, sponsors, and organizers.",
  },
  volleyball: {
    title: "Completed volleyball records and galleries",
    date: "Dec 2025 archive",
    sponsor: "Kerala Sports Circle",
    text: "Volleyball tournament pages preserve completed brackets, team results, player details, gallery albums, match notes, and sponsor recognition after the event closes.",
  },
  badminton: {
    title: "Precision court events for schools and clubs",
    date: "2026 calendar",
    sponsor: "Indoor Court Partners",
    text: "Badminton events can support singles, doubles, age categories, registration approvals, round scheduling, certificates, and court-wise match reporting.",
  },
  "table-tennis": {
    title: "Table tennis ranking meets",
    date: "2026 ranking cycle",
    sponsor: "SmartSportz Ranking Desk",
    text: "Table tennis programs highlight fast match updates, category filters, ranking ladders, bracket progression, and player performance histories.",
  },
  esports: {
    title: "E-sports brackets and streaming rooms",
    date: "2026 digital season",
    sponsor: "Digital Arena Partners",
    text: "E-sports tournaments combine online registrations, team rosters, live video links, match rooms, bracket rules, and sponsor-led streaming content.",
  },
  athletics: {
    title: "Athletics meet management",
    date: "2026 meet schedule",
    sponsor: "City Athletics Council",
    text: "Athletics pages can organize events by discipline, school, city, timing, heat results, medal tables, certificates, and public records.",
  },
};

export function HomePage() {
  useWheelHorizontal();
  const [leaderboardSport, setLeaderboardSport] = useState("Cricket");
  const discoveryQueueRef = useRef<HTMLDivElement>(null);
  const sponsorQueueRef = useRef<HTMLDivElement>(null);
  const leaderboardFilterRef = useRef<HTMLDivElement>(null);
  const upcomingTournamentsRef = useRef<HTMLDivElement>(null);
  const registrationOpenRef = useRef<HTMLDivElement>(null);
  const liveTournamentsRef = useRef<HTMLDivElement>(null);
  const oldTournamentsRef = useRef<HTMLDivElement>(null);
  const newsRef = useRef<HTMLDivElement>(null);
  const organizerRef = useRef<HTMLDivElement>(null);
  const organizerCardRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [organizerIndex, setOrganizerIndex] = useState(0);
  const [activeNotice, setActiveNotice] = useState<TournamentNotice | null>(null);
  const [homeContent, setHomeContent] = useState<{
    discoveryCards?: Array<Record<string, any>>;
    liveHighlight?: Record<string, any> | null;
    sponsorLogos?: Array<Record<string, any>>;
  }>({});
  const runtimeTournaments = tournaments.map((item) => withRuntimeTournamentStatus(item));
  const featuredGroups = [
    {
      key: "featured",
      title: "Featured tournaments",
      text: "Manager-selected tournaments shown with title and place only.",
      ref: upcomingTournamentsRef,
      compact: true,
      items: runtimeTournaments.filter((item: any) => item.featureOnly || item.show_on_home === true).slice(0, 8),
    },
    {
      key: "upcoming",
      title: "Upcoming tournaments",
      text: "Registration-open tournaments where teams can enter now.",
      ref: registrationOpenRef,
      items: runtimeTournaments.filter((item) => item.status === "Registration Open"),
    },
    {
      key: "live",
      title: "Live tournaments",
      text: "Active tournaments with live match rooms and scoring updates.",
      ref: liveTournamentsRef,
      items: runtimeTournaments.filter((item) => item.status === "Live"),
    },
    {
      key: "old",
      title: "Old tournaments",
      text: "Completed tournament records and previous season archives.",
      ref: oldTournamentsRef,
      items: runtimeTournaments.filter((item) => item.status === "Completed"),
    },
  ].filter((group) => group.items.length > 0);
  const visibleFeaturedGroups = featuredGroups.filter((group) => ["featured", "upcoming"].includes(group.key));
  const homeSports = sportHomeVisibility
    .filter((item) => item.showOnHome)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((visibility) => sports.find((sport) => sport.slug === visibility.sportSlug))
    .filter(Boolean) as typeof sports;
  const oldMatchNews = newsPosts.filter((item) => item.category === "Winner Teams").slice(0, 3);
  const discoveryCards = homeContent.discoveryCards?.length ? homeContent.discoveryCards : homeSports.map((sport) => {
    const story = sportStoryCopy[sport.slug] ?? sportStoryCopy.cricket;
    return {
      slug: sport.slug,
      label: sport.name,
      title: story.title,
      sponsor_name: story.sponsor,
      event_date: story.date,
      image: sportStoryImages[sport.slug] ?? assets.cricket,
    };
  });
  const discoveryQueue = discoveryCards;
  const sponsorLogos = homeContent.sponsorLogos?.length ? homeContent.sponsorLogos : [
    { slug: "smartsportz", name: "SmartSportz", image: "/assets/logo.png", link_url: "https://smart-sportz-dun.vercel.app/" },
    { slug: "brillaris", name: "Brillaris", image: "https://brillaris.pro/assets/img/Logo1.png", link_url: "https://brillaris.pro" },
    { slug: "machaxi", name: "Machaxi", image: "https://machaxiprod.blob.core.windows.net/frontend-machaxi/logomark.webp", link_url: "https://machaxi.com" },
  ];
  const sponsorQueue = sponsorLogos.length > 1 ? [...sponsorLogos, ...sponsorLogos] : sponsorLogos;
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
  const moveOrganizer = (direction: "left" | "right") => {
    setOrganizerIndex((current) => {
      const next = direction === "left"
        ? (current - 1 + organizerTools.length) % organizerTools.length
        : (current + 1) % organizerTools.length;
      return next;
    });
  };

  const scrollQueue = (ref: RefObject<HTMLDivElement | null>, direction: "left" | "right") => {
    const element = ref.current;
    if (!element) return;
    const amount = Math.max(260, Math.floor(element.clientWidth * 0.72));
    element.scrollBy({ left: direction === "left" ? -amount : amount, behavior: "smooth" });
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
    apiRequest<{
      discoveryCards: Array<Record<string, any>>;
      liveHighlight: Record<string, any> | null;
      sponsorLogos: Array<Record<string, any>>;
    }>("/public/home")
      .then(setHomeContent)
      .catch(() => setHomeContent({}));
  }, []);

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
            <h2>Discover sports across categories</h2>
            <p>Sport stories, sponsors, tournament dates, and event pathways are grouped for quick discovery.</p>
          </div>
          <Link className="inline-link" to="/sports">View All Sports</Link>
        </div>
        <div className="queue-shell discovery-queue-shell">
          <div className="queue-controls left">
            <button type="button" aria-label="Scroll sports left" onClick={() => scrollQueue(discoveryQueueRef, "left")}>‹</button>
          </div>
          <div className="queue-controls right">
            <button type="button" aria-label="Scroll sports right" onClick={() => scrollQueue(discoveryQueueRef, "right")}>›</button>
          </div>
          <div className="queue-track discovery-queue-track wheel-horizontal" ref={discoveryQueueRef}>
          {discoveryQueue.map((card, index) => {
            return (
              <Link className="sport-home-card click-card" to={`/discover/${card.slug}`} key={`${card.slug}-${index}`}>
                <img src={assetUrl(card.image || assets.cricket)} alt="" />
                <div className="sport-home-card-body">
                  <span className="status emerald">{card.label}</span>
                  <h3>{card.title}</h3>
                  <p><MapPin size={14} /> {card.sponsor_name}</p>
                  <small>{card.event_date}</small>
                </div>
              </Link>
            );
          })}
          </div>
        </div>
      </section>
      <section className="section">
        <div className="section-title row-title">
          <div>
            <p className="eyebrow">Tournament Discovery</p>
            <h2>Tournament highlights</h2>
            <p>Manager-selected features, open registration, live tournaments, and old records are separated clearly.</p>
          </div>
        </div>
        <div className="featured-status-stack">
          {visibleFeaturedGroups.map((group) => (
            <section className="featured-status-row" key={group.key}>
              <div className="featured-status-head">
                <div>
                  <h3>{group.title}</h3>
                  <p>{group.text}</p>
                </div>
              </div>
              <div className="carousel-shell">
                <div className="card-grid carousel-row wheel-horizontal featured-carousel featured-status-carousel" ref={group.ref}>
                  {group.items.map((item) => group.compact
                    ? <FeaturedTournamentMiniCard key={item.slug} item={item} />
                    : <TournamentCard key={item.slug} item={item} />,
                  )}
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
          <img src={homeContent.liveHighlight?.image || assets.football} alt="Live analytics match" />
          <button type="button"><Radio size={24} /></button>
        </motion.div>
        <motion.div {...fade}>
          <span className="live-dot">{homeContent.liveHighlight?.stage_label || "Live Now"}</span>
          <h2>{homeContent.liveHighlight?.title || "Experience Every Match Live with Pro Analytics"}</h2>
          <div className="live-action-row">
            <div className="score-mini-card">
              <span>{homeContent.liveHighlight?.home_team || "Wings SC"}</span>
              <strong>{homeContent.liveHighlight ? `${homeContent.liveHighlight.home_score} - ${homeContent.liveHighlight.away_score}` : "128 - 110"}</strong>
              <span>{homeContent.liveHighlight?.away_team || "Titans Acad."}</span>
            </div>
            <Link className="btn btn-primary live-center-btn" to={homeContent.liveHighlight?.link_path || "/live"}>Open Match Center</Link>
          </div>
          <p className="live-highlight-copy">{homeContent.liveHighlight?.description || "High-impact live moments surface automatically from semi-finals, finals, and active match centers."}</p>
          <div className="feature-list">
            {(homeContent.liveHighlight?.impact_notes ? String(homeContent.liveHighlight.impact_notes).split(/\.|\|/).filter(Boolean).slice(0, 2) : ["Instant AI-powered highlights for every match", "Heatmaps and advanced performance telemetry"]).map((feature) => (
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
        <div className="queue-shell organizer-shell">
          <div className="queue-controls left">
            <button type="button" aria-label="Scroll organizer tools left" onClick={() => moveOrganizer("left")}>‹</button>
          </div>
          <div className="queue-controls right">
            <button type="button" aria-label="Scroll organizer tools right" onClick={() => moveOrganizer("right")}>›</button>
          </div>
          <div className="queue-track organizer-grid wheel-horizontal" ref={organizerRef}>
          {[...organizerTools, ...organizerTools].map((tool, index) => (
            <div
              className={`panel organizer-card ${index === organizerIndex ? "is-active" : ""}`}
              key={`${tool}-${index}`}
              ref={(element) => { organizerCardRefs.current[index] = element; }}
            >
              <ShieldCheck size={18} /><h3>{tool}</h3><p>Premium workflow controls for secure tournament operations.</p>
            </div>
          ))}
        </div>
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
          </div>
        </div>
        <div className="carousel-shell">
          <div className="content-grid carousel-row wheel-horizontal news-carousel" ref={newsRef}>
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
      <section className="section" id="home-leaderboards" hidden aria-hidden="true">
        <div className="section-title row-title">
          <div>
            <p className="eyebrow">Rankings</p>
            <h2>Sport Leaderboards</h2>
            <p>Select any sport category here and inspect records by rank without leaving the homepage.</p>
          </div>
        </div>
        <div className="leaderboard-filter-shell">
          <div className="leaderboard-filter wheel-horizontal home-leaderboard-filter" ref={leaderboardFilterRef}>
            {sports.map((sport) => (
              <button className={sport.name === leaderboardSport ? "active" : ""} type="button" onClick={() => setLeaderboardSport(sport.name)} key={sport.slug}>{sport.name}</button>
            ))}
          </div>
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
      <section className="section sponsor-logo-section">
        <SectionTitle eyebrow="Partner Network" title="Sponsor Companies" text="Official platform, technology, experience, and archive partners connected to Smart Sportz." />
        <div className="queue-shell sponsor-logo-shell">
          <div className="queue-controls left">
            <button type="button" aria-label="Scroll sponsor logos left" onClick={() => scrollQueue(sponsorQueueRef, "left")}>‹</button>
          </div>
          <div className="queue-controls right">
            <button type="button" aria-label="Scroll sponsor logos right" onClick={() => scrollQueue(sponsorQueueRef, "right")}>›</button>
          </div>
          <div className="queue-track sponsor-logo-grid wheel-horizontal" ref={sponsorQueueRef}>
          {sponsorQueue.map((sponsor, index) => (
            <a className="sponsor-logo-card" href={externalUrl(sponsor.link_url)} target="_blank" rel="noreferrer" key={`${sponsor.slug}-${index}`} aria-label={sponsor.name}>
              <img src={assetUrl(sponsor.image)} alt="" />
            </a>
          ))}
          </div>
        </div>
      </section>
    </Page>
  );
}

