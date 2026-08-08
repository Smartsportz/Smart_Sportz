import { QRCodeSVG } from "qrcode.react";
import { ArrowLeft, ArrowRight, CheckCircle2, Copy, Download, ExternalLink, FileText, Printer, ShieldCheck, Smartphone, Trophy, Upload, UserPlus, Users } from "lucide-react";
import { Page } from "../components/UI";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import { tournaments, withRuntimeTournamentStatus } from "../data/platform";
import { apiRequest } from "../lib/api";
import { getCompletedRegistration, saveCompletedRegistration } from "../lib/registrationStatus";
import { useAuth } from "../auth/AuthContext";
import * as XLSX from "xlsx";

type SavedDocument = {
  documentType: string;
  fileName: string;
  filePath: string;
  fileSize?: number;
  status: "required" | "pending" | "uploaded";
};

type SavedRegistration = {
  registrationId: string;
  tournament: string;
  tournamentSlug: string;
  teamName: string;
  teamCode: string;
  captainName: string;
  subCaptainName: string;
  coachName: string;
  email: string;
  phone: string;
  category: string;
  city: string;
  districtState: string;
  teamLogo: string;
  teamMotto: string;
  selectedJersey: string;
  members: string[];
  memberAges: string[];
  memberJerseySizes: string[];
  documents: SavedDocument[];
};

type SavedPayment = {
  id: string;
  receiptNumber: string;
  amount: number;
  method: "card" | "upi";
  status: "paid";
  paidAt: string;
};

type BackendRegistration = {
  id: string;
  tournament_slug?: string;
  tournament_name?: string;
  team_name: string;
  team_code?: string;
  captain_name: string;
  sub_captain_name?: string;
  coach_name?: string;
  email?: string;
  phone?: string;
  city?: string;
  category?: string;
  confirmation_code?: string;
  confirmation_qr_payload?: string;
  payments?: Array<{ id: string; receipt_number: string; amount: number; method: "card" | "upi"; status: "paid"; created_at: string }>;
  members?: Array<{ name: string; role?: string; jersey?: string; contact?: string }>;
  documents?: Array<{ document_type: string; file_name: string; file_path: string; status: SavedDocument["status"] }>;
  prizes?: Array<{ position: number; label: string; amount: number }>;
};

type RegistrationDraft = {
  activeStep: number;
  teamDetails: {
    teamName: string;
    teamCode: string;
    captainName: string;
    subCaptainName: string;
    coachName: string;
    email: string;
    phone: string;
    city: string;
    districtState: string;
    teamLogo: string;
    teamMotto: string;
    selectedJersey: string;
    category: string;
  };
  members: string[];
  memberAges: string[];
  memberJerseySizes: string[];
  documents: SavedDocument[];
  tournamentAccepted: boolean;
};

const currentUserKey = "smart-sportz-user";

function currentStorageUserScope() {
  if (typeof localStorage === "undefined") return "guest";
  try {
    const raw = localStorage.getItem(currentUserKey);
    if (!raw) return "guest";
    const user = JSON.parse(raw) as { id?: string; email?: string };
    return (user.id || user.email || "guest").toLowerCase();
  } catch {
    return "guest";
  }
}

function scopedRegistrationKey(prefix: string, slug: string) {
  return `${prefix}:${currentStorageUserScope()}:${slug}`;
}

function registrationDraftKey(slug: string) {
  return scopedRegistrationKey("registration-draft", slug);
}

function registrationDataKey(slug: string) {
  return scopedRegistrationKey("registration", slug);
}

function paymentDataKey(slug: string) {
  return scopedRegistrationKey("payment", slug);
}

function readRegistrationDraft(slug: string) {
  if (typeof localStorage === "undefined") return null;
  const raw = localStorage.getItem(registrationDraftKey(slug));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as RegistrationDraft;
  } catch {
    localStorage.removeItem(registrationDraftKey(slug));
    return null;
  }
}

function readSavedRegistration(slug: string) {
  const raw = localStorage.getItem(registrationDataKey(slug)) ?? sessionStorage.getItem(registrationDataKey(slug));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SavedRegistration;
  } catch {
    return null;
  }
}

function writeSavedRegistration(slug: string, payload: SavedRegistration) {
  const encoded = JSON.stringify(payload);
  localStorage.setItem(registrationDataKey(slug), encoded);
  sessionStorage.setItem(registrationDataKey(slug), encoded);
}

function readSavedPayment(slug: string) {
  const raw = localStorage.getItem(paymentDataKey(slug)) ?? sessionStorage.getItem(paymentDataKey(slug));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SavedPayment;
  } catch {
    return null;
  }
}

function writeSavedPayment(slug: string, payload: SavedPayment) {
  const encoded = JSON.stringify(payload);
  localStorage.setItem(paymentDataKey(slug), encoded);
  sessionStorage.setItem(paymentDataKey(slug), encoded);
}

