import { motion } from "framer-motion";
import { BarChart3, CheckCircle2, Radio, ShieldCheck, Trophy, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { Page, SectionTitle, TournamentCard } from "../components/UI";
import { assets, tournaments } from "../data/platform";

const fade = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.55 },
};

const featureLinks = [
  "Real-time score sync",
  "Razorpay-ready registration",
  "Tournament fixture control",
  "CMS and sponsor content",
  "Role-based dashboards",
];

export function HomePage() {
  const featured = [...tournaments].sort((a, b) => {
    const priority = { Upcoming: 0, "Registration Open": 1, Live: 2, Completed: 3 } as Record<string, number>;
    return (priority[a.status] ?? 9) - (priority[b.status] ?? 9);
  }).slice(0, 3);

  return (
    <Page>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">India&apos;s smart tournament management platform</span>
          <h1>Elevate Your Tournament Management</h1>
          <p>Run registrations, live scores, payments, teams, venues, sponsors, and reports from one premium enterprise sports platform.</p>
          <div className="hero-actions">
            <Link className="btn btn-primary" to="/tournaments">Explore tournaments</Link>
            <Link className="btn btn-secondary" to="/tournaments">Register team</Link>
          </div>
          <div className="hero-stats">
            {["500+ Events", "12K+ Athletes", "99.9% Sync"].map((item) => <span key={item}>{item}</span>)}
          </div>
        </div>
        <motion.div className="hero-panel" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7 }}>
          <img className="hero-image" src={assets.cricket} alt="Smart Sportz cricket stadium hero" />
          <div className="floating-score">
            <span className="live-dot">Live</span>
            <strong>156/4</strong>
            <small>Corporate T20 - Over 18.4</small>
          </div>
        </motion.div>
      </section>
      <section className="section">
        <SectionTitle eyebrow="Tournament Discovery" title="Featured tournaments" text="Premium light theme by default, designed from the Remix UI references." />
        <div className="card-grid">{featured.map((item) => <TournamentCard key={item.slug} item={item} />)}</div>
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
