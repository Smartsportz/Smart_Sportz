import { QRCodeSVG } from "qrcode.react";
import { ArrowLeft, ArrowRight, CheckCircle2, Copy, Download, ExternalLink, FileText, ImagePlus, Printer, ShieldCheck, Smartphone, Trophy, Upload, UserPlus, Users } from "lucide-react";
import { Page } from "../components/UI";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import type React from "react";
import { tournaments, withRuntimeTournamentStatus } from "../data/platform";
import { apiRequest } from "../lib/api";
import { getCompletedRegistration, saveCompletedRegistration } from "../lib/registrationStatus";
import { useAuth } from "../auth/AuthContext";

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
    category: string;
    city: string;
    districtState: string;
    teamLogo: string;
    primaryJerseyColor: string;
    secondaryJerseyColor: string;
    teamMotto: string;
  };
  members: string[];
  documents: SavedDocument[];
  tournamentAccepted: boolean;
  categoryAccepted: boolean;
};

function registrationDraftKey(slug: string) {
  return `registration-draft:${slug}`;
}

function registrationDataKey(slug: string) {
  return `registration:${slug}`;
}

function paymentDataKey(slug: string) {
  return `payment:${slug}`;
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

function amountForTournament(slug: string) {
  if (slug.includes("corporate")) return 129900;
  if (slug.includes("football")) return 349900;
  return 517900;
}

function totalPayableForAmount(amount: number) {
  return amount + Math.round(amount * 0.18);
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

function formatFileSize(size?: number) {
  if (!size) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

function RegistrationStepper({ activeIndex }: { activeIndex: number }) {
  const wizard = ["Tournament", "Category", "Team Details", "Players", "Team Group Image", "Payment", "Confirmation"];
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

function RegistrationSummary({ tournament, amount, showTimeline = false }: { tournament: (typeof tournaments)[number]; amount: number; showTimeline?: boolean }) {
  const fees = Math.round(amount * 0.18);
  const total = totalPayableForAmount(amount);
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

function scrollRegistrationTop() {
  window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
}

export function RegistrationPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const tournament = withRuntimeTournamentStatus(tournaments.find((item) => item.slug === slug) ?? tournaments[0]);
  const amount = amountForTournament(tournament.slug);
  const savedDraft = useMemo(() => readRegistrationDraft(tournament.slug), [tournament.slug]);
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
    category: `${tournament.sport} League`,
    city: tournament.cities[0] ?? "",
    districtState: tournament.cities[0] ?? tournament.location,
    teamLogo: "",
    primaryJerseyColor: "#0b8852",
    secondaryJerseyColor: "#ffffff",
    teamMotto: "",
  });
  const [members, setMembers] = useState(() => {
    const restored = savedDraft?.members ?? [];
    return memberSlots.map((_, index) => restored[index] ?? "");
  });
  const [documents, setDocuments] = useState<SavedDocument[]>(() => savedDraft?.documents ?? [
    { documentType: "Team Group Image", fileName: "", filePath: "", status: "required" },
  ]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [activeStep, setActiveStep] = useState(() => Math.min(Math.max(savedDraft?.activeStep ?? 0, 0), 4));
  const [tournamentAccepted, setTournamentAccepted] = useState(() => savedDraft?.tournamentAccepted ?? false);
  const [categoryAccepted, setCategoryAccepted] = useState(() => savedDraft?.categoryAccepted ?? false);

  useEffect(() => {
    if (getCompletedRegistration(tournament.slug)) {
      navigate(`/tournaments/${tournament.slug}/registration-pass`, { replace: true });
    }
  }, [navigate, tournament.slug]);

  useEffect(() => {
    const draft: RegistrationDraft = {
      activeStep,
      teamDetails,
      members,
      documents,
      tournamentAccepted,
      categoryAccepted,
    };
    localStorage.setItem(registrationDraftKey(tournament.slug), JSON.stringify(draft));
  }, [activeStep, teamDetails, members, documents, tournamentAccepted, categoryAccepted, tournament.slug]);

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
    setDocuments((current) => current.map((item, itemIndex) => itemIndex === index ? {
      ...item,
      fileName,
      fileSize: file?.size,
      filePath: fileName ? `/local-team-images/${encodeURIComponent(fileName)}` : "",
      status: fileName ? "uploaded" : "required",
    } : item));
  }

  async function continueToRoster() {
    const requiredFields = ["teamName", "captainName", "subCaptainName", "email", "phone", "category", "city"] as const;
    const missingTeamFields = requiredFields.filter((key) => !teamDetails[key].trim());
    const missingMemberLabels = members
      .map((name, index) => ({ name: name.trim(), label: memberSlots[index] }))
      .filter((item) => item.name.length < 2)
      .map((item) => item.label);
    const missingDocuments = documents.filter((item) => item.status !== "uploaded").map((item) => item.documentType);
    if (missingTeamFields.length) {
      showMissing(`Please complete these team fields: ${missingTeamFields.join(", ")}.`);
      return;
    }
    if (missingMemberLabels.length) {
      showMissing(`Please complete these player names with at least 2 characters: ${missingMemberLabels.join(", ")}.`);
      return;
    }
    if (missingDocuments.length) {
      showMissing(`Please upload the required team group image: ${missingDocuments.join(", ")}.`);
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
          team_code: "",
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
            name: name.trim(),
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
      }, token);
      const payload: SavedRegistration = {
        registrationId: created.id,
        tournament: tournament.name,
        tournamentSlug: tournament.slug,
        ...teamDetails,
        teamCode: "",
        members,
        documents,
      };
      writeSavedRegistration(tournament.slug, payload);
      localStorage.setItem(registrationDraftKey(tournament.slug), JSON.stringify({
        activeStep: 4,
        teamDetails: { ...teamDetails, teamCode: "" },
        members,
        documents,
        tournamentAccepted,
        categoryAccepted,
      } satisfies RegistrationDraft));
      navigate(`/tournaments/${tournament.slug}/register/roster`);
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
        showMissing("Please accept the tournament rules and conditions before moving to category.");
        return;
      }
      setActiveStep(1);
      scrollRegistrationTop();
      return;
    }
    if (activeStep === 1) {
      if (!teamDetails.category.trim() || !categoryAccepted) {
        showMissing("Please select and accept the category rules before moving to team details.");
        return;
      }
      setActiveStep(2);
      scrollRegistrationTop();
      return;
    }
    if (activeStep === 2) {
      const requiredFields = ["teamName", "captainName", "subCaptainName", "email", "phone", "category", "city"] as const;
      const missingTeamFields = requiredFields.filter((key) => !teamDetails[key].trim());
      if (missingTeamFields.length) {
        showMissing(`Please complete these team fields: ${missingTeamFields.join(", ")}.`);
        return;
      }
      setActiveStep(3);
      scrollRegistrationTop();
      return;
    }
    if (activeStep === 3) {
      const missingMembers = members.map((name, index) => ({ name, label: memberSlots[index] })).filter((item) => !item.name.trim()).map((item) => item.label);
      if (missingMembers.length) {
        showMissing(`Please complete these player entries: ${missingMembers.join(", ")}.`);
        return;
      }
      setActiveStep(4);
      scrollRegistrationTop();
      return;
    }
    void continueToRoster();
  }

  function goBack() {
    setError("");
    if (activeStep === 0) {
      navigate(`/tournaments/${tournament.slug}`);
      return;
    }
    setActiveStep((step) => Math.max(0, step - 1));
    scrollRegistrationTop();
  }

  return (
    <RegistrationShell>
      <Page className="registration-reference-page">
        <section className="registration-hero-copy">
          <p className="eyebrow">SmartSportz</p>
          <h1>Tournament Registration</h1>
          <h2>Compete. Perform. Become a Champion.</h2>
          <p>Complete accurate team, player, team image, and payment details to secure your tournament spot and avoid verification delays.</p>
        </section>
        <RegistrationStepper activeIndex={activeStep} />
        <div className="registration-reference-layout">
          <main className="registration-main">
            {error && <div className="form-alert">{error}</div>}
            {activeStep === 0 && (
              <section className="registration-form-section">
                <div className="section-head-inline">
                  <div>
                    <h2>About Tournament</h2>
                    <p>Review tournament details before selecting a category or entering team data.</p>
                  </div>
                  <span className={`status ${tournament.accent}`}>{tournament.status}</span>
                </div>
                <div className="registration-choice-card">
                  <img src={tournament.image} alt={tournament.name} />
                  <div>
                    <h3>{tournament.name}</h3>
                    <p>{tournament.sport} - {tournament.location} - {tournament.date}</p>
                    <div className="rules-list">
                      <span>Team size: {tournament.teamSize} members including captain and sub-captain</span>
                      <span>Registration: {tournament.registrationStart} to {tournament.registrationEnd}</span>
                      <span>Prize pool: {tournament.prize}</span>
                      <span>Slots: {tournament.teams}/{tournament.capacity} filled</span>
                    </div>
                  </div>
                </div>
                <label className="acceptance-box">
                  <input type="checkbox" checked={tournamentAccepted} onChange={(event) => setTournamentAccepted(event.target.checked)} />
                  <span>I have read and accept the tournament rules, eligibility, schedule, document verification, and fair-play conditions.</span>
                </label>
              </section>
            )}

            {activeStep === 1 && (
              <section className="registration-form-section">
                <h2>Category Selection</h2>
                <p>Select the category for this tournament and accept category-specific conditions.</p>
                <div className="form-grid">
                  <label>Selected category<select value={teamDetails.category} onChange={(event) => updateTeamDetails("category", event.target.value)}><option>{tournament.sport} League</option><option>Professional League</option><option>Corporate League</option><option>Youth League</option></select></label>
                  <label>City<select value={teamDetails.city} onChange={(event) => updateTeamDetails("city", event.target.value)}>{tournament.cities.map((city) => <option key={city}>{city}</option>)}</select></label>
                </div>
                <div className="registration-choice-card compact-card">
                  <Trophy />
                  <div>
                    <h3>{teamDetails.category}</h3>
                    <p>This category uses the tournament team-size limit, city eligibility, score verification, and manager approval workflow.</p>
                  </div>
                </div>
                <label className="acceptance-box">
                  <input type="checkbox" checked={categoryAccepted} onChange={(event) => setCategoryAccepted(event.target.checked)} />
                  <span>I accept the selected category rules, roster size, city eligibility, and registration approval conditions.</span>
                </label>
              </section>
            )}

            {activeStep === 2 && (
              <>
                <section className="registration-form-section">
                  <div className="section-head-inline">
                    <h2>Team Information</h2>
                    <span className="autosave-pill">Draft saved locally</span>
                  </div>
                  <div className="form-grid">
                    <label>Team name<input value={teamDetails.teamName} onChange={(event) => updateTeamDetails("teamName", event.target.value)} placeholder="e.g. Mumbai Mavericks" /></label>
                  </div>
                  <div className="team-logo-row">
                    <label className="logo-upload-tile">Team logo<input type="file" accept="image/png,image/jpeg,image/svg+xml" onChange={(event) => updateTeamDetails("teamLogo", event.target.files?.[0]?.name ?? "")} /><ImagePlus /><span>Upload</span></label>
                    <p><b>{teamDetails.teamLogo || "PNG, JPG or SVG up to 5MB"}</b><small>Minimum 400x400px recommended for clear printing.</small></p>
                  </div>
                  <div className="form-grid">
                    <label>Primary jersey color<input type="color" value={teamDetails.primaryJerseyColor} onChange={(event) => updateTeamDetails("primaryJerseyColor", event.target.value)} /></label>
                    <label>Secondary jersey color<input type="color" value={teamDetails.secondaryJerseyColor} onChange={(event) => updateTeamDetails("secondaryJerseyColor", event.target.value)} /></label>
                    <label>Home district/state<select value={teamDetails.districtState} onChange={(event) => updateTeamDetails("districtState", event.target.value)}>{tournament.cities.map((city) => <option key={city}>{city}</option>)}</select></label>
                    <label>Team motto<input value={teamDetails.teamMotto} onChange={(event) => updateTeamDetails("teamMotto", event.target.value)} placeholder="Describe your team's spirit" /></label>
                  </div>
                </section>
                <section className="registration-form-section">
                  <h2>Team Management</h2>
                  <div className="form-grid">
                    <label>Captain name<input value={teamDetails.captainName} onChange={(event) => updateTeamDetails("captainName", event.target.value)} placeholder="Arjun Sharma" /></label>
                    <label>Sub-captain name<input value={teamDetails.subCaptainName} onChange={(event) => updateTeamDetails("subCaptainName", event.target.value)} placeholder="Rohan Sharma" /></label>
                    <label>Coach name<input value={teamDetails.coachName} onChange={(event) => updateTeamDetails("coachName", event.target.value)} placeholder="Naveen Rao" /></label>
                    <label>Email<input value={teamDetails.email} onChange={(event) => updateTeamDetails("email", event.target.value)} placeholder="captain@team.com" /></label>
                    <label>Phone<input value={teamDetails.phone} onChange={(event) => updateTeamDetails("phone", event.target.value)} placeholder="+91 98765 43210" /></label>
                  </div>
                </section>
              </>
            )}

            {activeStep === 3 && (
              <section className="registration-form-section">
                <div className="section-head-inline">
                  <div>
                    <h2>Player Details</h2>
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
            )}

            {activeStep === 4 && (
              <section className="registration-form-section">
                <h2>Team Group Image</h2>
                <p>Upload one clear team group photo. This image is used for manager verification and team records.</p>
                <div className="document-template-card legacy-document-step" aria-hidden="true">
                  <FileText />
                  <div>
                    <h3>Team Authorization Letter Format</h3>
                    <p>Use this Word template to prepare captain authorization, team consent, and tournament participation declaration.</p>
                  </div>
                  <a className="btn btn-secondary" href={`${import.meta.env.BASE_URL}templates/team-authorization-letter.docx`} download>
                    <Download size={16} />Download DOCX
                  </a>
                </div>
                <div className="document-list">
              {documents.map((document, index) => (
                <label className="document-row" key={document.documentType}>
                  <ImagePlus />
                      <span>
                        <b>{document.documentType}</b>
                        <small>{document.fileName ? `${document.fileName}${document.fileSize ? ` - ${formatFileSize(document.fileSize)}` : ""}` : "Upload one JPG or PNG team group image"}</small>
                      </span>
                  <strong>{document.status === "uploaded" ? "Uploaded" : "Upload"}</strong>
                      <input type="file" accept="image/png,image/jpeg" onChange={(event) => updateDocument(index, event.target.files?.[0])} />
                </label>
              ))}
                </div>
                <p className="secure-note">Maximum file size: 10MB. Supported formats: JPG and PNG. The old document step remains hidden in code for future use.</p>
              </section>
            )}

            <div className="registration-actions">
              <button className="btn btn-secondary" type="button" onClick={goBack}><ArrowLeft size={16} />{activeStep === 0 ? "Back to tournament" : "Back"}</button>
              <button className="btn btn-primary" type="button" onClick={goNext} disabled={saving}>{saving ? "Saving..." : activeStep === 4 ? "Save & Continue" : "Continue"}<ArrowRight size={16} /></button>
            </div>
          </main>
          <RegistrationSummary tournament={tournament} amount={amount} showTimeline={activeStep === 0} />
        </div>
      </Page>
    </RegistrationShell>
  );
}

