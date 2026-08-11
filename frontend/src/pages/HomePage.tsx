import { motion } from "framer-motion";
import { BarChart3, CheckCircle2, MapPin, Radio, ShieldCheck, Trophy, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Page, SectionTitle, TournamentCard } from "../components/UI";
import { assets, leaderboardRecords, sports, withRuntimeTournamentStatus } from "../data/platform";
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

function useAutoScroll(el: HTMLElement | null, isHovered: boolean, speed = 1, loopItemCount = 0) {
  useEffect(() => {
    if (!el || isHovered) return;
    const loopStart = loopItemCount > 0 ? (el.children.item(loopItemCount) as HTMLElement | null)?.offsetLeft ?? 0 : 0;
    if (el.scrollWidth <= el.clientWidth + 1 || (loopItemCount > 0 && loopStart <= el.clientWidth)) return;
    
    let animationId: number;
    let lastTimestamp = 0;

    const loop = (timestamp: number) => {
      if (!lastTimestamp) lastTimestamp = timestamp;
      const delta = timestamp - lastTimestamp;
      
      // Move approximately based on speed every frame
      if (delta > 16) {
        el.scrollLeft += speed;
        lastTimestamp = timestamp;
      }

      if (loopStart > 0 && el.scrollLeft >= loopStart) {
        el.scrollLeft -= loopStart;
      } else if (el.scrollLeft >= el.scrollWidth - el.clientWidth - 1) {
        el.scrollLeft = 0;
      }

      animationId = requestAnimationFrame(loop);
    };
    
    animationId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationId);
  }, [el, isHovered, speed, loopItemCount]);
}

type ProgressiveQuery<T> = {
  queryKey: readonly unknown[];
  queryFn: () => Promise<T>;
};

function SectionSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="home-section-skeleton" aria-hidden="true">
      {Array.from({ length: rows }).map((_, index) => <span key={index} />)}
    </div>
  );
}