function teamGroupImageDocument(restored: SavedDocument[] | undefined): SavedDocument[] {
  const match = restored?.find((item) => item.documentType === "Team Group Image");
  return [match ?? { documentType: "Team Group Image", fileName: "", filePath: "", status: "required" }];
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

const jerseySizeOptions = ["XS", "S", "M", "L", "XL"];

function completedRecordFromBackend(registration: BackendRegistration, tournament: any) {
  const payment = registration.payments?.[0];
  if (!payment) return null;
  const qrPayload = registration.confirmation_qr_payload || JSON.stringify({
    type: "SmartSportzTeamVerification",
    registrationId: registration.id,
    confirmationCode: registration.confirmation_code,
    teamCode: registration.team_code,
    teamName: registration.team_name,
    tournamentSlug: registration.tournament_slug || tournament.slug,
    tournamentName: registration.tournament_name || tournament.name,
    captainName: registration.captain_name,
    city: registration.city,
    paymentReceipt: payment.receipt_number,
    receiptNumber: payment.receipt_number,
    verificationPath: `/registrations/${registration.id}`,
  });
  return {
    tournamentSlug: registration.tournament_slug || tournament.slug,
    tournamentName: registration.tournament_name || tournament.name,
    registrationId: registration.id,
    confirmationCode: registration.confirmation_code || `SS-${registration.id.replace("reg_", "").toUpperCase().slice(0, 8)}`,
    qrPayload,
    teamName: registration.team_name,
    teamCode: registration.team_code || "Generated",
    captainName: registration.captain_name,
    subCaptainName: registration.sub_captain_name || "",
    coachName: registration.coach_name || "",
    email: registration.email || "",
    phone: registration.phone || "",
    city: registration.city || "",
    category: registration.category || "",
    members: (registration.members || []).map((member) => member.name),
    documents: (registration.documents || []).map((document) => ({
      documentType: document.document_type,
      fileName: document.file_name,
      filePath: document.file_path,
      status: document.status,
    })),
    payment: {
      id: payment.id,
      receiptNumber: payment.receipt_number,
      amount: payment.amount,
      method: payment.method,
      status: payment.status,
      paidAt: payment.created_at,
    },
    completedAt: payment.created_at,
  };
}

function amountForTournament(_slug: string, tournament?: Record<string, any>) {
  const feeLines = Array.isArray(tournament?.feeBreakdown)
    ? tournament?.feeBreakdown
    : Array.isArray(tournament?.fee_breakdown)
      ? tournament?.fee_breakdown
      : [];
  const feeTotal = feeLines.reduce((total: number, line: any) => total + Number(line?.value || 0), 0);
  if (feeTotal > 0) return feeTotal * 100;
  return 0;
}

function totalPayableForAmount(amount: number) {
  return amount;
}

function formatInr(cents: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(cents / 100);
}

function encodeUpiValue(value: string) {
  return encodeURIComponent(value).replace(/%20/g, "+");
}

function buildUpiIntent({ amount, registrationId, teamName, tournamentName }: { amount: number; registrationId: string; teamName: string; tournamentName: string }) {
  const params = [
    ["pa", "smartsportz@upi"],
    ["pn", "SmartSportz"],
    ["am", (amount / 100).toFixed(2)],
    ["cu", "INR"],
    ["tr", registrationId],
    ["tid", registrationId],
    ["tn", `${tournamentName} - ${teamName}`],
  ];
  return `upi://pay?${params.map(([key, value]) => `${key}=${encodeUpiValue(value)}`).join("&")}`;
}

function buildAppUpiLinks(upiIntent: string) {
  const query = upiIntent.replace("upi://pay?", "");
  return [
    { label: "Google Pay", href: `gpay://upi/pay?${query}` },
    { label: "PhonePe", href: `phonepe://pay?${query}` },
    { label: "Paytm", href: `paytmmp://pay?${query}` },
    { label: "BHIM / Any UPI", href: upiIntent },
  ];
}

function tournamentPrizeLines(tournament: Record<string, any>) {
  return Array.isArray(tournament.prizes)
    ? tournament.prizes
        .map((line: any) => ({ label: String(line?.label ?? `${line?.position ?? ""} Prize`).trim(), amount: Number(line?.amount || 0) }))
        .filter((line) => line.label && line.amount > 0)
    : [];
}

function formatFileSize(size?: number) {
  if (!size) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

function tournamentAgeRange(tournament: (typeof tournaments)[number]) {
  const minAge = Number((tournament as any).minAge ?? (tournament as any).min_age ?? 0);
  const maxAge = Number((tournament as any).maxAge ?? (tournament as any).max_age ?? 0);
  if (minAge && maxAge) return `${minAge} - ${maxAge} years`;
  if (minAge) return `${minAge}+ years`;
  if (maxAge) return `Up to ${maxAge} years`;
  return "Open age category";
}

function isAgeInRange(age: number, tournament: (typeof tournaments)[number]): boolean {
  const minAge = Number((tournament as any).minAge ?? (tournament as any).min_age ?? 0);
  const maxAge = Number((tournament as any).maxAge ?? (tournament as any).max_age ?? 0);
  if (minAge && maxAge) return age >= minAge && age <= maxAge;
  if (minAge) return age >= minAge;
  if (maxAge) return age <= maxAge;
  return true;
}

function tournamentRulesText(tournament: (typeof tournaments)[number]) {
  const customRules = String((tournament as any).rulesText ?? (tournament as any).rules_text ?? "").trim();
  if (customRules) {
    return [
      `${tournament.name} - Rules And Conditions`,
      "",
      customRules,
    ].join("\n");
  }
  const description = (tournament as any).tournamentDescription || `${tournament.name} follows SmartSportz registration, roster verification, payment, fair-play, and event operations rules.`;
  return [
    `${tournament.name} - Rules And Conditions`,
    "",
    description,
    "",
    `Sport: ${tournament.sport}`,
    `Venue: ${tournament.location}`,
    `Schedule: ${tournament.date}`,
    `Registration Window: ${tournament.registrationStart || "To be announced"} to ${tournament.registrationEnd || "To be announced"}`,
    `Roster Requirement: ${tournament.teamSize || "Manager configured"} members including captain and sub-captain`,
    `Age Restriction: ${tournamentAgeRange(tournament)}`,
    `Prize Pool: ${tournament.prize || "Announced by organizer"}`,
    "",
    "1. Team captains must submit accurate team, contact, player, and city details.",
    "2. Players must satisfy the tournament age restriction and any category eligibility rules.",
    "3. Duplicate or intentionally incorrect registrations can be rejected by the manager.",
    "4. Tournament managers may verify team identity, roster, and player eligibility before approval.",
    "5. Registration is confirmed only after successful payment and SmartSportz verification.",
    "6. Fixtures, rounds, match timing, live scores, and results are controlled by assigned tournament managers.",
    "7. Any score correction, cancellation, rematch, or bracket override is recorded for audit visibility.",
    "8. Participants must follow fair-play, venue, safety, and sportsmanship instructions.",
    "9. Documents, images, and registration details may be used for verification and tournament records.",
    "10. The organizer can update schedules or operational rules when required and will communicate important changes.",
  ].join("\n");
}

function escapePdfText(value: string) {
  return value.replace(/[^\x20-\x7E]/g, " ").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function buildRulesPdf(tournament: (typeof tournaments)[number]) {
  const rawLines = tournamentRulesText(tournament).split("\n");
  const wrappedLines = rawLines.flatMap((line) => {
    if (!line) return [""];
    const chunks: string[] = [];
    for (let index = 0; index < line.length; index += 82) chunks.push(line.slice(index, index + 82));
    return chunks;
  }).slice(0, 44);
  const content = [
    "BT",
    "/F1 11 Tf",
    "50 790 Td",
    ...wrappedLines.map((line, index) => `${index === 0 ? "" : "0 -15 Td "}${line ? `(${escapePdfText(line)}) Tj` : ""}`),
    "ET",
  ].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return pdf;
}

async function downloadRulesFile(tournament: (typeof tournaments)[number]) {
  if (typeof document === "undefined") return;
  const uploadedRulesPdf = String((tournament as any).rulesPdf ?? (tournament as any).rules_pdf ?? "").trim();
  const isPdfSource = /^data:application\/pdf/i.test(uploadedRulesPdf) || /^https?:\/\/.+\.pdf(\?|#|$)/i.test(uploadedRulesPdf) || /^\/media\/.+\.pdf(\?|#|$)/i.test(uploadedRulesPdf);
  if (!uploadedRulesPdf || !isPdfSource) {
    window.alert("Rules PDF is not uploaded for this tournament.");
    return;
  }
  const filename = uploadedRulesPdf.split("/").pop()?.split("?")[0] || `${tournament.slug}-rules-and-conditions.pdf`;
  if (/^https?:\/\//i.test(uploadedRulesPdf)) {
    const response = await fetch(uploadedRulesPdf);
    if (!response.ok) {
      window.alert("Rules PDF could not be downloaded.");
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 300);
    return;
  }
  const link = document.createElement("a");
  link.href = uploadedRulesPdf;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function downloadSampleExcel() {
  const sampleData = [
    { sno: 1, name: "John Doe", age: 25, size: "L" },
    { sno: 2, name: "Jane Smith", age: 24, size: "M" },
    { sno: 3, name: "Mike Johnson", age: 26, size: "XL" },
    { sno: 4, name: "Sarah Williams", age: 23, size: "S" },
    { sno: 5, name: "David Brown", age: 27, size: "M" },
  ];
  
  const ws = XLSX.utils.json_to_sheet(sampleData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Players");
  
  // Set column widths
  ws['!cols'] = [
    { wch: 8 },  // sno
    { wch: 20 }, // name
    { wch: 10 }, // age
    { wch: 10 }  // size
  ];
  
  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'import_player_sample.xlsx';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function RegistrationStepper({ activeIndex }: { activeIndex: number }) {
  const wizard = ["Tournament", "Team Details", "Payment", "Confirmation"];
  let displayIndex = activeIndex;
  if (activeIndex >= 1) displayIndex = 1;
  if (activeIndex === 4) displayIndex = 2;
  if (activeIndex === 5) displayIndex = 3;

  return (
    <div className="registration-stepper" aria-label="Registration progress">
      {wizard.map((step, index) => (
        <div className={`registration-step ${index <= displayIndex ? "active" : ""}`} key={step}>
          <span>{index + 1}</span>
          {step}
        </div>
      ))}
    </div>
  );
}

function RegistrationShell({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function RegistrationSummary({ tournament, amount, showTimeline = false }: { tournament: Record<string, any>; amount: number; showTimeline?: boolean }) {
  const total = totalPayableForAmount(amount);
  const prizes = tournamentPrizeLines(tournament);
  return (
    <aside className="registration-side">
      <section className="registration-summary-card">
        <div className="registration-summary-head">
          <h2>Registration Summary</h2>
          <small>ORDER #{tournament.slug.slice(0, 3).toUpperCase()}-{tournament.capacity}{tournament.teams}-26</small>
        </div>
        <div className="summary-tournament">
          <img src={tournament.image} alt={tournament.name} />
          <div>
            <strong>{tournament.name}</strong>
            <span>{tournament.sport} Category</span>
          </div>
        </div>
        <div className="summary-lines">
          <p><span>Venue</span><b>{tournament.location}</b></p>
          <p><span>Slots</span><b>{String(tournament.teams).padStart(2, "0")}/{tournament.capacity} Filled</b></p>
        </div>
        {prizes.length > 0 && (
          <div className="prize-split">
            {prizes.map((item) => <p key={item.label}><span>{item.label}</span><b>{formatInr(item.amount * 100)}</b></p>)}
          </div>
        )}
        <div className="summary-lines total-lines">
          <p className="payable"><span>Registration Fee</span><b>{amount > 0 ? formatInr(total) : "Not configured"}</b></p>
        </div>
        <button className="btn btn-secondary wide" type="button" onClick={() => downloadRulesFile(tournament as any)}><Download size={16} />Download Rulebook</button>
      </section>
      {showTimeline && (
        <section className="registration-timeline">
          <h3>Registration Timeline</h3>
          <p className="done"><span />Registration Started<small>{tournament.registrationStart}</small></p>
          <p><span />Early Bird Deadline<small>{tournament.registrationEnd}</small></p>
          <p><span />Final Closing<small>{tournament.date}</small></p>
        </section>
      )}
    </aside>
  );
}

function TournamentPosterPanel({ tournament }: { tournament: (typeof tournaments)[number] }) {
  const poster = tournament.poster || "/assets/poster.jpeg";
  return (
    <aside className="registration-side poster-side">
      <section className="registration-poster-card">
        <div className="registration-summary-head">
          <h2>Tournament Poster</h2>
          <small>Visible on the first step only</small>
        </div>
        <div className="registration-poster-frame">
          <img src={poster} alt={`${tournament.name} poster`} />
        </div>
        <div className="registration-poster-meta">
          <strong>{tournament.name}</strong>
          <span>{tournament.sport} - {tournament.location}</span>
        </div>
      </section>
    </aside>
  );
}

function scrollRegistrationTop() {
  window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
}

type ImportedRosterEntry = {
  name: string;
  age: string;
  jerseySize: string;
};

function splitCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }

  values.push(current.trim());
  return values;
}

function parseRosterImportContent(rawText: string): ImportedRosterEntry[] {
  const trimmed = rawText.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .map((entry) => {
            if (typeof entry === "string") {
              return { name: entry, age: "", jerseySize: "" };
            }
            if (entry && typeof entry === "object") {
              const record = entry as Record<string, unknown>;
              const name = [record.name, record.playerName, record.fullName, record.player].find((value): value is string => typeof value === "string" && value.trim().length > 0) ?? "";
              const age = [record.age, record.playerAge].find((value): value is string => typeof value === "string" && value.trim().length > 0) ?? "";
              const jerseySize = [record.jerseySize, record.size, record.kitSize].find((value): value is string => typeof value === "string" && value.trim().length > 0) ?? "";
              return { name: name.trim(), age: String(age ?? "").trim(), jerseySize: String(jerseySize ?? "").trim() };
            }
            return null;
          })
          .filter((entry): entry is ImportedRosterEntry => Boolean(entry && entry.name));
      }
    } catch {
      // fall back to line parsing below
    }
  }

  const rows = trimmed
    .replace(/\r/g, "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!rows.length) return [];

  const imported: ImportedRosterEntry[] = [];
  rows.forEach((line) => {
    const cells = splitCsvLine(line);
    if (!cells.length) return;

    const header = cells.join(" ").toLowerCase();
    if (header.includes("name") && header.includes("age")) {
      return;
    }

    let name = "";
    let age = "";
    let jerseySize = "";

    if (cells.length === 1) {
      name = cells[0];
    } else if (cells.length === 2) {
      const [first, second] = cells;
      const firstLooksLikeAge = /^\d{1,2}$/.test(first.trim());
      const secondLooksLikeAge = /^\d{1,2}$/.test(second.trim());
      if (firstLooksLikeAge && !secondLooksLikeAge) {
        age = first;
        name = second;
      } else if (secondLooksLikeAge && !firstLooksLikeAge) {
        name = first;
        age = second;
      } else {
        name = first;
        jerseySize = second;
      }
    } else {
      name = cells[0] || "";
      age = cells[1] || "";
      jerseySize = cells[2] || "";
    }

    const cleanedName = name.replace(/^[-•*]\s*/, "").trim();
    if (!cleanedName) return;
    imported.push({ name: cleanedName, age: age.trim(), jerseySize: jerseySize.trim() });
  });

  return imported;
}

function parseExcelFile(file: File): Promise<ImportedRosterEntry[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);
        
        const entries: ImportedRosterEntry[] = [];
        jsonData.forEach((row: any) => {
          const name = row.name || row.Name || row.NAME || row.player_name || "";
          const age = String(row.age || row.Age || row.AGE || row.player_age || "");
          const jerseySize = String(row.size || row.Size || row.SIZE || row.jersey_size || "");
          
          if (name && name.trim()) {
            entries.push({
              name: name.trim(),
              age: age.trim(),
              jerseySize: jerseySize.trim()
            });
          }
        });
        
        resolve(entries);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

function normalizeTournamentRecord(record: Record<string, any>, fallback: (typeof tournaments)[number]) {
  const feeBreakdown = Array.isArray(record.fee_breakdown) ? record.fee_breakdown : Array.isArray(record.feeBreakdown) ? record.feeBreakdown : (fallback as any).feeBreakdown ?? [];
  const prizes = Array.isArray(record.prizes) ? record.prizes : [];
  return {
    ...fallback,
    ...record,
    registrationStart: record.registration_start ?? fallback.registrationStart,
    registrationEnd: record.registration_end ?? fallback.registrationEnd,
    teamSize: Number(record.team_size ?? record.max_team_size ?? fallback.teamSize),
    minAge: Number(record.min_age ?? fallback.minAge ?? 0),
    maxAge: Number(record.max_age ?? fallback.maxAge ?? 0),
    tournamentDescription: record.tournament_description ?? fallback.tournamentDescription,
    sportDescription: record.sport_description ?? (fallback as any).sportDescription,
    rulesPdf: record.rules_pdf ?? (fallback as any).rulesPdf ?? "",
    rulesText: record.rules_text ?? (fallback as any).rulesText ?? "",
    feeBreakdown,
    prizes,
    show_on_home: Boolean(record.show_on_home ?? (fallback as any).show_on_home),
    cities: Array.isArray(record.cities) && record.cities.length ? record.cities : fallback.cities,
  };
}

export function RegistrationPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const routeSlug = slug ?? tournaments[0].slug;
  const fallbackTournament = tournaments.find((item) => item.slug === routeSlug) ?? { ...tournaments[0], slug: routeSlug };
  const [remoteTournament, setRemoteTournament] = useState<Record<string, any> | null>(null);
  const tournament = withRuntimeTournamentStatus(remoteTournament ? normalizeTournamentRecord(remoteTournament, fallbackTournament) : fallbackTournament) as (typeof tournaments)[number];
  const amount = amountForTournament(routeSlug, tournament);
  const savedDraft = useMemo(() => readRegistrationDraft(routeSlug), [routeSlug]);
  const memberSlots = Array.from({ length: tournament.teamSize }, (_, index) => {
    if (index === 0) return "Captain";
    if (index === 1) return "Sub-captain";
    return `Player ${index + 1}`;
  });
  const [teamDetails, setTeamDetails] = useState(() => savedDraft?.teamDetails ?? {
    teamName: "",
    teamCode: "",
    captainName: "",
    subCaptainName: "",
    coachName: "",
    email: "",
    phone: "",
    city: tournament.cities[0] ?? "",
    districtState: tournament.cities[0] ?? tournament.location,
    teamLogo: "",
    teamMotto: "",
    selectedJersey: "",
    category: `${tournament.sport} League`,
  });
  const [members, setMembers] = useState(() => {
    const restored = savedDraft?.members ?? [];
    return memberSlots.map((_, index) => restored[index] ?? "");
  });
  const [memberAges, setMemberAges] = useState(() => {
    const restored = savedDraft?.memberAges ?? [];
    return memberSlots.map((_, index) => restored[index] ?? "");
  });
  const [memberJerseySizes, setMemberJerseySizes] = useState(() => {
    const restored = savedDraft?.memberJerseySizes ?? [];
    return memberSlots.map((_, index) => restored[index] ?? "");
  });
  const [documents, setDocuments] = useState<SavedDocument[]>(() => teamGroupImageDocument(savedDraft?.documents));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [activeStep, setActiveStep] = useState(() => Math.min(Math.max(savedDraft?.activeStep ?? 0, 0), 1));
  const [tournamentAccepted, setTournamentAccepted] = useState(() => savedDraft?.tournamentAccepted ?? false);
  const [rulesModalOpen, setRulesModalOpen] = useState(false);
  const [rulesScrolled, setRulesScrolled] = useState(false);
  const [rosterImportOpen, setRosterImportOpen] = useState(false);
  const [rosterImportText, setRosterImportText] = useState("");
  const rosterFileInputRef = useRef<HTMLInputElement | null>(null);
  const excelFileInputRef = useRef<HTMLInputElement | null>(null);

  const minAge = Number((tournament as any).minAge ?? (tournament as any).min_age ?? 0);
  const maxAge = Number((tournament as any).maxAge ?? (tournament as any).max_age ?? 0);

  useEffect(() => {
    if (!routeSlug) return;
    let active = true;
    apiRequest<Record<string, any>>(`/public/tournaments/${routeSlug}`)
      .then((item) => {
        if (active) setRemoteTournament(item);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [routeSlug]);

  useEffect(() => {
    const draft: RegistrationDraft = {
      activeStep,
      teamDetails,
      members,
      memberAges,
      memberJerseySizes,
      documents,
      tournamentAccepted,
    };
    localStorage.setItem(registrationDraftKey(routeSlug), JSON.stringify(draft));
  }, [activeStep, teamDetails, members, memberAges, memberJerseySizes, documents, tournamentAccepted, routeSlug]);

  function showMissing(message: string) {
    setError(message);
    scrollRegistrationTop();
    window.alert(message);
  }

  function updateTeamDetails(field: keyof typeof teamDetails, value: string) {
    setTeamDetails((current) => {
      const next = { ...current, [field]: value };
      if (field === "captainName") {
        setMembers((items) => items.map((name, index) => index === 0 ? value : name));
      }
      if (field === "subCaptainName") {
        setMembers((items) => items.map((name, index) => index === 1 ? value : name));
      }
      return next;
    });
  }

  function updateDocument(index: number, file?: File) {
    const fileName = file?.name ?? "";
    if (!file) {
      setDocuments((current) => current.map((item, itemIndex) => itemIndex === index ? {
        ...item,
        fileName: "",
        fileSize: undefined,
        filePath: "",
        status: "required",
      } : item));
      return;
    }
    void fileToDataUrl(file).then((filePath) => {
      setDocuments((current) => current.map((item, itemIndex) => itemIndex === index ? {
        ...item,
        fileName,
        fileSize: file.size,
        filePath,
        status: "uploaded",
      } : item));
    });
  }

  function openRulesModal() {
    setRulesScrolled(false);
    setRulesModalOpen(true);
    downloadRulesFile(tournament);
  }

  function applyRosterImport(entries: ImportedRosterEntry[]) {
    if (!entries.length) {
      showMissing("No roster entries were found.");
      return;
    }

    const nextMembers = [...members];
    const nextMemberAges = [...memberAges];
    const nextMemberJerseySizes = [...memberJerseySizes];

    entries.forEach((entry, index) => {
      if (index >= memberSlots.length) return;
      nextMembers[index] = entry.name;
      nextMemberAges[index] = entry.age;
      nextMemberJerseySizes[index] = entry.jerseySize;
    });

    setMembers(nextMembers);
    setMemberAges(nextMemberAges);
    setMemberJerseySizes(nextMemberJerseySizes);
    setRosterImportText("");
    setRosterImportOpen(false);
    window.alert(`${entries.length} players imported into the available roster slots.`);
  }

  async function handleRosterTextImport() {
    if (!rosterImportText.trim()) {
      showMissing("Please paste player data first.");
      return;
    }
    const entries = parseRosterImportContent(rosterImportText);
    applyRosterImport(entries);
  }

  async function handleExcelImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const entries = await parseExcelFile(file);
      applyRosterImport(entries);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "The Excel file could not be read.";
      showMissing(message);
    } finally {
      event.target.value = "";
    }
  }

  function handleRulesScroll(event: React.UIEvent<HTMLDivElement>) {
    const target = event.currentTarget;
    if (target.scrollTop + target.clientHeight >= target.scrollHeight - 8) {
      setRulesScrolled(true);
    }
  }

  async function continueToRoster() {
    const requiredFields = ["teamName", "captainName", "subCaptainName", "email", "phone", "city"] as const;
    const missingTeamFields = requiredFields.filter((key) => !teamDetails[key].trim());
    
    const missingMemberLabels = members
      .map((name, index) => ({ name: name.trim(), label: memberSlots[index] }))
      .filter((item) => item.name.length < 2)
      .map((item) => item.label);

    const invalidAges = memberAges
      .map((age, index) => ({ age: age.trim(), index, label: memberSlots[index] }))
      .filter((item) => {
        if (!item.age) return false;
        const ageNum = parseInt(item.age);
        return isNaN(ageNum) || ageNum <= 0 || !isAgeInRange(ageNum, tournament);
      });

    const missingSizes = memberJerseySizes.filter(s => !s.trim()).length;

    if (missingTeamFields.length) {
      showMissing(`Please complete these fields: ${missingTeamFields.join(", ")}.`);
      return;
    }
    if (missingMemberLabels.length) {
      showMissing(`Please complete all player names.`);
      return;
    }
    if (invalidAges.length) {
      showMissing(`Invalid ages for: ${invalidAges.map(a => a.label).join(", ")}. Age must be between ${minAge || 0} and ${maxAge || 100}.`);
      return;
    }
    if (missingSizes) {
      showMissing(`Please select jersey sizes for all players.`);
      return;
    }

    setSaving(true);
    setError("");
    try {
      const uploadedDocuments = documents.filter((item) => item.fileName.trim());
      const created = await apiRequest<BackendRegistration>("/registrations", {
        method: "POST",
        body: JSON.stringify({
          tournament_slug: routeSlug,
          team_name: teamDetails.teamName,
          team_code: "",
          captain_name: teamDetails.captainName,
          sub_captain_name: teamDetails.subCaptainName,
          coach_name: teamDetails.coachName,
          email: teamDetails.email,
          phone: teamDetails.phone,
          city: teamDetails.city,
          district_state: teamDetails.districtState,
          team_logo: teamDetails.teamLogo,
          team_motto: teamDetails.teamMotto,
          category: `${tournament.sport} League`,
          selected_jersey_image: "",
          members: members.map((name, index) => ({
            name: name.trim(),
            role: index === 0 ? "Captain" : index === 1 ? "Sub-captain" : "Player",
            jersey: "",
            contact: index === 0 ? teamDetails.phone : "",
            age: memberAges[index] ? Number(memberAges[index]) : null,
            jersey_size: memberJerseySizes[index] ?? "",
          })),
          documents: uploadedDocuments.map((item) => ({
            document_type: item.documentType,
            file_name: item.fileName,
            file_path: item.filePath,
            status: item.status,
          })),
        }),
      });
      const payload: SavedRegistration = {
        registrationId: created.id,
        tournament: tournament.name,
        tournamentSlug: routeSlug,
        ...teamDetails,
        teamCode: "",
        members,
        memberAges,
        memberJerseySizes,
        documents,
      };
      writeSavedRegistration(routeSlug, payload);
      localStorage.setItem(registrationDraftKey(routeSlug), JSON.stringify({
        activeStep: 1,
        teamDetails: { ...teamDetails, teamCode: "" },
        members,
        memberAges,
        memberJerseySizes,
        documents,
        tournamentAccepted,
      } satisfies RegistrationDraft));
      navigate(`/tournaments/${routeSlug}/register/roster`);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Registration could not be saved.";
      setError(message);
      scrollRegistrationTop();
    } finally {
      setSaving(false);
    }
  }

  function goNext() {
    setError("");
    if (activeStep === 0) {
      if (!tournamentAccepted) {
        showMissing("Please accept the tournament rules and conditions before moving on.");
        return;
      }
      setActiveStep(1);
      scrollRegistrationTop();
      return;
    }
    if (activeStep === 1) {
      void continueToRoster();
      return;
    }
  }

  function goBack() {
    setError("");
    if (activeStep === 0) {
      navigate(`/tournaments/${routeSlug}`);
      return;
    }
    setActiveStep(0);
    scrollRegistrationTop();
  }

  return (
    <RegistrationShell>
      <Page className="registration-reference-page">
        <section className="registration-hero-copy">
          <p className="eyebrow">SmartSportz</p>
          <h1>Tournament Registration</h1>
          <h2>Compete. Perform. Become a Champion.</h2>
          <p>Complete accurate team, player, and payment details to secure your tournament spot.</p>
        </section>
        <RegistrationStepper activeIndex={activeStep} />
        <div className={`registration-reference-layout ${activeStep === 0 ? "registration-reference-layout-intro" : "registration-reference-layout-centered"}`}>
          <main className="registration-main">
            {error && <div className="form-alert">{error}</div>}
            {activeStep === 0 && (
              <section className="registration-form-section">
                <div className="section-head-inline">
                  <div>
                    <h2>About Tournament</h2>
                    <p>Review tournament details before entering team data.</p>
                  </div>
                  <span className={`status ${tournament.accent}`}>{tournament.status}</span>
                </div>
                <div className="registration-choice-card">
                  <img src={tournament.image} alt={tournament.name} />
                  <div>
                    <h3>{tournament.name}</h3>
                    <p>{tournament.sport} - {tournament.location} - {tournament.date}</p>
                    <div className="rules-list">
                      <span>Team size: {tournament.teamSize} members</span>
                      <span>Prize pool: {tournament.prize}</span>
                      <span>Slots: {tournament.teams}/{tournament.capacity} filled</span>
                      <span>Age restriction: {tournamentAgeRange(tournament)}</span>
                    </div>
                  </div>
                </div>
                <label className="acceptance-box">
                  <input
                    type="checkbox"
                    checked={tournamentAccepted}
                    readOnly
                    onClick={(event) => {
                      event.preventDefault();
                      if (tournamentAccepted) {
                        setTournamentAccepted(false);
                        return;
                      }
                      openRulesModal();
                    }}
                  />
                  <span>I have read and accept the tournament rules, eligibility, age restriction, and fair-play conditions.</span>
                </label>
              </section>
            )}

            {activeStep === 1 && (
              <section className="registration-form-section">
                <div className="section-head-inline">
                  <div>
                    <h2>Team & Player Details</h2>
                    <p>Enter your team information and roster members below.</p>
                  </div>
                  <span className="autosave-pill">Draft saved locally</span>
                </div>

                <div className="form-group-box">
                  <h3>Basic Team Info</h3>
                  <div className="form-grid">
                    <label>Team name<input value={teamDetails.teamName} onChange={(event) => updateTeamDetails("teamName", event.target.value)} placeholder="e.g. Mumbai Mavericks" /></label>
                    <label>City<select value={teamDetails.city} onChange={(event) => updateTeamDetails("city", event.target.value)}>{tournament.cities.map((city) => <option key={city}>{city}</option>)}</select></label>
                    <label>Home state<select value={teamDetails.districtState} onChange={(event) => updateTeamDetails("districtState", event.target.value)}>{tournament.cities.map((city) => <option key={city}>{city}</option>)}</select></label>
                    <label>Team motto<input value={teamDetails.teamMotto} onChange={(event) => updateTeamDetails("teamMotto", event.target.value)} placeholder="Team spirit" /></label>
                  </div>
                </div>

                <div className="form-group-box" style={{ marginTop: "2rem" }}>
                  <h3>Management Contact</h3>
                  <div className="form-grid">
                    <label>Captain name<input value={teamDetails.captainName} onChange={(event) => updateTeamDetails("captainName", event.target.value)} placeholder="Full Name" /></label>
                    <label>Sub-captain name<input value={teamDetails.subCaptainName} onChange={(event) => updateTeamDetails("subCaptainName", event.target.value)} placeholder="Full Name" /></label>
                    <label>Coach name<input value={teamDetails.coachName} onChange={(event) => updateTeamDetails("coachName", event.target.value)} placeholder="Optional" /></label>
                    <label>Email<input value={teamDetails.email} onChange={(event) => updateTeamDetails("email", event.target.value)} placeholder="contact@team.com" /></label>
                    <label>Phone
                      <input 
                        type="number" 
                        value={teamDetails.phone} 
                        onChange={(event) => updateTeamDetails("phone", event.target.value)} 
                        placeholder="+91" 
                      />
                    </label>
                  </div>
                </div>

                <div className="form-group-box" style={{ marginTop: "2rem" }}>
                  <div className="section-head-inline">
                    <h3>Player Roster</h3>
                    <div className="section-actions" style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <button className="btn btn-secondary btn-sm" type="button" onClick={() => setRosterImportOpen(true)}><Upload size={14} /> Import</button>
                      <button className="btn btn-secondary btn-sm" type="button" onClick={downloadSampleExcel}><Download size={14} /> Sample</button>
                    </div>
                  </div>
                  <div className="player-roster-rows" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {memberSlots.map((role, index) => {
                      const ageStr = memberAges[index] || "";
                      const ageNum = parseInt(ageStr);
                      const isInvalid = ageStr && (!isNaN(ageNum) && ageNum > 0) ? !isAgeInRange(ageNum, tournament) : false;
                      return (
                        <div key={role} className="player-row-input" style={{ display: "grid", gridTemplateColumns: "40px 1fr 80px 120px", gap: "10px", alignItems: "center" }}>
                          <span style={{ fontWeight: "bold", color: "#666" }}>{index + 1}</span>
                          <input 
                            value={members[index]} 
                            onChange={(event) => setMembers((current) => current.map((name, i) => i === index ? event.target.value : name))} 
                            placeholder={`${role} Name`} 
                          />
                          <input 
                            type="number"
                            value={memberAges[index]} 
                            onChange={(event) => setMemberAges((current) => current.map((v, i) => i === index ? event.target.value : v))} 
                            placeholder="Age"
                            style={isInvalid ? { borderColor: "red", backgroundColor: "#fff0f0" } : {}}
                          />
                          <select
                            value={memberJerseySizes[index] || ""}
                            onChange={(event) => setMemberJerseySizes((current) => current.map((v, i) => i === index ? event.target.value : v))}
                            style={{ padding: "8px", borderRadius: "8px", border: "1px solid #ddd" }}
                          >
                            <option value="">Size</option>
                            {jerseySizeOptions.map((size) => (
                              <option key={size} value={size}>{size}</option>
                            ))}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ marginTop: "8px", fontSize: "14px", color: "#666" }}>
                    <span>Age restriction: {tournamentAgeRange(tournament)}</span>
                    {minAge > 0 && <span style={{ marginLeft: "16px" }}>Min: {minAge} years</span>}
                    {maxAge > 0 && <span style={{ marginLeft: "16px" }}>Max: {maxAge} years</span>}
                  </div>
                </div>

                <label className="acceptance-box">
                  <input type="checkbox" checked={tournamentAccepted} readOnly onClick={(event) => { event.preventDefault(); openRulesModal(); }} />
                  <span>I accept the tournament rules and verify that all player ages are accurate.</span>
                </label>
              </section>
            )}

            <div className="registration-actions">
              <button className="btn btn-secondary" type="button" onClick={goBack}><ArrowLeft size={16} />{activeStep === 0 ? "Back" : "Back"}</button>
              <button className="btn btn-primary" type="button" onClick={goNext} disabled={saving}>{saving ? "Saving..." : "Continue"}<ArrowRight size={16} /></button>
            </div>
          </main>
          {activeStep === 0 ? <TournamentPosterPanel tournament={tournament} /> : null}
        </div>
        
        {rosterImportOpen && (
          <div className="rules-modal-backdrop" role="dialog" aria-modal="true">
            <article className="rules-modal">
              <button className="rules-modal-close" type="button" onClick={() => { setRosterImportOpen(false); setRosterImportText(""); }}>x</button>
              <h2>Import roster</h2>
              <p>Paste player rows or upload a CSV/Excel file. We will fill the first available roster slots.</p>
              <div className="rules-modal-actions" style={{ justifyContent: "flex-start", marginBottom: "12px", gap: "8px" }}>
                <button className="btn btn-secondary btn-sm" type="button" onClick={() => document.getElementById('excel-upload')?.click()}>
                  <FileText size={14} /> Upload Excel
                </button>
                <input 
                  id="excel-upload"
                  ref={excelFileInputRef}
                  type="file" 
                  accept=".xlsx,.xls,.csv" 
                  onChange={handleExcelImport}
                  style={{ display: "none" }}
                />
                <button className="btn btn-secondary btn-sm" type="button" onClick={downloadSampleExcel}>
                  <Download size={14} /> Sample
                </button>
              </div>
              <textarea
                value={rosterImportText}
                onChange={(event) => setRosterImportText(event.target.value)}
                placeholder="Example:&#10;John Doe, 25, L&#10;Ravi Kumar, 24, M"
                style={{ minHeight: "140px", width: "100%", border: "1px solid #d4d8e0", borderRadius: "10px", padding: "10px", resize: "vertical" }}
              />
              <div className="rules-modal-actions">
                <button className="btn btn-secondary" type="button" onClick={() => { setRosterImportOpen(false); setRosterImportText(""); }}>Cancel</button>
                <button className="btn btn-primary" type="button" onClick={handleRosterTextImport}>Import rows</button>
              </div>
            </article>
          </div>
        )}

        {rulesModalOpen && (
          <div className="rules-modal-backdrop" role="dialog" aria-modal="true">
            <article className="rules-modal">
              <button className="rules-modal-close" type="button" onClick={() => setRulesModalOpen(false)}>x</button>
              <h2>Rules and conditions</h2>
              <div className="rules-modal-scroll" onScroll={handleRulesScroll}>
                {tournamentRulesText(tournament).split("\n").map((line, index) => (
                  line ? <p key={index}>{line}</p> : <br key={index} />
                ))}
              </div>
              <div className="rules-modal-actions">
                <button className="btn btn-primary" type="button" disabled={!rulesScrolled} onClick={() => { setTournamentAccepted(true); setRulesModalOpen(false); }}>I Agree</button>
              </div>
            </article>
          </div>
        )}
      </Page>
    </RegistrationShell>
  );
}

export function RegistrationRosterPage() {
  const { slug } = useParams();
  const routeSlug = slug ?? tournaments[0].slug;
  const tournament = withRuntimeTournamentStatus(tournaments.find((item) => item.slug === routeSlug) ?? { ...tournaments[0], slug: routeSlug });
  const saved = useMemo(() => readSavedRegistration(routeSlug), [routeSlug]);

  return (
    <RegistrationShell>
    <Page className="registration-reference-page">
      <section className="registration-hero-copy compact">
        <p className="eyebrow">Review</p>
        <h1>{tournament.name}</h1>
      </section>
      <RegistrationStepper activeIndex={1} />
      {!saved ? (
        <section className="panel">
          <Link className="btn btn-primary" to={`/tournaments/${routeSlug}/register`}>Back to registration</Link>
        </section>
      ) : (
        <div className="detail-grid">
          <section className="panel review-summary">
            <span className="status emerald">Details captured</span>
            <h2>{saved.teamName}</h2>
            <div className="review-list">
              <p><b>Captain</b><span>{saved.captainName}</span></p>
              <p><b>Email</b><span>{saved.email}</span></p>
              <p><b>City</b><span>{saved.city}</span></p>
            </div>
            <Link className="btn btn-primary" to={`/tournaments/${routeSlug}/register/payment`}>Continue to payment</Link>
          </section>
          <section className="panel">
            <h2>Roster</h2>
            <div className="roster-list">
              {saved.members.map((member, index) => (
                <p key={index}><b>{index + 1}</b><span>{member} ({saved.memberAges[index]} yrs) - Size: {saved.memberJerseySizes[index]}</span></p>
              ))}
            </div>
          </section>
        </div>
      )}
    </Page>
    </RegistrationShell>
  );
}

export function RegistrationPaymentPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const routeSlug = slug ?? tournaments[0].slug;
  const fallbackTournament = tournaments.find((item) => item.slug === routeSlug) ?? { ...tournaments[0], slug: routeSlug };
  const [remoteTournament, setRemoteTournament] = useState<Record<string, any> | null>(null);
  const tournament = withRuntimeTournamentStatus(remoteTournament ? normalizeTournamentRecord(remoteTournament, fallbackTournament) : fallbackTournament);
  const saved = useMemo(() => readSavedRegistration(routeSlug), [routeSlug]);
  const amount = amountForTournament(routeSlug, tournament);
  const totalPayable = totalPayableForAmount(amount);
  const [method, setMethod] = useState<"upi" | "card">("upi");
  const [contact, setContact] = useState(saved?.phone ?? "");
  const [card, setCard] = useState({ name: "", number: "", expiry: "", cvv: "" });
  const [qrGenerated, setQrGenerated] = useState(false);
  const [upiChooserOpen, setUpiChooserOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "checking">("idle");
  const [error, setError] = useState("");
  const upiIntent = saved
    ? buildUpiIntent({ amount: totalPayable, registrationId: saved.registrationId, teamName: saved.teamName, tournamentName: tournament.name })
    : "";
  const upiAppLinks = useMemo(() => buildAppUpiLinks(upiIntent), [upiIntent]);

  useEffect(() => {
    let active = true;
    apiRequest<Record<string, any>>(`/public/tournaments/${routeSlug}`)
      .then((item) => {
        if (active) setRemoteTournament(item);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [routeSlug]);

  async function completePayment(selectedMethod: "upi" | "card") {
    if (!saved) return;
    setStatus("checking");
    setError("");
    try {
      const intent = await apiRequest<{ id: string; receipt_number: string; amount: number; method: "card" | "upi"; status: string }>("/payments/local-intent", {
        method: "POST",
        body: JSON.stringify({ tournament_slug: routeSlug, team_name: saved.teamName, amount: totalPayable, method: selectedMethod, contact }),
      });
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await apiRequest(`/payments/local-intent/${intent.id}/confirm`, { method: "POST", body: JSON.stringify({ status: "paid", method: selectedMethod }) });
      const registrationPayment = await apiRequest<{ id: string; receipt_number: string; amount: number; method: "card" | "upi" }>(`/registrations/${saved.registrationId}/local-payment`, {
        method: "POST", body: JSON.stringify({ registration_id: saved.registrationId, method: selectedMethod, amount: totalPayable }),
      });
      const updatedRegistration = await apiRequest<BackendRegistration>(`/registrations/${saved.registrationId}`);
      writeSavedRegistration(routeSlug, { ...saved, teamCode: updatedRegistration.team_code || "" });
      const payment: SavedPayment = { id: registrationPayment.id, receiptNumber: registrationPayment.receipt_number, amount: registrationPayment.amount, method: registrationPayment.method, status: "paid", paidAt: new Date().toISOString() };
      writeSavedPayment(routeSlug, payment);
      navigate(`/tournaments/${routeSlug}/register/review`);
    } catch (caught) {
      setStatus("idle");
      setError("Payment failed. Please try again.");
    }
  }

  function startUpiFlow() { setQrGenerated(true); completePayment("upi"); }
  function openUpiApps() { setQrGenerated(true); setUpiChooserOpen(true); }
  function launchUpiApp(href: string) { setUpiChooserOpen(false); window.location.href = href; setTimeout(() => completePayment("upi"), 1200); }

  return (
    <RegistrationShell>
    <Page className="registration-reference-page">
      <section className="registration-hero-copy compact">
        <h1>Payment</h1>
      </section>
      <RegistrationStepper activeIndex={4} />
      {!saved ? (
        <section className="panel"><Link className="btn btn-primary" to={`/tournaments/${routeSlug}/register`}>Back</Link></section>
      ) : (
        <div className="payment-layout">
          <section className="panel payment-panel">
            <div className="selected-tournament-label">
              <strong>{saved.teamName}</strong>
              <small>{tournament.name} - {formatInr(totalPayable)}</small>
            </div>
            {error && <div className="form-alert">{error}</div>}
            <div className="payment-method-tabs">
              <button className={method === "upi" ? "active" : ""} onClick={() => setMethod("upi")}>UPI</button>
              <button className={method === "card" ? "active" : ""} onClick={() => setMethod("card")}>Card</button>
            </div>
            {method === "upi" ? (
              <div className="upi-payment-box">
                <div className="qr-shell"><QRCodeSVG value={upiIntent} size={150} /></div>
                <button className="btn btn-primary wide" onClick={openUpiApps} disabled={status === "checking"}>Open UPI Apps</button>
                <button className="btn btn-secondary wide" onClick={startUpiFlow} disabled={status === "checking"}>Check Payment Status</button>
                {upiChooserOpen && (
                  <div className="upi-app-sheet">
                    <div className="upi-app-sheet-card">
                      <div className="upi-app-grid">
                        {upiAppLinks.map((app) => (
                          <button key={app.label} onClick={() => launchUpiApp(app.href)}>{app.label}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="form-grid single">
                <input placeholder="Cardholder Name" value={card.name} onChange={e => setCard({...card, name: e.target.value})} />
                <input placeholder="Card Number" value={card.number} onChange={e => setCard({...card, number: e.target.value})} />
                <div className="form-grid">
                  <input placeholder="MM/YY" value={card.expiry} onChange={e => setCard({...card, expiry: e.target.value})} />
                  <input placeholder="CVV" value={card.cvv} onChange={e => setCard({...card, cvv: e.target.value})} />
                </div>
                <button className="btn btn-primary" onClick={() => completePayment("card")} disabled={status === "checking"}>Pay Now</button>
              </div>
            )}
          </section>
          <RegistrationSummary tournament={tournament} amount={amount} />
        </div>
      )}
    </Page>
    </RegistrationShell>
  );
}

export function RegistrationReviewPage() {
  const { slug } = useParams();
  const routeSlug = slug ?? tournaments[0].slug;
  const tournament = withRuntimeTournamentStatus(tournaments.find((item) => item.slug === routeSlug) ?? { ...tournaments[0], slug: routeSlug });
  const saved = useMemo(() => readSavedRegistration(routeSlug), [routeSlug]);
  const payment = useMemo(() => readSavedPayment(routeSlug), [routeSlug]);
  const [backendRegistration, setBackendRegistration] = useState<BackendRegistration | null>(null);

  useEffect(() => {
    if (saved) {
      apiRequest<BackendRegistration>(`/registrations/${saved.registrationId}`)
        .then(setBackendRegistration)
        .catch(() => {});
    }
  }, [saved]);

  const finalTeamCode = backendRegistration?.team_code || saved?.teamCode || "";
  const confirmationCode = backendRegistration?.confirmation_code || (finalTeamCode ? `SS-${finalTeamCode}` : "");
  const qrPayload = JSON.stringify({ registrationId: saved?.registrationId, teamCode: finalTeamCode, tournament: tournament.name });

  useEffect(() => {
    if (saved && payment) {
      saveCompletedRegistration({
        tournamentSlug: routeSlug,
        tournamentName: tournament.name,
        registrationId: saved.registrationId,
        confirmationCode,
        qrPayload,
        teamName: saved.teamName,
        teamCode: finalTeamCode,
        captainName: saved.captainName,
        subCaptainName: saved.subCaptainName,
        coachName: saved.coachName,
        email: saved.email,
        phone: saved.phone,
        city: saved.city,
        category: saved.category,
        members: saved.members,
        documents: saved.documents,
        payment,
        completedAt: new Date().toISOString(),
      });
    }
  }, [saved, payment, confirmationCode, finalTeamCode]);

  return (
    <RegistrationShell>
    <Page className="registration-reference-page">
      <section className="registration-hero-copy compact">
        <h1>Registration Confirmed</h1>
      </section>
      <RegistrationStepper activeIndex={5} />
      {saved && payment && (
        <div className="confirmation-layout">
          <section className="verification-pass">
            <QRCodeSVG value={qrPayload} size={200} />
            <h2>{confirmationCode}</h2>
            <p>{saved.teamName}</p>
            <button className="btn btn-secondary" onClick={() => window.print()}>Print Pass</button>
          </section>
          <section className="panel review-summary">
            <div className="review-list">
              <p><b>Team Code</b><span>{finalTeamCode}</span></p>
              <p><b>Tournament</b><span>{tournament.name}</span></p>
              <p><b>Captain</b><span>{saved.captainName}</span></p>
            </div>
            <Link className="btn btn-primary" to="/user/registrations">View All Registrations</Link>
          </section>
        </div>
      )}
    </Page>
    </RegistrationShell>
  );
}

export function RegistrationPassPage() {
  const { slug } = useParams();
  const { token } = useAuth();
  const routeSlug = slug ?? tournaments[0].slug;
  const tournament = withRuntimeTournamentStatus(tournaments.find((item) => item.slug === routeSlug) ?? { ...tournaments[0], slug: routeSlug });
  const [completed, setCompleted] = useState(() => getCompletedRegistration(routeSlug));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!completed && token) {
      setLoading(true);
      apiRequest<BackendRegistration>(`/registrations/by-tournament/${routeSlug}/mine`)
        .then((reg) => {
          const rec = completedRecordFromBackend(reg, tournament);
          if (rec) { saveCompletedRegistration(rec); setCompleted(rec); }
        })
        .finally(() => setLoading(false));
    }
  }, [token, routeSlug]);

  return (
    <RegistrationShell>
      <Page className="registration-reference-page">
        <h1>Team Pass</h1>
        {completed ? (
          <div className="registration-pass-layout">
            <section className="verification-pass">
              <QRCodeSVG value={completed.qrPayload} size={200} />
              <h2>{completed.confirmationCode}</h2>
              <p>{completed.teamName}</p>
            </section>
            <section className="panel review-summary">
              <div className="review-list">
                <p><b>Captain</b><span>{completed.captainName}</span></p>
                <p><b>Status</b><span>Registration Locked</span></p>
              </div>
            </section>
          </div>
        ) : <p>No registration found.</p>}
      </Page>
    </RegistrationShell>
  );
}