export function RegistrationRosterPage() {
  const { slug } = useParams();
  const tournament = withRuntimeTournamentStatus(tournaments.find((item) => item.slug === slug) ?? tournaments[0]);
  const saved = useMemo(() => readSavedRegistration(tournament.slug), [tournament.slug]);

  return (
    <RegistrationShell>
    <Page className="registration-reference-page">
      <section className="registration-hero-copy compact">
        <p className="eyebrow">Roster Review</p>
        <h1>{tournament.name}</h1>
        <p>Confirm player names, team image, and captain details before payment.</p>
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
              <p><b>Captain</b><span>{saved.captainName}</span></p>
              <p><b>Sub-captain</b><span>{saved.subCaptainName}</span></p>
              <p><b>Coach</b><span>{saved.coachName || "Not assigned"}</span></p>
              <p><b>City</b><span>{saved.city}</span></p>
              <p><b>Team Image</b><span>{saved.documents.filter((item) => item.status === "uploaded").length}/{saved.documents.length} uploaded</span></p>
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
  const tournament = withRuntimeTournamentStatus(tournaments.find((item) => item.slug === slug) ?? tournaments[0]);
  const saved = useMemo(() => readSavedRegistration(tournament.slug), [tournament.slug]);
  const amount = amountForTournament(tournament.slug);
  const totalPayable = totalPayableForAmount(amount);
  const [method, setMethod] = useState<"upi" | "card">("upi");
  const [contact, setContact] = useState(saved?.phone ?? "");
  const [card, setCard] = useState({ name: "", number: "", expiry: "", cvv: "" });
  const [qrGenerated, setQrGenerated] = useState(false);
  const [status, setStatus] = useState<"idle" | "checking">("idle");
  const [error, setError] = useState("");
  const upiIntent = saved
    ? buildUpiIntent({ amount: totalPayable, registrationId: saved.registrationId, teamName: saved.teamName, tournamentName: tournament.name })
    : "";
  const upiAppLinks = useMemo(() => buildAppUpiLinks(upiIntent), [upiIntent]);

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
          amount: totalPayable,
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
        body: JSON.stringify({ registration_id: saved.registrationId, method: selectedMethod, amount: totalPayable }),
      });
      const updatedRegistration = await apiRequest<BackendRegistration>(`/registrations/${saved.registrationId}`);
      writeSavedRegistration(tournament.slug, {
        ...saved,
        teamCode: updatedRegistration.team_code || saved.teamCode || "",
      });
      const payment: SavedPayment = {
        id: registrationPayment.id,
        receiptNumber: registrationPayment.receipt_number,
        amount: registrationPayment.amount,
        method: registrationPayment.method,
        status: "paid",
        paidAt: new Date().toISOString(),
      };
      writeSavedPayment(tournament.slug, payment);
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

  function openUpiApps() {
    if (!contact.trim()) {
      setError("Enter the payer mobile number or UPI ID before opening UPI apps.");
      return;
    }
    if (!upiIntent || status === "checking") return;
    setQrGenerated(true);
    window.location.href = upiIntent;
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

  async function copyUpiLink() {
    if (!upiIntent) return;
    try {
      await navigator.clipboard.writeText(upiIntent);
      setError("");
    } catch {
      setError("Copy is blocked by this browser. Long press the UPI QR or use Open UPI Apps.");
    }
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
              <small>{tournament.name} - {saved.city} - {saved.members.length} members - Code generated after payment</small>
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
                  <QRCodeSVG value={upiIntent} size={154} />
                  <p>{qrGenerated ? "UPI request opened. Checking payment receipt..." : `Scan or open a UPI app to pay ${formatInr(totalPayable)}.`}</p>
                  <small>Payment ref: {saved.registrationId}</small>
                </div>
                <button className="btn btn-primary upi-open-button" type="button" onClick={openUpiApps} disabled={status === "checking"}>
                  <Smartphone size={17} />{status === "checking" ? "Checking payment..." : "Open UPI Apps"}
                </button>
                <div className="upi-app-grid" aria-label="UPI app choices">
                  {upiAppLinks.map((app) => (
                    <a href={app.href} key={app.label} onClick={() => setQrGenerated(true)}>{app.label}<ExternalLink size={13} /></a>
                  ))}
                </div>
                <div className="upi-fallback-row">
                  <span>Desktop users can scan the QR from a phone UPI app.</span>
                  <button type="button" onClick={copyUpiLink}><Copy size={14} />Copy UPI link</button>
                </div>
                <button className="btn btn-secondary" type="button" onClick={startUpiFlow} disabled={status === "checking"}>{status === "checking" ? "Checking payment..." : "I have paid, check payment"}</button>
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
  const tournament = withRuntimeTournamentStatus(tournaments.find((item) => item.slug === slug) ?? tournaments[0]);
  const saved = useMemo(() => readSavedRegistration(tournament.slug), [tournament.slug]);
  const payment = useMemo(() => readSavedPayment(tournament.slug), [tournament.slug]);
  const [backendRegistration, setBackendRegistration] = useState<BackendRegistration | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!saved || loaded) return;
    setLoaded(true);
    apiRequest<BackendRegistration>(`/registrations/${saved.registrationId}`)
      .then(setBackendRegistration)
      .catch(() => setBackendRegistration(null));
  }, [saved, loaded]);

  const finalTeamCode = backendRegistration?.team_code || saved?.teamCode || "";
  const confirmationCode = backendRegistration?.confirmation_code || (finalTeamCode ? `SS-${finalTeamCode}` : "");
  const qrPayload = backendRegistration?.confirmation_qr_payload || JSON.stringify({
    type: "SmartSportzTeamVerification",
    registrationId: saved?.registrationId,
    confirmationCode,
    teamCode: finalTeamCode,
    teamName: saved?.teamName,
    tournamentSlug: tournament.slug,
    tournamentName: tournament.name,
    captainName: saved?.captainName,
    city: saved?.city,
    paymentReceipt: payment?.receiptNumber,
    receiptNumber: payment?.receiptNumber,
    verificationPath: saved ? `/registrations/${saved.registrationId}` : "",
  });

  useEffect(() => {
    if (!saved || !payment) return;
    saveCompletedRegistration({
      tournamentSlug: tournament.slug,
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
  }, [saved, payment, tournament.slug, tournament.name, confirmationCode, qrPayload, finalTeamCode]);

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
              <p><b>Team Code</b><span>{finalTeamCode}</span></p>
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

export function RegistrationPassPage() {
  const { slug } = useParams();
  const tournament = withRuntimeTournamentStatus(tournaments.find((item) => item.slug === slug) ?? tournaments[0]);
  const completed = getCompletedRegistration(tournament.slug);

  return (
    <RegistrationShell>
      <Page className="registration-reference-page">
        <section className="registration-hero-copy compact">
          <p className="eyebrow">Already Registered</p>
          <h1>Your Tournament Registration</h1>
          <p>This page is read-only after successful payment. Team, payment, unique ID, and QR verification details cannot be edited.</p>
        </section>
        {!completed ? (
          <section className="panel">
            <h2>No completed registration found</h2>
            <p>Complete registration and payment first to generate your read-only verification pass.</p>
            <Link className="btn btn-primary" to={`/tournaments/${tournament.slug}/register`}>Register team</Link>
          </section>
        ) : (
          <div className="registration-pass-layout">
            <section className="verification-pass">
              <div className="pass-head">
                <ShieldCheck />
                <span>Unique Team Pass</span>
              </div>
              <QRCodeSVG value={completed.qrPayload} size={220} level="M" includeMargin />
              <h2>{completed.confirmationCode}</h2>
              <p>{completed.teamName} - {completed.tournamentName}</p>
              <div className="pass-actions">
                <button className="btn btn-secondary" type="button" onClick={() => window.print()}><Printer size={16} />Print pass</button>
                <Link className="btn btn-secondary" to={`/payments/${completed.payment.id}/receipt`}><Download size={16} />View receipt</Link>
              </div>
            </section>
            <section className="panel review-summary">
              <span className="status emerald">Registration locked</span>
              <h2>{completed.teamName}</h2>
              <div className="review-list">
                <p><b>Tournament</b><span>{completed.tournamentName}</span></p>
                <p><b>Registration ID</b><span>{completed.registrationId}</span></p>
                <p><b>Team Code</b><span>{completed.teamCode}</span></p>
                <p><b>Captain</b><span>{completed.captainName}</span></p>
                <p><b>Sub-captain</b><span>{completed.subCaptainName}</span></p>
                <p><b>Coach</b><span>{completed.coachName || "Not assigned"}</span></p>
                <p><b>City</b><span>{completed.city}</span></p>
                <p><b>Category</b><span>{completed.category}</span></p>
                <p><b>Payment</b><span>{completed.payment.receiptNumber} - {formatInr(completed.payment.amount)}</span></p>
              </div>
            </section>
            <section className="panel registration-pass-wide">
              <h2>Team Members</h2>
              <div className="roster-list readonly-roster">
                {completed.members.map((member, index) => (
                  <p key={`${member}-${index}`}><b>{index + 1}</b><span>{member}</span>{index === 0 && <small>Captain</small>}{index === 1 && <small>Sub-captain</small>}</p>
                ))}
              </div>
            </section>
            <section className="panel registration-pass-wide">
              <h2>Team Group Image</h2>
              <div className="document-list">
                {completed.documents.map((document) => (
                  <div className="document-row readonly-document" key={document.documentType}>
                    <FileText />
                    <span><b>{document.documentType}</b><small>{document.fileName || "Uploaded team image"}</small></span>
                    <strong>{document.status}</strong>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </Page>
    </RegistrationShell>
  );
}
