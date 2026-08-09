import { Link } from "react-router-dom";
import { Page } from "../components/UI";
import { assets, sports } from "../data/platform";

function assetUrl(path: string) {
  if (/^(https?:|data:|blob:)/i.test(path)) return path;
  if (path.startsWith(import.meta.env.BASE_URL)) return path;
  if (/^\/(assets|media)\//.test(path)) return `${import.meta.env.BASE_URL}${path.replace(/^\//, "")}`;
  return path;
}

const sportDetails: Record<string, {
  title: string;
  image: string;
  season: string;
  sponsor: string;
  contact: string;
  description: string;
  operations: string;
}> = {
  chess: {
    title: "Chess Championship Operations",
    image: "/assets/generated/sport-chess-sponsor.png",
    season: "Winter 2026 planning window",
    sponsor: "Mind Sports Development Desk",
    contact: "City academy coordinators and school tournament committees",
    description: "Chess events in Smart Sportz can be managed as school meets, academy leagues, open city championships, or corporate mind-sport festivals. The platform structure supports player identity, category selection, round allocation, result entry, certificates, and public ranking records.",
    operations: "Organizers can publish tournament rules, sponsor notes, venue details, round timing, arbiters, participant instructions, and final standings in one structured page.",
  },
  cricket: {
    title: "Cricket League Management",
    image: assets.cricket,
    season: "Aug 2026 registration and match season",
    sponsor: "SmartSportz Premier Partners",
    contact: "Mumbai, Bengaluru, Delhi, and corporate league managers",
    description: "Cricket is designed for full tournament operations: team registration, captain and roster verification, payment collection, fixture generation, live score updates, overs, wickets, player scores, match highlights, and sponsor promotion.",
    operations: "Each tournament page can include registration windows, city selection, team member count, prize slabs, rulebooks, payment receipts, QR passes, live score rooms, and completed match archives.",
  },
  football: {
    title: "Football Tournament Circuits",
    image: assets.football,
    season: "Sep 2026 youth and club calendar",
    sponsor: "Grassroots Football Network",
    contact: "Club organizers, school federations, and venue partners",
    description: "Football pages support squad-based registration, city-wise tournament discovery, match scheduling, substitutions, cards, goals, highlights, brackets, completed scores, and gallery publishing after each round.",
    operations: "Sponsors, managers, and event staff can maintain venue information, team approvals, player lists, live match records, and public-facing tournament stories.",
  },
  basketball: {
    title: "Basketball Pro-Series Events",
    image: assets.basketball,
    season: "Oct 2026 indoor arena series",
    sponsor: "Arena Sports Collective",
    contact: "Indoor venue teams and pro-series coordinators",
    description: "Basketball tournaments need compact rosters, fast match updates, points tracking, team statistics, individual records, live video support, and polished public cards for each event.",
    operations: "Smart Sportz can organize sponsor placements, payment summaries, match centers, team pages, completed round archives, and winner stories.",
  },
  volleyball: {
    title: "Volleyball Classics And Archives",
    image: assets.volleyball,
    season: "Dec 2025 completed event archive",
    sponsor: "Kerala Sports Circle",
    contact: "District sports councils and court managers",
    description: "Volleyball events combine roster registration, round fixtures, set scores, player records, media galleries, final results, and archived winner content for completed tournaments.",
    operations: "The public view can show tournament month, team totals, prize values, gallery albums, round media, likes, comments, and shareable image links.",
  },
  badminton: {
    title: "Badminton Court Events",
    image: "/assets/generated/sport-badminton-sponsor.png",
    season: "2026 indoor court calendar",
    sponsor: "Indoor Court Partners",
    contact: "Academy owners, school sports teams, and local associations",
    description: "Badminton programs can support singles, doubles, category rules, court timing, player check-in, round progression, score entry, certificates, and winner records.",
    operations: "Managers can publish sport-specific rules, player categories, venue contacts, registration documents, and sponsor announcements.",
  },
  "table-tennis": {
    title: "Table Tennis Ranking Meets",
    image: "/assets/generated/sport-table-tennis-sponsor.png",
    season: "2026 ranking cycle",
    sponsor: "SmartSportz Ranking Desk",
    contact: "Club ranking committees and indoor sports venues",
    description: "Table tennis pages can handle fast brackets, group stages, player ranking, live score notes, knockout rounds, completed scorecards, and public player records.",
    operations: "The system can present match schedules, sponsors, city filters, category details, and downloadable results for players and organizers.",
  },
  esports: {
    title: "E-Sports Streaming Brackets",
    image: assets.basketball,
    season: "2026 digital season",
    sponsor: "Digital Arena Partners",
    contact: "Online event hosts, stream teams, and college gaming clubs",
    description: "E-sports tournaments need online team registration, bracket rooms, live video links, match proof, player aliases, sponsor banners, and quick announcement updates.",
    operations: "Smart Sportz can connect team approvals, payments, match records, video highlights, news updates, and public bracket progression.",
  },
  athletics: {
    title: "Athletics Meet Records",
    image: "/assets/generated/sport-athletics-sponsor.png",
    season: "2026 meet schedule",
    sponsor: "City Athletics Council",
    contact: "Schools, colleges, city meets, and sports federations",
    description: "Athletics events can be structured by discipline, age group, heat, timing, lane assignment, medal records, certificates, and historical performance tracking.",
    operations: "Public pages can include meet dates, sponsors, venue contacts, result downloads, media albums, and leaderboard records.",
  },
};

const sportOrder = ["chess", "cricket", "football", "basketball", "volleyball", "badminton", "table-tennis", "esports", "athletics"];

function normaliseSlug(slug: string) {
  return slug === "e-sports" ? "esports" : slug;
}

export function SportsPage() {
  const items = sportOrder.map((slug) => {
    const sport = sports.find((item) => normaliseSlug(item.slug) === slug) ?? { name: slug.replace("-", " "), slug };
    return { sport, detail: sportDetails[slug] };
  }).filter((item) => item.detail);

  return (
    <Page className="sports-editorial-page">
      <section className="page-hero sports-hero-clean">
        <p className="eyebrow">SmartSportz Sports</p>
        <h1>Sport Programs And Tournament Operations</h1>
        <p>Explore how each sport can be presented with tournaments, sponsors, dates, contacts, player records, and manager-controlled public content.</p>
      </section>
      <div className="sports-editorial-list">
        {items.map(({ sport, detail }, index) => (
          <section className={`sports-editorial-row ${index % 2 ? "reverse" : ""}`} key={sport.slug}>
            <div className="sports-editorial-copy">
              <h2>{detail.title}</h2>
              <p>{detail.description}</p>
              <p>{detail.operations}</p>
              <dl>
                <div><dt>Season</dt><dd>{detail.season}</dd></div>
                <div><dt>Sponsor</dt><dd>{detail.sponsor}</dd></div>
                <div><dt>Contact</dt><dd>{detail.contact}</dd></div>
              </dl>
              <Link className="inline-link" to={`/sports/${sport.slug}`}>Open {sport.name} tournaments</Link>
            </div>
            <div className="sports-editorial-image">
              <img src={assetUrl(detail.image)} alt="" />
            </div>
          </section>
        ))}
      </div>
    </Page>
  );
}
