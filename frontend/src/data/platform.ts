import {
  Activity,
  BarChart3,
  CalendarDays,
  CircleDollarSign,
  FileText,
  Flame,
  GalleryHorizontal,
  LifeBuoy,
  MapPin,
  Medal,
  Settings,
  ShieldCheck,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import basketballMatch from "../assets/basketball-match.png";
import cricketStadium from "../assets/cricket-stadium.png";
import dashboardSheet from "../assets/dashboard-sheet.png";
import footballMatch from "../assets/football-match.png";
import publicSheet from "../assets/public-sheet.png";
import volleyballMatch from "../assets/volleyball-match.png";

export const assets = {
  cricket: cricketStadium,
  football: footballMatch,
  basketball: basketballMatch,
  volleyball: volleyballMatch,
  publicSheet,
  dashboardSheet,
};

export const navItems = [
  { label: "Home", path: "/" },
  { label: "Tournament", path: "/tournaments" },
  { label: "Gallery", path: "/gallery" },
  { label: "Live", path: "/live" },
  { label: "News", path: "/news" },
  { label: "Sports", path: "/sports" },
  { label: "Teams", path: "/teams" },
  { label: "Contact", path: "/contact" },
];

export const tournaments = [
  {
    slug: "smart-sportz-city-cup-showcase",
    name: "Smart Sportz City Cup Showcase",
    sport: "Multi Sport",
    status: "Featured",
    phase: "featured",
    location: "India",
    date: "2026 Season",
    registrationStart: "",
    registrationEnd: "",
    cities: ["Mumbai", "Bengaluru", "Chennai"],
    teams: 0,
    capacity: 0,
    teamSize: 0,
    minAge: 0,
    maxAge: 0,
    prize: "",
    image: assets.cricket,
    poster: "/assets/poster.jpeg",
    accent: "emerald",
    show_on_home: true,
    featureOnly: true,
    tournamentDescription: "A manager-selected tournament showcase for premium public discovery, city interest, and event promotion.",
  },
  {
    slug: "mumbai-premier-bash",
    name: "Mumbai Premier Bash 2026",
    sport: "Cricket",
    status: "Registration Open",
    phase: "upcoming",
    location: "Mumbai",
    date: "Aug 14 - Sep 02",
    registrationStart: "Jul 24, 2026",
    registrationEnd: "Aug 10, 2026",
    cities: ["Mumbai", "Navi Mumbai", "Thane"],
    teams: 32,
    capacity: 48,
    teamSize: 16,
    minAge: 18,
    maxAge: 45,
    prize: "₹25,00,000",
    image: assets.cricket,
    poster: "/assets/poster.jpeg",
    accent: "emerald",
  },
  {
    slug: "bangalore-corporate-t20",
    name: "Bangalore Corporate T20",
    sport: "Cricket",
    status: "Live",
    phase: "live",
    location: "Bengaluru",
    date: "Jul 25 - Aug 05",
    registrationStart: "Jul 01, 2026",
    registrationEnd: "Jul 20, 2026",
    cities: ["Bengaluru", "Mysuru"],
    teams: 18,
    capacity: 24,
    teamSize: 16,
    minAge: 18,
    maxAge: 50,
    prize: "₹12,00,000",
    image: assets.cricket,
    poster: "/assets/poster.jpeg",
    accent: "orange",
  },
  {
    slug: "national-youth-football",
    name: "National Youth Football Cup",
    sport: "Football",
    status: "Upcoming",
    phase: "upcoming",
    location: "Delhi",
    date: "Sep 12 - Sep 20",
    registrationStart: "Aug 01, 2026",
    registrationEnd: "Sep 05, 2026",
    cities: ["Delhi", "Noida", "Gurugram"],
    teams: 24,
    capacity: 32,
    teamSize: 22,
    minAge: 14,
    maxAge: 19,
    prize: "₹8,50,000",
    image: assets.football,
    poster: "/assets/poster.jpeg",
    accent: "blue",
  },
  {
    slug: "pro-elite-basketball",
    name: "Pro Elite Basketball Series",
    sport: "Basketball",
    status: "Registration Open",
    phase: "upcoming",
    location: "Chennai",
    date: "Oct 04 - Oct 12",
    registrationStart: "Jul 24, 2026",
    registrationEnd: "Sep 25, 2026",
    cities: ["Chennai", "Coimbatore", "Madurai"],
    teams: 16,
    capacity: 16,
    teamSize: 12,
    minAge: 18,
    maxAge: 40,
    prize: "₹10,00,000",
    image: assets.basketball,
    poster: "/assets/poster.jpeg",
    accent: "emerald",
  },
  {
    slug: "kerala-volleyball-classic",
    name: "Kerala Volleyball Classic 2025",
    sport: "Volleyball",
    status: "Completed",
    phase: "existing",
    location: "Kochi",
    date: "Dec 02 - Dec 12",
    registrationStart: "Oct 15, 2025",
    registrationEnd: "Nov 25, 2025",
    cities: ["Kochi", "Kozhikode", "Thiruvananthapuram"],
    teams: 20,
    capacity: 20,
    teamSize: 12,
    minAge: 16,
    maxAge: 38,
    prize: "₹6,00,000",
    image: assets.volleyball,
    poster: "/assets/poster.jpeg",
    accent: "pink",
  },
  {
    slug: "delhi-cricket-champions",
    name: "Delhi Cricket Champions 2025",
    sport: "Cricket",
    status: "Completed",
    phase: "existing",
    location: "Delhi",
    date: "Nov 05 - Nov 24",
    registrationStart: "Sep 20, 2025",
    registrationEnd: "Oct 25, 2025",
    cities: ["Delhi", "Faridabad"],
    teams: 20,
    capacity: 20,
    teamSize: 16,
    minAge: 18,
    maxAge: 45,
    prize: "₹15,00,000",
    image: assets.cricket,
    poster: "/assets/poster.jpeg",
    accent: "blue",
  },
];

export type TournamentStatus = "Upcoming" | "Registration Open" | "Registration Closed" | "Live" | "Completed";

function parseRegistrationDate(value: string) {
  const parsed = new Date(`${value} 00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getRuntimeTournamentStatus(item: { status: string; registrationStart?: string; registrationEnd?: string }) {
  if (item.status === "Live" || item.status === "Completed") {
    return item.status as TournamentStatus;
  }
  const start = parseRegistrationDate(item.registrationStart ?? "");
  const end = parseRegistrationDate(item.registrationEnd ?? "");
  if (!start || !end) {
    return item.status as TournamentStatus;
  }
  const today = new Date();
  if (today < start) {
    return "Upcoming";
  }
  if (today > end) {
    return "Registration Closed";
  }
  return "Registration Open";
}

export function getRuntimeTournamentAccent(status: string, fallback: string) {
  if (status === "Registration Open") return "emerald";
  if (status === "Upcoming") return "blue";
  if (status === "Registration Closed") return "slate";
  return fallback;
}

export function withRuntimeTournamentStatus<T extends { status: string; accent: string; registrationStart?: string; registrationEnd?: string }>(item: T) {
  const status = getRuntimeTournamentStatus(item);
  return { ...item, status, accent: getRuntimeTournamentAccent(status, item.accent) };
}

export type TournamentNotice = {
  id: string;
  tournamentSlug: string;
  title: string;
  description: string;
  image: string;
  published: boolean;
  updatedBy: "admin" | "manager";
};

export const tournamentNotices: TournamentNotice[] = [
  {
    id: "notice_mumbai_premier_registration",
    tournamentSlug: "mumbai-premier-bash",
    title: "Mumbai Premier Bash registration window is live",
    description: "Teams from Mumbai, Navi Mumbai, and Thane can submit roster, documents, and payment before the final registration deadline.",
    image: assets.cricket,
    published: true,
    updatedBy: "manager",
  },
];

export const liveMatches = [
  {
    id: "match-48",
    tournament: "Bangalore Corporate T20",
    sport: "Cricket",
    home: "India Forge",
    away: "England XI",
    score: "156/4",
    awayScore: "Yet to bat",
    stage: "Over 18.4",
    status: "Live Now",
    image: assets.cricket,
  },
  {
    id: "match-72",
    tournament: "Pro Elite Basketball Series",
    sport: "Basketball",
    home: "Titans United",
    away: "Phoenix Fire",
    score: "58",
    awayScore: "62",
    stage: "Q3 08:39",
    status: "Live Now",
    image: assets.basketball,
  },
  {
    id: "match-21",
    tournament: "Youth Football Cup",
    sport: "Football",
    home: "Bengaluru Bulls",
    away: "Mumbai Mavericks",
    score: "2",
    awayScore: "1",
    stage: "78 min",
    status: "Second Half",
    image: assets.football,
  },
];

export type TournamentArchivePlayer = {
  team: string;
  name: string;
  role: string;
  score: string;
  record: string;
};

export type TournamentArchiveMatch = {
  id: string;
  round: string;
  title: string;
  teamA: string;
  teamB: string;
  scoreA: string;
  scoreB: string;
  winner: string;
  venue: string;
  date: string;
  videoUrl: string;
  summary: string;
  players: TournamentArchivePlayer[];
};

export type TournamentArchive = {
  tournamentSlug: string;
  champion: string;
  runnerUp: string;
  mvp: string;
  finalScore: string;
  attendance: string;
  investment: string;
  partners: string[];
  managers: string[];
  operations: string[];
  description: string;
  rounds: Array<{
    name: string;
    stageNote: string;
    matches: TournamentArchiveMatch[];
  }>;
};

const cricketArchivePlayers = (teamA: string, teamB: string): TournamentArchivePlayer[] => [
  { team: teamA, name: "Rohan Sharma", role: "Captain", score: "74 (42)", record: "Player of the match" },
  { team: teamA, name: "Nikhil Rao", role: "All-rounder", score: "39 (24) + 1/18", record: "Best impact phase" },
  { team: teamA, name: "Amit Varma", role: "Bowler", score: "3/22", record: "Powerplay wickets" },
  { team: teamB, name: "Kabir Malik", role: "Opener", score: "52 (38)", record: "Top scorer" },
  { team: teamB, name: "Imran Ali", role: "Bowler", score: "2/26", record: "Death over control" },
  { team: teamB, name: "Vikram Sen", role: "Keeper", score: "31 (19)", record: "Fast finish attempt" },
];

const volleyballArchivePlayers = (teamA: string, teamB: string): TournamentArchivePlayer[] => [
  { team: teamA, name: "Arun Dev", role: "Setter", score: "42 assists", record: "Best setter" },
  { team: teamA, name: "Kiran Thomas", role: "Outside hitter", score: "21 kills", record: "Final MVP" },
  { team: teamA, name: "Joseph Mathew", role: "Libero", score: "18 digs", record: "Defensive leader" },
  { team: teamB, name: "Vishnu Raj", role: "Middle blocker", score: "7 blocks", record: "Net control" },
  { team: teamB, name: "Sameer Khan", role: "Opposite", score: "19 points", record: "Best attack run" },
  { team: teamB, name: "Rahul Menon", role: "Setter", score: "36 assists", record: "Tempo control" },
];

export const tournamentArchives: TournamentArchive[] = [
  {
    tournamentSlug: "kerala-volleyball-classic",
    champion: "Kochi Spikers",
    runnerUp: "Calicut Smashers",
    mvp: "Kiran Thomas",
    finalScore: "25-21, 22-25, 25-19, 25-23",
    attendance: "18,400 total spectators",
    investment: "INR 38L operations, broadcast, venue, and prize support",
    partners: ["Kerala Sports Council", "SmartSportz Media", "Pulse Hydration"],
    managers: ["Anil Joseph - Tournament Director", "Meera Nair - Match Operations", "Rahul Das - Media Lead"],
    operations: ["20-team knockout draw", "6 venue courts", "32 published match reports", "Digital certificates issued"],
    description: "Completed volleyball season archive with official scorecards, round-wise media, partner visibility, manager notes, and team/player records.",
    rounds: [
      {
        name: "Quarter Final",
        stageNote: "Four elimination matches with live score verification and replay review.",
        matches: [
          { id: "kv-qf-1", round: "Quarter Final", title: "Kochi Spikers vs Trivandrum Aces", teamA: "Kochi Spikers", teamB: "Trivandrum Aces", scoreA: "3", scoreB: "1", winner: "Kochi Spikers", venue: "Rajiv Gandhi Indoor Stadium", date: "Dec 07, 2025", videoUrl: "https://www.youtube.com/embed/ThqHtJOfCK0", summary: "Kochi controlled serve pressure early and closed the fourth set through repeated left-side attacks.", players: volleyballArchivePlayers("Kochi Spikers", "Trivandrum Aces") },
          { id: "kv-qf-2", round: "Quarter Final", title: "Calicut Smashers vs Thrissur Nets", teamA: "Calicut Smashers", teamB: "Thrissur Nets", scoreA: "3", scoreB: "2", winner: "Calicut Smashers", venue: "Kochi Central Court", date: "Dec 08, 2025", videoUrl: "https://www.youtube.com/embed/ysz5S6PUM-U", summary: "Calicut survived two match-point phases and advanced through a disciplined fifth-set block rotation.", players: volleyballArchivePlayers("Calicut Smashers", "Thrissur Nets") },
        ],
      },
      {
        name: "Semi Final",
        stageNote: "Top four teams advanced into a two-match semi-final night.",
        matches: [
          { id: "kv-sf-1", round: "Semi Final", title: "Kochi Spikers vs Kannur Royals", teamA: "Kochi Spikers", teamB: "Kannur Royals", scoreA: "3", scoreB: "0", winner: "Kochi Spikers", venue: "Rajiv Gandhi Indoor Stadium", date: "Dec 10, 2025", videoUrl: "https://www.youtube.com/embed/ThqHtJOfCK0", summary: "Kochi used quick middle combinations to keep Kannur out of system throughout the match.", players: volleyballArchivePlayers("Kochi Spikers", "Kannur Royals") },
          { id: "kv-sf-2", round: "Semi Final", title: "Calicut Smashers vs Alappuzha Waves", teamA: "Calicut Smashers", teamB: "Alappuzha Waves", scoreA: "3", scoreB: "1", winner: "Calicut Smashers", venue: "Kochi Central Court", date: "Dec 10, 2025", videoUrl: "https://www.youtube.com/embed/ysz5S6PUM-U", summary: "Calicut's captain led a late third-set comeback that decided the match momentum.", players: volleyballArchivePlayers("Calicut Smashers", "Alappuzha Waves") },
        ],
      },
      {
        name: "Final",
        stageNote: "Championship match with recorded video, awards, and official player score sheet.",
        matches: [
          { id: "kv-final", round: "Final", title: "Kochi Spikers vs Calicut Smashers", teamA: "Kochi Spikers", teamB: "Calicut Smashers", scoreA: "3", scoreB: "1", winner: "Kochi Spikers", venue: "Rajiv Gandhi Indoor Stadium", date: "Dec 12, 2025", videoUrl: "https://www.youtube.com/embed/ThqHtJOfCK0", summary: "Kochi lifted the Classic trophy after a balanced attacking night and strong receive formation.", players: volleyballArchivePlayers("Kochi Spikers", "Calicut Smashers") },
        ],
      },
    ],
  },
  {
    tournamentSlug: "delhi-cricket-champions",
    champion: "Delhi Capitals Academy",
    runnerUp: "Noida Strikers",
    mvp: "Rohan Sharma",
    finalScore: "Delhi Capitals Academy won by 18 runs",
    attendance: "24,200 total spectators",
    investment: "INR 52L prize pool, venue production, officials, and media operations",
    partners: ["Delhi Cricket Board", "SmartSportz Broadcast", "Nexa Sports"],
    managers: ["Sanjay Mehta - Tournament Director", "Pooja Arora - Registration Lead", "Farhan Khan - Score Operations"],
    operations: ["20-team seeded knockout", "40 match scorecards", "12 recorded highlight reels", "Payment and certificate archive completed"],
    description: "Completed cricket archive with verified scorecards, recorded round videos, partner reports, manager notes, and team/player score details.",
    rounds: [
      {
        name: "Round-1",
        stageNote: "Opening elimination matches used automated team seeding and live score validation.",
        matches: [
          { id: "dc-r1-1", round: "Round-1", title: "Delhi Capitals Academy vs Faridabad Lions", teamA: "Delhi Capitals Academy", teamB: "Faridabad Lions", scoreA: "168/6", scoreB: "142/9", winner: "Delhi Capitals Academy", venue: "Arun Jaitley Practice Oval", date: "Nov 07, 2025", videoUrl: "https://www.youtube.com/embed/ThqHtJOfCK0", summary: "Delhi controlled the middle overs and defended with three wickets in the final spell.", players: cricketArchivePlayers("Delhi Capitals Academy", "Faridabad Lions") },
          { id: "dc-r1-2", round: "Round-1", title: "Noida Strikers vs Ghaziabad United", teamA: "Noida Strikers", teamB: "Ghaziabad United", scoreA: "151/5", scoreB: "148/8", winner: "Noida Strikers", venue: "Delhi Youth Ground", date: "Nov 08, 2025", videoUrl: "https://www.youtube.com/embed/ysz5S6PUM-U", summary: "Noida won a tight chase through calm lower-order hitting and a final-over boundary.", players: cricketArchivePlayers("Noida Strikers", "Ghaziabad United") },
        ],
      },
      {
        name: "Semi Final",
        stageNote: "Two high-pressure matches selected the finalists through score-linked progression.",
        matches: [
          { id: "dc-sf-1", round: "Semi Final", title: "Delhi Capitals Academy vs South Delhi Hawks", teamA: "Delhi Capitals Academy", teamB: "South Delhi Hawks", scoreA: "181/4", scoreB: "166/7", winner: "Delhi Capitals Academy", venue: "Arun Jaitley Practice Oval", date: "Nov 20, 2025", videoUrl: "https://www.youtube.com/embed/ThqHtJOfCK0", summary: "A 92-run second-wicket stand took Delhi into the final with a comfortable defense.", players: cricketArchivePlayers("Delhi Capitals Academy", "South Delhi Hawks") },
          { id: "dc-sf-2", round: "Semi Final", title: "Noida Strikers vs Gurgaon Titans", teamA: "Noida Strikers", teamB: "Gurgaon Titans", scoreA: "159/8", scoreB: "154/9", winner: "Noida Strikers", venue: "Delhi Youth Ground", date: "Nov 21, 2025", videoUrl: "https://www.youtube.com/embed/ysz5S6PUM-U", summary: "Noida defended five runs in the final over with two yorkers and a run-out.", players: cricketArchivePlayers("Noida Strikers", "Gurgaon Titans") },
        ],
      },
      {
        name: "Final",
        stageNote: "Final match archive includes full scorecard, recorded stream, awards, and player rankings.",
        matches: [
          { id: "dc-final", round: "Final", title: "Delhi Capitals Academy vs Noida Strikers", teamA: "Delhi Capitals Academy", teamB: "Noida Strikers", scoreA: "176/5", scoreB: "158/8", winner: "Delhi Capitals Academy", venue: "Arun Jaitley Practice Oval", date: "Nov 24, 2025", videoUrl: "https://www.youtube.com/embed/ThqHtJOfCK0", summary: "Delhi won the title by 18 runs after an aggressive powerplay and disciplined death bowling.", players: cricketArchivePlayers("Delhi Capitals Academy", "Noida Strikers") },
        ],
      },
    ],
  },
];

export function archiveForTournament(slug: string) {
  return tournamentArchives.find((archive) => archive.tournamentSlug === slug);
}

export const teams = [
  { slug: "mumbai-mavericks", name: "Mumbai Mavericks", rank: "#01", sport: "Cricket", players: 18, wins: 15, rating: 92, image: assets.cricket },
  { slug: "bangalore-blaze", name: "Bangalore Blaze", rank: "#04", sport: "Football", players: 22, wins: 12, rating: 88, image: assets.football },
  { slug: "chennai-chargers", name: "Chennai Chargers", rank: "#12", sport: "Basketball", players: 15, wins: 9, rating: 81, image: assets.basketball },
  { slug: "kerala-spikers", name: "Kerala Spikers", rank: "#07", sport: "Volleyball", players: 12, wins: 10, rating: 86, image: assets.volleyball },
];

export const acceptedTeams = [
  { id: "team-1", name: "Mumbai Mavericks", seed: 1, logo: assets.cricket, status: "Accepted" },
  { id: "team-2", name: "India Forge", seed: 2, logo: assets.cricket, status: "Accepted" },
  { id: "team-3", name: "Bengaluru Bulls", seed: 3, logo: assets.football, status: "Accepted" },
  { id: "team-4", name: "Chennai Chargers", seed: 4, logo: assets.basketball, status: "Accepted" },
  { id: "team-5", name: "Kerala Spikers", seed: 5, logo: assets.volleyball, status: "Accepted" },
  { id: "team-6", name: "Falcon Strikers", seed: 6, logo: assets.cricket, status: "Accepted" },
  { id: "team-7", name: "Kochi Kings", seed: 7, logo: assets.cricket, status: "Accepted" },
  { id: "team-8", name: "Hyderabad Royals", seed: 8, logo: assets.cricket, status: "Accepted" },
];

export const bracketNodes = [
  { id: "r1a", label: "Seed 1", team: "Mumbai Mavericks", round: "Round-1", x: 7, y: 16, status: "paired" },
  { id: "r1b", label: "Seed 2", team: "India Forge", round: "Round-1", x: 7, y: 28, status: "winner" },
  { id: "r1c", label: "Seed 3", team: "Bengaluru Bulls", round: "Round-1", x: 7, y: 43, status: "paired" },
  { id: "r1d", label: "Seed 4", team: "Chennai Chargers", round: "Round-1", x: 7, y: 55, status: "paired" },
  { id: "r1e", label: "Seed 5", team: "Kerala Spikers", round: "Round-1", x: 7, y: 70, status: "paired" },
  { id: "r1f", label: "Seed 6", team: "Falcon Strikers", round: "Round-1", x: 7, y: 82, status: "paired" },
  { id: "q1a", label: "Q1-A", team: "India Forge", round: "Quarter", x: 30, y: 18, status: "winner" },
  { id: "q1b", label: "Q1-B", team: "Hyderabad Royals", round: "Quarter", x: 30, y: 30, status: "paired" },
  { id: "q2a", label: "Q2-A", team: "", round: "Quarter", x: 30, y: 45, status: "empty" },
  { id: "q2b", label: "Q2-B", team: "Kochi Kings", round: "Quarter", x: 30, y: 57, status: "paired" },
  { id: "q3a", label: "Q3-A", team: "", round: "Quarter", x: 30, y: 72, status: "empty" },
  { id: "q3b", label: "Q3-B", team: "", round: "Quarter", x: 30, y: 84, status: "empty" },
  { id: "s1a", label: "S1-A", team: "India Forge", round: "Semi-Final", x: 55, y: 29, status: "winner" },
  { id: "s1b", label: "S1-B", team: "", round: "Semi-Final", x: 55, y: 45, status: "empty" },
  { id: "s2a", label: "S2-A", team: "", round: "Semi-Final", x: 55, y: 64, status: "empty" },
  { id: "s2b", label: "S2-B", team: "", round: "Semi-Final", x: 55, y: 80, status: "empty" },
  { id: "f1a", label: "Final-A", team: "India Forge", round: "Final", x: 78, y: 43, status: "winner" },
  { id: "f1b", label: "Final-B", team: "", round: "Final", x: 78, y: 65, status: "empty" },
  { id: "champ", label: "Champion", team: "", round: "Champion", x: 94, y: 54, status: "empty" },
];

export const bracketConnections = [
  ["r1a", "q1a"],
  ["r1b", "q1a"],
  ["r1c", "q2a"],
  ["r1d", "q2a"],
  ["r1e", "q3a"],
  ["r1f", "q3a"],
  ["q1a", "s1a"],
  ["q1b", "s1a"],
  ["q2a", "s1b"],
  ["q2b", "s1b"],
  ["q3a", "s2a"],
  ["q3b", "s2a"],
  ["s1a", "f1a"],
  ["s1b", "f1a"],
  ["s2a", "f1b"],
  ["s2b", "f1b"],
  ["f1a", "champ"],
  ["f1b", "champ"],
];

export const individualScores = [
  { team: "India Forge", player: "Rohan Sharma", score: "74 runs", record: "6 fours, 3 sixes" },
  { team: "India Forge", player: "Nikhil Rao", score: "39 runs", record: "Strike rate 162" },
  { team: "England XI", player: "James Carter", score: "2 wickets", record: "Economy 6.2" },
  { team: "England XI", player: "Owen Smith", score: "1 catch", record: "Deep square leg" },
];

export const registrationQueue = [
  { id: "reg-101", team: "Falcon Strikers", captain: "Rahul Nair", members: 16, payment: "Paid", status: "Pending review" },
  { id: "reg-102", team: "Kochi Kings", captain: "Sanjay Menon", members: 15, payment: "Paid", status: "Pending review" },
  { id: "reg-103", team: "Hyderabad Royals", captain: "Imran Khan", members: 18, payment: "Pending", status: "Payment required" },
];

export const sports = [
  { slug: "chess", name: "Chess", icon: Trophy, active: 9, color: "emerald" },
  { slug: "cricket", name: "Cricket", icon: Trophy, active: 42, color: "emerald" },
  { slug: "football", name: "Football", icon: Medal, active: 36, color: "blue" },
  { slug: "basketball", name: "Basketball", icon: Zap, active: 18, color: "orange" },
  { slug: "volleyball", name: "Volleyball", icon: Activity, active: 16, color: "pink" },
  { slug: "badminton", name: "Badminton", icon: Flame, active: 22, color: "emerald" },
  { slug: "table-tennis", name: "Table Tennis", icon: Trophy, active: 11, color: "blue" },
  { slug: "e-sports", name: "E-Sports", icon: BarChart3, active: 29, color: "orange" },
  { slug: "athletics", name: "Athletics", icon: Medal, active: 14, color: "emerald" },
];

export const dashboardStats = [
  { label: "Total Revenue", value: "₹12,84,500", trend: "+12.4%", icon: CircleDollarSign, path: "/admin/payments" },
  { label: "Active Tournaments", value: "14", trend: "3 running", icon: Trophy, path: "/admin/tournaments" },
  { label: "Total Teams", value: "156", trend: "24 this month", icon: Users, path: "/admin/teams" },
  { label: "Live Matches", value: "8", trend: "2 finals today", icon: Activity, path: "/live" },
];

export const sidebar = [
  { label: "Dashboard", path: "/admin/dashboard", icon: BarChart3 },
  { label: "Tournaments", path: "/admin/tournaments", icon: Trophy },
  { label: "Bracket Workspace", path: "/admin/bracket-workspace", icon: Zap },
  { label: "Users", path: "/admin/users", icon: Users },
  { label: "Managers", path: "/admin/managers", icon: ShieldCheck },
  { label: "Roles", path: "/admin/roles", icon: ShieldCheck, hidden: true },
  { label: "Teams", path: "/admin/teams", icon: Users },
  { label: "Players", path: "/admin/players", icon: Medal, hidden: true },
  { label: "Payments", path: "/admin/payments", icon: CircleDollarSign },
  { label: "CMS", path: "/admin/cms", icon: FileText },
  { label: "Announcements", path: "/admin/announcements", icon: FileText },
  { label: "Reports", path: "/admin/reports", icon: BarChart3 },
  { label: "Logs", path: "/admin/logs", icon: ShieldCheck },
];

export const userSidebar = [
  { label: "Home", path: "/user/dashboard", icon: BarChart3 },
  { label: "My Tournaments", path: "/user/registrations", icon: Trophy },
  { label: "Payments", path: "/user/payments", icon: CircleDollarSign },
  { label: "Team Members", path: "/user/members", icon: Users },
  { label: "Certificates", path: "/user/certificates", icon: Medal },
  { label: "Settings", path: "/user/settings", icon: ShieldCheck },
];

export const managementSidebar = [
  { label: "Dashboard", path: "/management/dashboard", icon: BarChart3 },
  { label: "Tournaments", path: "/management/tournaments", icon: Trophy },
  { label: "Registrations", path: "/management/registrations", icon: FileText },
  { label: "Matches", path: "/management/matches", icon: Activity },
  { label: "Bracket Workspace", path: "/management/tournaments/bangalore-corporate-t20/bracket", icon: Zap },
  { label: "Players", path: "/management/players", icon: Users },
  { label: "Announcements", path: "/management/announcements", icon: FileText },
  { label: "News", path: "/management/news", icon: GalleryHorizontal },
  { label: "Reports", path: "/management/reports", icon: BarChart3 },
];

export const timeline = [
  { time: "18.4", type: "FOUR", text: "Rohan Sharma drives through extra cover. The chasing side tightens control.", score: "156/4" },
  { time: "17.6", type: "WICKET", text: "Clean catch at deep square leg after a slower ball variation.", score: "148/4" },
  { time: "16.2", type: "SIX", text: "Massive hit over long-on. Crowd volume spikes in the live feed.", score: "139/3" },
  { time: "15.1", type: "COMMENTARY", text: "Bowling team changes field to protect the off-side boundary.", score: "126/3" },
];

export const contentCards = [
  { slug: "ai-sports-analytics", title: "The Future of AI in Professional Sports Analytics", type: "Article", icon: FileText, path: "/news/corporate-t20-live-score-surge" },
  { slug: "regional-masters-highlights", title: "Regional Masters Photo Highlights", type: "Gallery", icon: GalleryHorizontal, path: "/gallery" },
  { slug: "payment-refund-guide", title: "Tournament Payment and Refund Guide", type: "FAQ", icon: LifeBuoy, path: "/faq" },
  { slug: "venue-operations", title: "Venue Operations in Major Indian Cities", type: "Guide", icon: MapPin, path: "/contact" },
];

export const newsPosts = [
  {
    slug: "mumbai-mavericks-lift-premier-bash",
    title: "Mumbai Mavericks Lift Premier Bash Trophy",
    shortDescription: "Winner team ceremony, MVP moments, and final over highlights from Mumbai Premier Bash.",
    image: assets.cricket,
    category: "Winner Teams",
    sport: "Cricket",
    tournamentSlug: "mumbai-premier-bash",
    city: "Mumbai",
    status: "Published",
    highlight: true,
    date: "Jul 25, 2026",
    blocks: [
      { type: "heading", content: "Championship final recap" },
      { type: "paragraph", content: "Mumbai Mavericks controlled the final phase with disciplined bowling, clean fielding, and a decisive captaincy call in the last over." },
      { type: "quote", content: "The squad stayed calm under pressure and trusted the tournament plan." },
    ],
  },
  {
    slug: "corporate-t20-live-score-surge",
    title: "Corporate T20 Live Score Surge",
    shortDescription: "India Forge take control with a late batting burst and updated live match records.",
    image: assets.cricket,
    category: "Match Updates",
    sport: "Cricket",
    tournamentSlug: "bangalore-corporate-t20",
    city: "Bengaluru",
    status: "Published",
    highlight: true,
    date: "Jul 25, 2026",
    blocks: [
      { type: "heading", content: "Live match intelligence" },
      { type: "paragraph", content: "The match center recorded batting momentum, score history, and team-wise individual performance updates throughout the innings." },
      { type: "list", content: "Live score sync|Timeline commentary|Team records|Player highlights" },
    ],
  },
  {
    slug: "football-cup-registration-opens-delhi",
    title: "Youth Football Cup Registration Window Opens",
    shortDescription: "Delhi, Noida, and Gurugram teams can prepare rosters before the official deadline.",
    image: assets.football,
    category: "Tournament Updates",
    sport: "Football",
    tournamentSlug: "national-youth-football",
    city: "Delhi",
    status: "Published",
    highlight: false,
    date: "Jul 24, 2026",
    blocks: [
      { type: "heading", content: "Registration guidance" },
      { type: "paragraph", content: "Team captains should confirm city eligibility, roster size, documents, and registration payment before submission." },
      { type: "bold", content: "Only configured tournament cities are available in the registration form." },
    ],
  },
  {
    slug: "kerala-volleyball-classic-archive",
    title: "Kerala Volleyball Classic Archived Records",
    shortDescription: "Completed match reports, player scorecards, and winner records are now available.",
    image: assets.volleyball,
    category: "Winner Teams",
    sport: "Volleyball",
    tournamentSlug: "kerala-volleyball-classic",
    city: "Kochi",
    status: "Published",
    highlight: false,
    date: "Dec 14, 2025",
    blocks: [
      { type: "heading", content: "Completed tournament archive" },
      { type: "paragraph", content: "Archived rounds, scorecards, final result, and downloadable records remain available for teams and spectators." },
      { type: "image", content: assets.volleyball },
    ],
  },
];

export const sportHomeVisibility = [
  { sportSlug: "chess", showOnHome: true, sortOrder: 1 },
  { sportSlug: "cricket", showOnHome: true, sortOrder: 2 },
  { sportSlug: "football", showOnHome: true, sortOrder: 3 },
  { sportSlug: "basketball", showOnHome: true, sortOrder: 4 },
  { sportSlug: "volleyball", showOnHome: false, sortOrder: 5 },
  { sportSlug: "badminton", showOnHome: false, sortOrder: 6 },
  { sportSlug: "table-tennis", showOnHome: false, sortOrder: 7 },
  { sportSlug: "e-sports", showOnHome: false, sortOrder: 8 },
  { sportSlug: "athletics", showOnHome: false, sortOrder: 9 },
];

export const leaderboardRecords = [
  { sport: "Cricket", teamName: "Mumbai Mavericks", city: "Mumbai", rank: 1, tournamentsWon: 12, winRate: 88, points: 4820, recordLabel: "15 wins / 2 finals" },
  { sport: "Cricket", teamName: "India Forge", city: "Bengaluru", rank: 2, tournamentsWon: 9, winRate: 84, points: 4510, recordLabel: "11 wins / live finalist" },
  { sport: "Cricket", teamName: "Kochi Kings", city: "Mysuru", rank: 3, tournamentsWon: 7, winRate: 76, points: 3920, recordLabel: "Accepted playoff seed" },
  { sport: "Football", teamName: "Bengaluru Bulls", city: "Delhi", rank: 1, tournamentsWon: 8, winRate: 82, points: 4140, recordLabel: "18 goals / 5 clean sheets" },
  { sport: "Football", teamName: "Delhi Strikers", city: "Delhi", rank: 2, tournamentsWon: 6, winRate: 74, points: 3660, recordLabel: "Youth cup qualifier" },
  { sport: "Basketball", teamName: "Chennai Chargers", city: "Chennai", rank: 1, tournamentsWon: 6, winRate: 79, points: 3710, recordLabel: "Pro Elite top seed" },
  { sport: "Volleyball", teamName: "Kerala Spikers", city: "Kochi", rank: 1, tournamentsWon: 10, winRate: 86, points: 3980, recordLabel: "Classic champions" },
  { sport: "Badminton", teamName: "Metro Smashers", city: "Mumbai", rank: 1, tournamentsWon: 5, winRate: 72, points: 3210, recordLabel: "Mixed doubles leaders" },
  { sport: "Table Tennis", teamName: "Spin Masters", city: "Bengaluru", rank: 1, tournamentsWon: 4, winRate: 70, points: 3025, recordLabel: "Rapid rally record" },
  { sport: "E-Sports", teamName: "Pixel Titans", city: "Bengaluru", rank: 1, tournamentsWon: 11, winRate: 90, points: 5060, recordLabel: "LAN cup champions" },
  { sport: "Athletics", teamName: "Track Hawks", city: "Delhi", rank: 1, tournamentsWon: 7, winRate: 81, points: 4115, recordLabel: "Relay record holders" },
];

export const managerUsers = [
  { name: "Tournament Manager", email: "manager@smartsportz.in", cities: ["Bengaluru", "Mysuru", "Mumbai"], status: "Active" },
  { name: "North Zone Manager", email: "north.manager@smartsportz.in", cities: ["Delhi", "Noida", "Gurugram"], status: "Draft" },
  { name: "South Venue Manager", email: "south.manager@smartsportz.in", cities: ["Chennai", "Kochi"], status: "Draft" },
];

export const cmsSections = ["Homepage Hero", "Sponsors", "Gallery", "News", "FAQs", "About", "Contact", "Footer"];
export const paymentRows = ["Razorpay order created", "Webhook verified", "Receipt generated", "Refund pending review"];
export const logRows = ["Admin login success", "Score correction requested", "Payment webhook processed", "CMS page published"];
export const reports = ["Tournament revenue", "Registration funnel", "Venue utilization", "Live score audit", "Player participation"];
