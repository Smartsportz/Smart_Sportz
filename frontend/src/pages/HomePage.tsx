import { motion } from "framer-motion";
import { BarChart3, CheckCircle2, MapPin, Radio, ShieldCheck, Trophy, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { useMemo, useState } from "react";
import { Page, SectionTitle, TournamentCard } from "../components/UI";
import { assets, leaderboardRecords, newsPosts, sportHomeVisibility, sports, tournaments } from "../data/platform";

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

export function HomePage() {
  const [leaderboardSport, setLeaderboardSport] = useState("Cricket");
  const featured = [...tournaments].sort((a, b) => {
    const priority = { Upcoming: 0, "Registration Open": 1, Live: 2, Completed: 3 } as Record<string, number>;
    return (priority[a.status] ?? 9) - (priority[b.status] ?? 9);
  }).slice(0, 3);
  const homeSports = sportHomeVisibility
    .filter((item) => item.showOnHome)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((visibility) => sports.find((sport) => sport.slug === visibility.sportSlug))
    .filter(Boolean) as typeof sports;
  const sportCounts = (name: string) => ({
    upcoming: tournaments.filter((item) => item.sport === name && ["Upcoming", "Registration Open"].includes(item.status)).length,
    live: tournaments.filter((item) => item.sport === name && item.status === "Live").length,
    old: tournaments.filter((item) => item.sport === name && item.status === "Completed").length,
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

  return (
    <Page className="home-reference-page">
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
        </motion.div>
      </section>
      <section className="hero-below-panel" aria-label="Live tournament shortcuts">
        <div className="match-chip-row">
          {[
            "Mumbai Live Matches",
            "Book a Facility",
            "Live Scoring",
            "News Updates",
          ].map((item) => <span key={item}>{item}</span>)}
        </div>
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
          ].map(([value, label]) => <div key={label}><strong>{value}</strong><span>{label}</span></div>)}
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
                <div>
                  <b>{counts.upcoming}</b><small>Upcoming</small>
                  <b>{counts.live}</b><small>Live</small>
                  <b>{counts.old}</b><small>Old</small>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
      <section className="section">
        <SectionTitle eyebrow="Tournament Discovery" title="Featured tournaments" text="Premium light theme by default, designed from the Remix UI references." />
        <div className="card-grid">{featured.map((item) => <TournamentCard key={item.slug} item={item} />)}</div>
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
          <div className="score-mini-card">
            <span>Wings SC</span>
            <strong>128 - 110</strong>
            <span>Titans Acad.</span>
          </div>
          <Link className="btn btn-primary wide" to="/live">Open Match Center</Link>
          <div className="feature-list">
            {["Instant AI-powered highlights for every match", "Heatmaps and advanced performance telemetry"].map((feature) => (
              <div className="feature-label" key={feature}><CheckCircle2 size={18} />{feature}</div>
            ))}
          </div>
        </motion.div>
      </section>
      <section className="section">
        <SectionTitle title="Empowering Tournament Organizers" text="All-in-one suite of professional tools to run world-class sports competitions." />
        <div className="organizer-grid">
          {organizerTools.map((tool) => <div className="panel organizer-card" key={tool}><ShieldCheck size={18} /><h3>{tool}</h3><p>Premium workflow controls for secure tournament operations.</p></div>)}
        </div>
      </section>
      <section className="section">
        <div className="section-title row-title">
          <div>
            <p className="eyebrow">Old Match News</p>
            <h2>Completed match records and winner stories</h2>
            <p>Open a card to read the full news article and match archive details.</p>
          </div>
          <Link className="inline-link" to="/news">View More News</Link>
        </div>
        <div className="content-grid">
          {oldMatchNews.map((post) => (
            <Link className="panel news-card click-card" to={`/news/${post.slug}`} key={post.slug}>
              <img src={post.image} alt="" />
              <span className="status emerald">{post.category}</span>
              <h3>{post.title}</h3>
              <p>{post.shortDescription}</p>
            </Link>
          ))}
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
        <div className="leaderboard-filter home-leaderboard-filter">
          {sports.map((sport) => (
            <button className={sport.name === leaderboardSport ? "active" : ""} type="button" onClick={() => setLeaderboardSport(sport.name)} key={sport.slug}>{sport.name}</button>
          ))}
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