function ProgressiveSection<T>({
  query,
  prefetch = [],
  skeletonRows = 3,
  children,
}: {
  query: ProgressiveQuery<T>;
  prefetch?: Array<ProgressiveQuery<unknown>>;
  skeletonRows?: number;
  children: (data: T) => React.ReactNode;
}) {
  const queryClient = useQueryClient();
  const [shouldLoad, setShouldLoad] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const result = useQuery({
    queryKey: query.queryKey,
    queryFn: query.queryFn,
    enabled: shouldLoad,
  });

  useEffect(() => {
    const node = containerRef.current;
    if (!node || shouldLoad) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setShouldLoad(true);
        prefetch.forEach((item) => {
          void queryClient.prefetchQuery({ queryKey: item.queryKey, queryFn: item.queryFn });
        });
        observer.disconnect();
      },
      { rootMargin: "720px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [prefetch, queryClient, shouldLoad]);

  return (
    <div ref={containerRef}>
      {!shouldLoad || result.isLoading ? <SectionSkeleton rows={skeletonRows} /> : result.data ? children(result.data) : null}
    </div>
  );
}

const homeApi = {
  notice: {
    queryKey: ["home", "notice"] as const,
    queryFn: () => apiRequest<Array<Record<string, any>>>("/public/home/notice", { silent: true }),
  },
  discovery: {
    queryKey: ["home", "discovery"] as const,
    queryFn: () => apiRequest<Array<Record<string, any>>>("/public/home/discovery", { silent: true }),
  },
  tournaments: {
    queryKey: ["home", "tournaments"] as const,
    queryFn: () => apiRequest<any[]>("/public/tournaments", { silent: true }),
  },
  liveHighlight: {
    queryKey: ["home", "live-highlight"] as const,
    queryFn: () => apiRequest<Record<string, any> | null>("/public/home/live-highlight", { silent: true }),
  },
  organizers: {
    queryKey: ["home", "organizers"] as const,
    queryFn: () => apiRequest<Array<Record<string, any>>>("/public/home/organizers", { silent: true }),
  },
  news: {
    queryKey: ["home", "news"] as const,
    queryFn: () => apiRequest<Array<Record<string, any>>>("/public/home/news", { silent: true }),
  },
  sponsors: {
    queryKey: ["home", "sponsors"] as const,
    queryFn: () => apiRequest<Array<Record<string, any>>>("/public/home/sponsors", { silent: true }),
  },
};

export function HomePage() {
  useWheelHorizontal();
  const [leaderboardSport, setLeaderboardSport] = useState("Cricket");
  const [discoveryEl, setDiscoveryEl] = useState<HTMLDivElement | null>(null);
  const discoveryQueueRef = useRef<HTMLDivElement | null>(null);
  const [sponsorEl, setSponsorEl] = useState<HTMLDivElement | null>(null);
  const sponsorQueueRef = useRef<HTMLDivElement | null>(null);
  const leaderboardFilterRef = useRef<HTMLDivElement>(null);
  const upcomingTournamentsRef = useRef<HTMLDivElement>(null);
  const registrationOpenRef = useRef<HTMLDivElement>(null);
  const liveTournamentsRef = useRef<HTMLDivElement>(null);
  const oldTournamentsRef = useRef<HTMLDivElement>(null);
  const newsRef = useRef<HTMLDivElement>(null);
  const [organizerEl, setOrganizerEl] = useState<HTMLDivElement | null>(null);
  const [organizerIndex, setOrganizerIndex] = useState(0);
  const [isOrganizerHovered, setIsOrganizerHovered] = useState(false);
  const [isDiscoveryHovered, setIsDiscoveryHovered] = useState(false);
  const [isSponsorHovered, setIsSponsorHovered] = useState(false);
  const [activeNotice, setActiveNotice] = useState<Record<string, any> | null>(null);
  const [loadNotice, setLoadNotice] = useState(false);
  const lifecycle = ["Register Team", "Secure Payment", "Fixture Draw", "Venue Check In", "Live Scoring", "Real-time Stats", "Finals & Awards", "Media Gallery", "Certificates"];
  const noticeQuery = useQuery({ ...homeApi.notice, enabled: loadNotice });

  const selectedLeaders = useMemo(
    () => leaderboardRecords.filter((record) => record.sport === leaderboardSport).sort((a, b) => a.rank - b.rank),
    [leaderboardSport],
  );

  const scrollQueue = (element: HTMLDivElement | null, direction: "left" | "right") => {
    if (!element) return;
    const amount = Math.max(300, Math.floor(element.clientWidth * 0.8));
    element.scrollBy({ left: direction === "left" ? -amount : amount, behavior: "smooth" });
  };

  useAutoScroll(organizerEl, isOrganizerHovered, 1);
  useAutoScroll(discoveryEl, isDiscoveryHovered, 1.2);
  useAutoScroll(sponsorEl, isSponsorHovered, 0.8);

  useEffect(() => {
    const timer = window.setTimeout(() => setLoadNotice(true), 900);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("screenshot") === "1") return;
    const notice = noticeQuery.data?.find((item) => item.published);
    if (!notice) return;
    const dismissedKey = `smart-sportz-notice-dismissed:${notice.id}`;
    if (sessionStorage.getItem(dismissedKey)) return;
    const timer = window.setTimeout(() => setActiveNotice(notice), 650);
    return () => window.clearTimeout(timer);
  }, [noticeQuery.data]);

  function closeNotice() {
    if (activeNotice) {
      sessionStorage.setItem(`smart-sportz-notice-dismissed:${activeNotice.id}`, "1");
    }
    setActiveNotice(null);
  }

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
              <Link className="btn btn-primary" to="/tournaments" onClick={closeNotice}>Open Tournament</Link>
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

      <ProgressiveSection query={homeApi.discovery} prefetch={[homeApi.tournaments]} skeletonRows={4}>
      {(discoveryQueue) => discoveryQueue.length > 0 ? <section className="section">
        <div className="section-title row-title">
          <div>
            <p className="eyebrow">Explore Your Sport</p>
            <h2>Discover sports across categories</h2>
            <p>Sport stories, sponsors, tournament dates, and event pathways are grouped for quick discovery.</p>
          </div>
          <Link className="inline-link" to="/sports">View All Sports</Link>
        </div>
        <div className="queue-shell discovery-queue-shell" onMouseEnter={() => setIsDiscoveryHovered(true)} onMouseLeave={() => setIsDiscoveryHovered(false)}>
          <div className="queue-controls left">
            <button type="button" aria-label="Scroll sports left" onClick={() => scrollQueue(discoveryQueueRef.current, "left")}>‹</button>
          </div>
          <div className="queue-controls right">
            <button type="button" aria-label="Scroll sports right" onClick={() => scrollQueue(discoveryQueueRef.current, "right")}>›</button>
          </div>
          <div className="queue-track discovery-queue-track wheel-horizontal" ref={(node) => { discoveryQueueRef.current = node; setDiscoveryEl(node); }}>
          {discoveryQueue.map((card, index) => (
            <Link className="sport-home-card click-card" to={`/discover/${card.slug}`} key={`${card.slug}-${index}`}>
              <img src={assetUrl(card.image || assets.cricket)} alt="" loading="lazy" />
              <div className="sport-home-card-body">
                <span className="status emerald">{card.label}</span>
                <h3>{card.title}</h3>
                <p><MapPin size={14} /> {card.sponsor_name}</p>
                <small>{card.event_date}</small>
              </div>
            </Link>
          ))}
          </div>
        </div>
      </section> : null}
      </ProgressiveSection>

      <ProgressiveSection query={homeApi.tournaments} prefetch={[homeApi.liveHighlight]} skeletonRows={5}>
      {(publicTournaments) => {
        const runtimeTournaments = publicTournaments.map((item) => withRuntimeTournamentStatus({
          ...item,
          registrationStart: item.registrationStart ?? item.registration_start,
          registrationEnd: item.registrationEnd ?? item.registration_end,
          tournamentDescription: item.tournamentDescription ?? item.tournament_description,
        }));
        const featuredGroups = [
          {
            key: "featured",
            title: "Upcoming Tournament",
            text: "Upcoming tournaments created by admin or manager.",
            ref: upcomingTournamentsRef,
            items: runtimeTournaments.filter((item) => item.status === "Upcoming").slice(0, 8),
          },
          {
            key: "upcoming",
            title: "Registration Open",
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
            text: "Registration-closed and completed tournament records with rounds available.",
            ref: oldTournamentsRef,
            items: runtimeTournaments.filter((item) => item.status === "Completed" || item.status === "Registration Closed"),
          },
        ].filter((group) => group.items.length > 0);
        const visibleFeaturedGroups = featuredGroups.filter((group) => ["featured", "upcoming"].includes(group.key));
        return visibleFeaturedGroups.length > 0 ? <section className="section">
        <div className="section-title row-title">
          <div>
            <p className="eyebrow">Tournament Discovery</p>
            <h2>Tournament highlights</h2>
            <p>Upcoming tournaments, open registrations, live tournaments, and old records are separated clearly.</p>
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
                  {group.items.map((item) => <TournamentCard key={item.slug} item={item} />)}
                </div>
              </div>
            </section>
          ))}
        </div>
      </section> : null;
      }}
      </ProgressiveSection>

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

      <ProgressiveSection query={homeApi.liveHighlight} prefetch={[homeApi.organizers]} skeletonRows={3}>
      {(liveHighlight) => liveHighlight ? <section className="section split live-analytics-section">
        <motion.div className="live-video-card" {...fade}>
          <img src={liveHighlight.image} alt="Live analytics match" loading="lazy" />
          <button type="button"><Radio size={24} /></button>
        </motion.div>
        <motion.div {...fade}>
          <span className="live-dot">{liveHighlight.stage_label || "Live Now"}</span>
          <h2>{liveHighlight.title}</h2>
          <div className="live-action-row">
            <div className="score-mini-card">
              <span>{liveHighlight.home_team}</span>
              <strong>{liveHighlight.home_score} - {liveHighlight.away_score}</strong>
              <span>{liveHighlight.away_team}</span>
            </div>
            <Link className="btn btn-primary live-center-btn" to={liveHighlight?.link_path || "/live"}>Open Match Center</Link>
          </div>
          <p className="live-highlight-copy">{liveHighlight.description}</p>
          <div className="feature-list">
            {String(liveHighlight.impact_notes || "").split(/\.|\|/).filter(Boolean).slice(0, 2).map((feature) => (
              <div className="feature-label" key={feature}><CheckCircle2 size={18} />{feature}</div>
            ))}
          </div>
        </motion.div>
      </section> : null}
      </ProgressiveSection>

      <ProgressiveSection query={homeApi.organizers} prefetch={[homeApi.news]} skeletonRows={3}>
      {(organizerQueue) => organizerQueue.length > 0 ? <section className="section">
        <div className="section-title row-title">
          <div>
            <h2>Empowering Tournament Organizers</h2>
            <p>All-in-one suite of professional tools to run world-class sports competitions.</p>
          </div>
        </div>
        <div className="queue-shell organizer-shell" onMouseEnter={() => setIsOrganizerHovered(true)} onMouseLeave={() => setIsOrganizerHovered(false)}>
          <div className="queue-controls left">
            <button type="button" aria-label="Scroll organizer tools left" onClick={() => scrollQueue(organizerEl, "left")}>‹</button>
          </div>
          <div className="queue-controls right">
            <button type="button" aria-label="Scroll organizer tools right" onClick={() => scrollQueue(organizerEl, "right")}>›</button>
          </div>
          <div className="queue-track organizer-grid wheel-horizontal" ref={setOrganizerEl}>
          {organizerQueue.map((tool, index) => (
            <div
              className={`panel organizer-card ${index === organizerIndex ? "is-active" : ""}`}
              key={`${tool.slug ?? tool.title}-${index}`}
            >
              <ShieldCheck size={18} /><h3>{tool.title}</h3><p>{tool.description}</p>
            </div>
          ))}
        </div>
        </div>
      </section> : null}
      </ProgressiveSection>

      <ProgressiveSection query={homeApi.news} prefetch={[homeApi.sponsors]} skeletonRows={3}>
      {(newsPosts) => {
        const oldMatchNews = newsPosts.filter((item) => item.category === "Winner Teams").slice(0, 3);
        return oldMatchNews.length > 0 ? <section className="section">
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
                <img src={assetUrl(post.image)} alt="" loading="lazy" />
              </div>
              <div className="news-card-copy">
                <span className="status emerald">{post.category}</span>
                <h3>{post.title}</h3>
                <p>{post.short_description}</p>
              </div>
            </Link>
          ))}
        </div>
        </div>
      </section> : null;
      }}
      </ProgressiveSection>

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

      <ProgressiveSection query={homeApi.sponsors} skeletonRows={2}>
      {(sponsorQueue) => sponsorQueue.length > 0 ? <section className="section sponsor-logo-section">
        <SectionTitle eyebrow="Partner Network" title="Sponsor Companies" text="Official platform, technology, experience, and archive partners connected to Smart Sportz." />
        <div className="queue-shell sponsor-logo-shell" onMouseEnter={() => setIsSponsorHovered(true)} onMouseLeave={() => setIsSponsorHovered(false)}>
          <div className="queue-controls left">
            <button type="button" aria-label="Scroll sponsor logos left" onClick={() => scrollQueue(sponsorQueueRef.current, "left")}>‹</button>
          </div>
          <div className="queue-controls right">
            <button type="button" aria-label="Scroll sponsor logos right" onClick={() => scrollQueue(sponsorQueueRef.current, "right")}>›</button>
          </div>
          <div className="queue-track sponsor-logo-grid wheel-horizontal" ref={(node) => { sponsorQueueRef.current = node; setSponsorEl(node); }}>
          {sponsorQueue.map((sponsor, index) => (
            <a className="sponsor-logo-card" href={externalUrl(sponsor.link_url)} target="_blank" rel="noreferrer" key={`${sponsor.slug}-${index}`} aria-label={sponsor.name}>
              <img src={assetUrl(sponsor.image)} alt="" loading="lazy" />
            </a>
          ))}
          </div>
        </div>
      </section> : null}
      </ProgressiveSection>
    </Page>
  );
}
