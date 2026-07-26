import { QRCodeSVG } from "qrcode.react";
import { ArrowLeft, ArrowRight, Bell, CheckCircle2, Download, FileText, ImagePlus, Printer, Settings, ShieldCheck, Trophy, Upload, UserPlus, Users } from "lucide-react";
import { Page } from "../components/UI";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import type React from "react";
import { tournaments } from "../data/platform";
import { apiRequest } from "../lib/api";

type SavedDocument = {
  documentType: string;
  fileName: string;
  filePath: string;
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
  primaryJerseyColor: string;
  secondaryJerseyColor: string;
  teamMotto: string;
  members: string[];
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
  team_name: string;
  team_code?: string;
  captain_name: string;
  confirmation_code?: string;
  confirmation_qr_payload?: string;
  documents?: Array<{ document_type: string; file_name: string; file_path: string; status: SavedDocument["status"] }>;
  prizes?: Array<{ position: number; label: string; amount: number }>;
};

function readSavedRegistration(slug: string) {
  const raw = sessionStorage.getItem(`registration:${slug}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SavedRegistration;
  } catch {
    return null;
  }
}

function amountForTournament(slug: string) {
  if (slug.includes("corporate")) return 129900;
  if (slug.includes("football")) return 349900;
  return 517900;
}

function formatInr(cents: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(cents / 100);
}

function prizePoolAmount(prize: string) {
  const number = Number(prize.replace(/[^\d]/g, ""));
  return Number.isFinite(number) ? number * 100 : 0;
}

function prizeBreakdown(prize: string) {
  const total = prizePoolAmount(prize);
  const first = Math.round(total * 0.6);
  const second = Math.round(total * 0.3);
  return [
    { label: "1st Prize", amount: first },
    { label: "2nd Prize", amount: second },
    { label: "3rd Prize", amount: total - first - second },
  ];
}

function registrationCode(seed: string) {
  return seed
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 12);
}

function RegistrationStepper({ activeIndex }: { activeIndex: number }) {
  const wizard = ["Tournament", "Category", "Team Details", "Players", "Documents", "Payment", "Confirmation"];
  return (
    <div className="registration-stepper" aria-label="Registration progress">
      {wizard.map((step, index) => (
        <div className={`registration-step ${index <= activeIndex ? "active" : ""}`} key={step}>
          <span>{index + 1}</span>
          {step}
        </div>
      ))}
    </div>
  );
}

function RegistrationShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="registration-top-nav">
        <Link className="registration-brand" to="/">
          <img src={`${import.meta.env.BASE_URL}assets/logo.png`} alt="SmartSportz.in" />
          <span>SmartSportz.in</span>
        </Link>
        <nav>
          <Link className="active" to="/tournaments/mumbai-premier-bash/register">Register</Link>
          <Link to="/tournaments">Tournaments</Link>
          <Link to="/live">Live Scores</Link>
        </nav>
        <div className="registration-nav-actions">
          <Link to="/notifications" aria-label="Notifications"><Bell size={18} /></Link>
          <Link to="/settings" aria-label="Settings"><Settings size={18} /></Link>
          <Link className="registration-login" to="/user/dashboard">My Dashboard</Link>
        </div>
      </header>
      {children}
      <footer className="registration-footer">
        <div>
          <h3>SmartSportz.in Sports Management</h3>
          <p>Empowering Indian athletes through world-class tournament infrastructure and digital verification.</p>
        </div>
        <nav>
          <Link to="/about">Privacy Policy</Link>
          <Link to="/faq">Cookie Policy</Link>
          <Link to="/contact">Contact Us</Link>
        </nav>
        <small>(c) 2026 SmartSportz.in. All rights reserved.</small>
      </footer>
    </>
  );
}

function RegistrationSummary({ tournament, amount }: { tournament: (typeof tournaments)[number]; amount: number }) {
  const fees = Math.round(amount * 0.18);
  const total = amount + fees;
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
          <p><span>Prize Pool</span><b>{tournament.prize}</b></p>
          <p><span>Slots</span><b>{String(tournament.teams).padStart(2, "0")}/{tournament.capacity} Filled</b></p>
        </div>
        <div className="prize-split">
          {prizeBreakdown(tournament.prize).map((item) => <p key={item.label}><span>{item.label}</span><b>{formatInr(item.amount)}</b></p>)}
        </div>
        <div className="summary-lines total-lines">
          <p><span>Registration Fee</span><b>{formatInr(amount)}</b></p>
          <p><span>Platform & GST (18%)</span><b>{formatInr(fees)}</b></p>
          <p className="payable"><span>Total Payable</span><b>{formatInr(total)}</b></p>
        </div>
        <button className="btn btn-secondary wide" type="button"><Download size={16} />Download Rulebook</button>
      </section>
      <section className="registration-timeline">
        <h3>Registration Timeline</h3>
        <p className="done"><span />Registration Started<small>{tournament.registrationStart}</small></p>
        <p><span />Early Bird Deadline<small>{tournament.registrationEnd}</small></p>
        <p><span />Final Closing<small>{tournament.date}</small></p>
      </section>
    </aside>
  );
}

export function RegistrationPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const tournament = tournaments.find((item) => item.slug === slug) ?? tournaments[0];
  const amount = amountForTournament(tournament.slug);
  const memberSlots = Array.from({ length: tournament.teamSize }, (_, index) => {
    if (index === 0) return "Captain";
    if (index === 1) return "Sub-captain";
    return `Player ${index + 1}`;
  });
  const [teamDetails, setTeamDetails] = useState({
    teamName: "",
    teamCode: "",
    captainName: "",
    subCaptainName: "",
    coachName: "",
    email: "",
    phone: "",
    category: `${tournament.sport} League`,
    city: tournament.cities[0] ?? "",
    districtState: tournament.cities[0] ?? tournament.location,
    teamLogo: "",
    primaryJerseyColor: "#0b8852",
    secondaryJerseyColor: "#ffffff",
    teamMotto: "",
  });
  const [members, setMembers] = useState(() => memberSlots.map(() => ""));
  const [documents, setDocuments] = useState<SavedDocument[]>([
    { documentType: "Team Authorization Letter", fileName: "", filePath: "", status: "required" },
    { documentType: "Captain ID Proof", fileName: "", filePath: "", status: "required" },
  ]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function updateTeamDetails(field: keyof typeof teamDetails, value: string) {
    setTeamDetails((current) => {
      const next = { ...current, [field]: value };
      if (field === "teamName" && !current.teamCode.trim()) {
        next.teamCode = registrationCode(value);
      }
      if (field === "captainName") {
        setMembers((items) => items.map((name, index) => index === 0 ? value : name));
      }
      if (field === "subCaptainName") {
        setMembers((items) => items.map((name, index) => index === 1 ? value : name));
      }
      return next;
    });
  }

  function updateDocument(index: number, fileName: string) {
    setDocuments((current) => current.map((item, itemIndex) => itemIndex === index ? {
      ...item,
      fileName,
      filePath: fileName ? `/local-documents/${encodeURIComponent(fileName)}` : "",
      status: fileName ? "uploaded" : "required",
    } : item));
  }

  async function continueToRoster() {
    const requiredFields = ["teamName", "teamCode", "captainName", "subCaptainName", "email", "phone", "category", "city"] as const;
    const missingTeamFields = requiredFields.filter((key) => !teamDetails[key].trim());
    const missingMembers = members.filter((name) => !name.trim()).length;
    if (missingTeamFields.length || missingMembers) {
      setError(`Please complete required team details and all ${tournament.teamSize} player names before continuing.`);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const uploadedDocuments = documents.filter((item) => item.fileName.trim());
      const created = await apiRequest<BackendRegistration>("/registrations", {
        method: "POST",
        body: JSON.stringify({
          tournament_slug: tournament.slug,
          team_name: teamDetails.teamName,
          team_code: teamDetails.teamCode,
          captain_name: teamDetails.captainName,
          sub_captain_name: teamDetails.subCaptainName,
          coach_name: teamDetails.coachName,
          email: teamDetails.email,
          phone: teamDetails.phone,
          city: teamDetails.city,
          district_state: teamDetails.districtState,
          team_logo: teamDetails.teamLogo,
          primary_jersey_color: teamDetails.primaryJerseyColor,
          secondary_jersey_color: teamDetails.secondaryJerseyColor,
          team_motto: teamDetails.teamMotto,
          category: teamDetails.category,
          members: members.map((name, index) => ({
            name,
            role: index === 0 ? "Captain" : index === 1 ? "Sub-captain" : "Player",
            jersey: "",
            contact: index === 0 ? teamDetails.phone : "",
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
        tournamentSlug: tournament.slug,
        ...teamDetails,
        members,
        documents,
      };
      sessionStorage.setItem(`registration:${tournament.slug}`, JSON.stringify(payload));
      navigate(`/tournaments/${tournament.slug}/register/roster`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Registration could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <RegistrationShell>
      <Page className="registration-reference-page">
        <section className="registration-hero-copy">
          <p className="eyebrow">SmartSportz</p>
          <h1>Tournament Registration</h1>
          <h2>Compete. Perform. Become a Champion.</h2>
          <p>Complete accurate team, player, document, and payment details to secure your tournament spot and avoid verification delays.</p>
        </section>
        <RegistrationStepper activeIndex={4} />
        <div className="registration-reference-layout">
          <main className="registration-main">
            {error && <div className="form-alert">{error}</div>}
            <section className="registration-form-section">
            <div className="section-head-inline">
              <h2>Team Information</h2>
              <span className="autosave-pill">Draft saved locally</span>
            </div>
            <div className="form-grid">
              <label>Team name<input value={teamDetails.teamName} onChange={(event) => updateTeamDetails("teamName", event.target.value)} placeholder="e.g. Mumbai Mavericks" /></label>
              <label>Team code<input value={teamDetails.teamCode} onChange={(event) => updateTeamDetails("teamCode", registrationCode(event.target.value))} placeholder="e.g. MAV-2026" /></label>
            </div>
            <div className="team-logo-row">
              <label className="logo-upload-tile">Team logo<input type="file" accept="image/png,image/jpeg,image/svg+xml" onChange={(event) => updateTeamDetails("teamLogo", event.target.files?.[0]?.name ?? "")} /><ImagePlus /><span>Upload</span></label>
              <p><b>{teamDetails.teamLogo || "PNG, JPG or SVG up to 5MB"}</b><small>Minimum 400x400px recommended for clear printing.</small></p>
            </div>
            <div className="form-grid">
              <label>Primary jersey color<input type="color" value={teamDetails.primaryJerseyColor} onChange={(event) => updateTeamDetails("primaryJerseyColor", event.target.value)} /></label>
              <label>Secondary jersey color<input type="color" value={teamDetails.secondaryJerseyColor} onChange={(event) => updateTeamDetails("secondaryJerseyColor", event.target.value)} /></label>
              <label>Home district/state<select value={teamDetails.districtState} onChange={(event) => updateTeamDetails("districtState", event.target.value)}>{tournament.cities.map((city) => <option key={city}>{city}</option>)}</select></label>
              <label>Category<select value={teamDetails.category} onChange={(event) => updateTeamDetails("category", event.target.value)}><option>{tournament.sport} League</option><option>Professional League</option><option>Corporate League</option><option>Youth League</option></select></label>
            </div>
            <label>Team motto<input value={teamDetails.teamMotto} onChange={(event) => updateTeamDetails("teamMotto", event.target.value)} placeholder="Describe your team's spirit in one sentence" /></label>
            </section>

            <section className="registration-form-section">
            <h2>Team Management</h2>
            <div className="form-grid">
              <label>Captain name<input value={teamDetails.captainName} onChange={(event) => updateTeamDetails("captainName", event.target.value)} placeholder="Arjun Sharma" /></label>
              <label>Sub-captain name<input value={teamDetails.subCaptainName} onChange={(event) => updateTeamDetails("subCaptainName", event.target.value)} placeholder="Rohan Sharma" /></label>
              <label>Coach name<input value={teamDetails.coachName} onChange={(event) => updateTeamDetails("coachName", event.target.value)} placeholder="Naveen Rao" /></label>
              <label>City<select value={teamDetails.city} onChange={(event) => updateTeamDetails("city", event.target.value)}>{tournament.cities.map((city) => <option key={city}>{city}</option>)}</select></label>
              <label>Email<input value={teamDetails.email} onChange={(event) => updateTeamDetails("email", event.target.value)} placeholder="captain@team.com" /></label>
              <label>Phone<input value={teamDetails.phone} onChange={(event) => updateTeamDetails("phone", event.target.value)} placeholder="+91 98765 43210" /></label>
            </div>
            </section>

            <section className="registration-form-section">
            <div className="section-head-inline">
              <div>
                <h2>Player Roster</h2>
                <p>Minimum and maximum: {tournament.teamSize} players. Captain and sub-captain are included.</p>
              </div>
              <div className="section-actions">
                <button className="btn btn-secondary" type="button"><Upload size={16} />Import Excel</button>
                <button className="btn btn-primary" type="button"><UserPlus size={16} />Add Player</button>
              </div>
            </div>
            <div className="player-roster-grid">
              {memberSlots.map((role, index) => (
                <label className="player-entry-card" key={role}>
                  <span>{index + 1}</span>
                  <b>{role}</b>
                  <input value={members[index]} onChange={(event) => setMembers((current) => current.map((name, i) => i === index ? event.target.value : name))} placeholder={index === 0 ? "Captain name" : index === 1 ? "Sub-captain name" : `Player ${index + 1}`} />
                </label>
              ))}
            </div>
            </section>

            <section className="registration-form-section">
            <h2>Required Documentation</h2>
            <div className="document-list">
              {documents.map((document, index) => (
                <label className="document-row" key={document.documentType}>
                  <FileText />
                  <span><b>{document.documentType}</b><small>{document.fileName || "PDF, JPG, or PNG document required"}</small></span>
                  <strong>{document.status === "uploaded" ? "Uploaded" : "Upload"}</strong>
                  <input type="file" accept=".pdf,image/png,image/jpeg" onChange={(event) => updateDocument(index, event.target.files?.[0]?.name ?? "")} />
                </label>
              ))}
            </div>
            <p className="secure-note">Maximum file size: 10MB per document. Supported formats: PDF, JPG, PNG. Documents are stored as metadata in local demo mode.</p>
            </section>

            <div className="registration-actions">
              <Link className="btn btn-secondary" to={`/tournaments/${tournament.slug}`}><ArrowLeft size={16} />Back to Category</Link>
              <button className="btn btn-primary" type="button" onClick={continueToRoster} disabled={saving}>{saving ? "Saving..." : "Save & Continue"}<ArrowRight size={16} /></button>
            </div>
          </main>
          <RegistrationSummary tournament={tournament} amount={amount} />
        </div>
      </Page>
    </RegistrationShell>
  );
}

export function RegistrationRosterPage() {
  const { slug } = useParams();
  const tournament = tournaments.find((item) => item.slug === slug) ?? tournaments[0];
  const saved = useMemo(() => readSavedRegistration(tournament.slug), [tournament.slug]);

  return (
    <RegistrationShell>
    <Page className="registration-reference-page">
      <section className="registration-hero-copy compact">
        <p className="eyebrow">Roster Review</p>
        <h1>{tournament.name}</h1>
        <p>Confirm player names, documents, and captain details before payment.</p>
      </section>
      <RegistrationStepper activeIndex={4} />
      {!saved ? (
        <section className="panel">
          <h2>Registration details required</h2>
          <p>Please complete team details and team member details before opening roster review.</p>
          <Link className="btn btn-primary" to={`/tournaments/${tournament.slug}/register`}>Back to registration</Link>
        </section>
      ) : (
        <div className="detail-grid">
          <section className="panel review-summary">
            <span className="status emerald">Team verified</span>
            <h2>{saved.teamName}</h2>
            <div className="review-list">
              <p><b>Team Code</b><span>{saved.teamCode}</span></p>
              <p><b>Captain</b><span>{saved.captainName}</span></p>
              <p><b>Sub-captain</b><span>{saved.subCaptainName}</span></p>
              <p><b>Coach</b><span>{saved.coachName || "Not assigned"}</span></p>
              <p><b>City</b><span>{saved.city}</span></p>
              <p><b>Documents</b><span>{saved.documents.filter((item) => item.status === "uploaded").length}/{saved.documents.length} uploaded</span></p>
            </div>
            <Link className="btn btn-primary" to={`/tournaments/${tournament.slug}/register/payment`}>Continue to payment</Link>
          </section>
          <section className="panel">
            <h2>Roster Members</h2>
            <div className="roster-list">
              {saved.members.map((member, index) => (
                <p key={`${member}-${index}`}><b>{index + 1}</b><span>{member}</span>{index === 0 && <small>Captain</small>}{index === 1 && <small>Sub-captain</small>}</p>
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
  const tournament = tournaments.find((item) => item.slug === slug) ?? tournaments[0];
  const saved = useMemo(() => readSavedRegistration(tournament.slug), [tournament.slug]);
  const amount = amountForTournament(tournament.slug);
  const [method, setMethod] = useState<"upi" | "card">("upi");
  const [contact, setContact] = useState(saved?.phone ?? "");
  const [card, setCard] = useState({ name: "", number: "", expiry: "", cvv: "" });
  const [qrGenerated, setQrGenerated] = useState(false);
  const [status, setStatus] = useState<"idle" | "checking">("idle");
  const [error, setError] = useState("");

  async function completePayment(selectedMethod: "upi" | "card") {
    if (!saved) return;
    setStatus("checking");
    setError("");
    try {
      const intent = await apiRequest<{ id: string; receipt_number: string; amount: number; method: "card" | "upi"; status: string }>("/payments/local-intent", {
        method: "POST",
        body: JSON.stringify({
          tournament_slug: tournament.slug,
          team_name: saved.teamName,
          amount,
          method: selectedMethod,
          contact,
        }),
      });
      await new Promise((resolve) => setTimeout(resolve, selectedMethod === "upi" ? 1600 : 1200));
      await apiRequest(`/payments/local-intent/${intent.id}/confirm`, {
        method: "POST",
        body: JSON.stringify({ status: "paid", method: selectedMethod }),
      });
      const registrationPayment = await apiRequest<{ id: string; receipt_number: string; amount: number; method: "card" | "upi" }>(`/registrations/${saved.registrationId}/local-payment`, {
        method: "POST",
        body: JSON.stringify({ registration_id: saved.registrationId, method: selectedMethod }),
      });
      const payment: SavedPayment = {
        id: registrationPayment.id,
        receiptNumber: registrationPayment.receipt_number,
        amount: registrationPayment.amount,
        method: registrationPayment.method,
        status: "paid",
        paidAt: new Date().toISOString(),
      };
      sessionStorage.setItem(`payment:${tournament.slug}`, JSON.stringify(payment));
      navigate(`/tournaments/${tournament.slug}/register/review`);
    } catch (caught) {
      setStatus("idle");
      setError(caught instanceof Error ? caught.message : "Payment could not be completed");
    }
  }

  function startUpiFlow() {
    if (!contact.trim()) {
      setError("Enter the payer mobile number or UPI ID before generating the QR.");
      return;
    }
    setQrGenerated(true);
    void completePayment("upi");
  }

  function startCardFlow() {
    const cleanNumber = card.number.replace(/\s/g, "");
    if (!contact.trim() || !card.name.trim() || cleanNumber.length < 12 || !card.expiry.trim() || card.cvv.length < 3) {
      setError("Enter contact, card name, card number, expiry, and CVV to continue.");
      return;
    }
    void completePayment("card");
  }

  return (
    <RegistrationShell>
    <Page className="registration-reference-page">
      <section className="registration-hero-copy compact">
        <p className="eyebrow">Secure Payment</p>
        <h1>Complete Payment</h1>
        <p>Use the local Razorpay-style payment flow. Live card PIN and bank OTP stay inside Razorpay in production.</p>
      </section>
      <RegistrationStepper activeIndex={5} />
      {!saved ? (
        <section className="panel">
          <h2>Registration details required</h2>
          <p>Please complete registration and roster review before payment.</p>
          <Link className="btn btn-primary" to={`/tournaments/${tournament.slug}/register`}>Back to registration</Link>
        </section>
      ) : (
        <div className="payment-layout">
          <section className="panel payment-panel">
            <div className="selected-tournament-label">
              <span className={`status ${tournament.accent}`}>Selected tournament</span>
              <strong>{saved.teamName}</strong>
              <small>{tournament.name} - {saved.city} - {saved.members.length} members - Code {saved.teamCode}</small>
            </div>
            {error && <div className="form-alert">{error}</div>}
            <label>Pay number / UPI contact<input value={contact} onChange={(event) => setContact(event.target.value)} placeholder="+91 98765 43210 or team@upi" /></label>
            <div className="payment-method-tabs" role="tablist" aria-label="Payment method">
              <button className={method === "upi" ? "active" : ""} type="button" onClick={() => setMethod("upi")}>UPI QR</button>
              <button className={method === "card" ? "active" : ""} type="button" onClick={() => setMethod("card")}>Card</button>
            </div>
            {method === "upi" ? (
              <div className="upi-payment-box">
                <div className="qr-shell">
                  <QRCodeSVG value={`upi://pay?pa=smartsportz@local&pn=SmartSportz&am=${(amount / 100).toFixed(2)}&tn=${saved.teamCode}`} size={154} />
                  <p>{qrGenerated ? "QR generated. Checking payment receipt..." : "Generate QR to scan and pay with any UPI app."}</p>
                </div>
                <button className="btn btn-primary" type="button" onClick={startUpiFlow} disabled={status === "checking"}>{status === "checking" ? "Checking payment..." : "Generate QR and check payment"}</button>
              </div>
            ) : (
              <div className="form-grid single">
                <label>Name on card<input value={card.name} onChange={(event) => setCard((current) => ({ ...current, name: event.target.value }))} placeholder="Arjun Sharma" /></label>
                <label>Card number<input inputMode="numeric" value={card.number} onChange={(event) => setCard((current) => ({ ...current, number: event.target.value }))} placeholder="4111 1111 1111 1111" /></label>
                <div className="form-grid">
                  <label>Expiry<input value={card.expiry} onChange={(event) => setCard((current) => ({ ...current, expiry: event.target.value }))} placeholder="MM/YY" /></label>
                  <label>CVV<input inputMode="numeric" value={card.cvv} onChange={(event) => setCard((current) => ({ ...current, cvv: event.target.value }))} placeholder="123" /></label>
                </div>
                <p className="secure-note">Card PIN/OTP authentication is handled by Razorpay and the issuer bank in the live payment window.</p>
                <button className="btn btn-primary" type="button" onClick={startCardFlow} disabled={status === "checking"}>{status === "checking" ? "Processing payment..." : "Pay securely with Razorpay"}</button>
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
  const tournament = tournaments.find((item) => item.slug === slug) ?? tournaments[0];
  const saved = useMemo(() => readSavedRegistration(tournament.slug), [tournament.slug]);
  const payment = useMemo(() => {
    const raw = sessionStorage.getItem(`payment:${tournament.slug}`);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as SavedPayment;
    } catch {
      return null;
    }
  }, [tournament.slug]);
  const [backendRegistration, setBackendRegistration] = useState<BackendRegistration | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!saved || loaded) return;
    setLoaded(true);
    apiRequest<BackendRegistration>(`/registrations/${saved.registrationId}`)
      .then(setBackendRegistration)
      .catch(() => setBackendRegistration(null));
  }, [saved, loaded]);

  const confirmationCode = backendRegistration?.confirmation_code || (saved ? `SS-${saved.teamCode}` : "");
  const qrPayload = backendRegistration?.confirmation_qr_payload || JSON.stringify({
    type: "SmartSportzTeamVerification",
    registrationId: saved?.registrationId,
    confirmationCode,
    teamCode: saved?.teamCode,
    teamName: saved?.teamName,
    tournamentSlug: tournament.slug,
    tournamentName: tournament.name,
    captainName: saved?.captainName,
    city: saved?.city,
    receiptNumber: payment?.receiptNumber,
    verificationPath: saved ? `/registrations/${saved.registrationId}` : "",
  });

  return (
    <RegistrationShell>
    <Page className="registration-reference-page">
      <section className="registration-hero-copy compact">
        <p className="eyebrow">Confirmation</p>
        <h1>Team Verification Pass</h1>
        <p>Your QR code is generated after payment and can be used for check-in, manager verification, and document lookup.</p>
      </section>
      <RegistrationStepper activeIndex={6} />
      {!saved || !payment ? (
        <section className="panel">
          <h2>Payment confirmation required</h2>
          <p>Please complete payment before opening the final review.</p>
          <Link className="btn btn-primary" to={`/tournaments/${tournament.slug}/register/payment`}>Back to payment</Link>
        </section>
      ) : (
        <div className="confirmation-layout">
          <section className="verification-pass">
            <div className="pass-head">
              <ShieldCheck />
              <span>SmartSportz Verification</span>
            </div>
            <QRCodeSVG value={qrPayload} size={210} level="M" includeMargin />
            <h2>{confirmationCode}</h2>
            <p>{saved.teamName} - {tournament.name}</p>
            <div className="pass-actions">
              <button className="btn btn-secondary" type="button"><Download size={16} />Download QR Pass</button>
              <button className="btn btn-secondary" type="button" onClick={() => window.print()}><Printer size={16} />Print Confirmation</button>
            </div>
          </section>
          <section className="panel review-summary">
            <span className="status emerald"><CheckCircle2 size={14} />Submitted for approval</span>
            <h2>{saved.teamName}</h2>
            <div className="review-list">
              <p><b>Registration ID</b><span>{saved.registrationId}</span></p>
              <p><b>Team Code</b><span>{saved.teamCode}</span></p>
              <p><b>Tournament</b><span>{tournament.name}</span></p>
              <p><b>Captain</b><span>{saved.captainName}</span></p>
              <p><b>Sub-captain</b><span>{saved.subCaptainName}</span></p>
              <p><b>Contact</b><span>{saved.email} / {saved.phone}</span></p>
              <p><b>City</b><span>{saved.city}</span></p>
              <p><b>Members</b><span>{saved.members.length}</span></p>
              <p><b>Payment</b><span>{payment.receiptNumber}</span></p>
            </div>
            <div className="registration-actions compact-actions">
              <Link className="btn btn-primary" to="/user/registrations"><Users size={16} />Open my registrations</Link>
              <Link className="btn btn-secondary" to={`/payments/${payment.id}/receipt`}><Trophy size={16} />View Receipt</Link>
            </div>
          </section>
        </div>
      )}
    </Page>
    </RegistrationShell>
  );
}
