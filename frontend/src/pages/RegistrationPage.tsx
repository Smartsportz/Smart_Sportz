import { Page } from "../components/UI";
import { PageHero } from "./shared";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMemo, useState } from "react";
import { tournaments } from "../data/platform";
import { apiRequest } from "../lib/api";

type SavedRegistration = {
  tournament: string;
  tournamentSlug: string;
  teamName: string;
  captainName: string;
  email: string;
  phone: string;
  category: string;
  city: string;
  members: string[];
};

type SavedPayment = {
  id: string;
  receiptNumber: string;
  amount: number;
  method: "card" | "upi";
  status: "paid";
  paidAt: string;
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

function qrCells(seed: string) {
  return Array.from({ length: 81 }, (_, index) => {
    const code = seed.charCodeAt(index % Math.max(seed.length, 1)) || 7;
    return (code + index * 11) % 5 < 2;
  });
}

export function RegistrationPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const tournament = tournaments.find((item) => item.slug === slug) ?? tournaments[0];
  const wizard = ["Team Details", "Team Member Details", "Roster / Documents", "Payment", "Review"];
  const memberSlots = Array.from({ length: tournament.teamSize }, (_, index) => {
    if (index === 0) return "Captain name";
    if (index === 1) return "Sub-captain name";
    return `Member ${index + 1} name`;
  });
  const [teamDetails, setTeamDetails] = useState({
    teamName: "",
    captainName: "",
    email: "",
    phone: "",
    category: "Professional League",
    city: tournament.cities[0] ?? "",
  });
  const [members, setMembers] = useState(() => memberSlots.map(() => ""));
  const [error, setError] = useState("");

  function updateTeamDetails(field: keyof typeof teamDetails, value: string) {
    setTeamDetails((current) => ({ ...current, [field]: value }));
  }

  function continueToRoster() {
    const missingTeamFields = Object.entries(teamDetails).filter(([, value]) => !value.trim()).map(([key]) => key);
    const missingMembers = members.filter((name) => !name.trim()).length;
    if (missingTeamFields.length || missingMembers) {
      setError(`Please complete all team details and all ${tournament.teamSize} team member names before continuing.`);
      return;
    }
    const payload = { tournament: tournament.name, tournamentSlug: tournament.slug, ...teamDetails, members };
    sessionStorage.setItem(`registration:${tournament.slug}`, JSON.stringify(payload));
    navigate(`/tournaments/${tournament.slug}/register/roster`);
  }

  return (
    <Page>
      <PageHero title="Professional Tournament Registration" text={`Register for ${tournament.name}. This tournament requires ${tournament.teamSize} total team members, including captain and sub-captain.`} />
      <div className="wizard">
        {wizard.map((step, index) => (
          <div className={`wizard-step ${index < 2 ? "active" : ""}`} key={step}><span>{index + 1}</span>{step}</div>
        ))}
      </div>
      <div className="form-layout">
        <form className="panel form-card">
          <div className="selected-tournament-label">
            <span className={`status ${tournament.accent}`}>Selected tournament</span>
            <strong>{tournament.name}</strong>
            <small>{tournament.sport} - {tournament.date} - Cities: {tournament.cities.join(", ")}</small>
          </div>
          {error && <div className="form-alert">{error}</div>}
          <div className="registration-two-column">
            <div className="registration-column">
              <h2>Team details</h2>
              <div className="form-grid single">
                <label>Team name<input value={teamDetails.teamName} onChange={(event) => updateTeamDetails("teamName", event.target.value)} placeholder="Mumbai Mavericks" /></label>
                <label>Captain name<input value={teamDetails.captainName} onChange={(event) => updateTeamDetails("captainName", event.target.value)} placeholder="Arjun Sharma" /></label>
                <label>Email<input value={teamDetails.email} onChange={(event) => updateTeamDetails("email", event.target.value)} placeholder="captain@team.com" /></label>
                <label>Phone<input value={teamDetails.phone} onChange={(event) => updateTeamDetails("phone", event.target.value)} placeholder="+91 98765 43210" /></label>
                <label>Primary category<select value={teamDetails.category} onChange={(event) => updateTeamDetails("category", event.target.value)}><option>Professional League</option><option>Corporate League</option><option>Youth League</option></select></label>
                <label>City<select value={teamDetails.city} onChange={(event) => updateTeamDetails("city", event.target.value)}>{tournament.cities.map((city) => <option key={city}>{city}</option>)}</select></label>
              </div>
            </div>
            <div className="registration-column member-step-panel">
              <div>
                <span className="status emerald">Step 2</span>
                <h3>Team Member Details</h3>
                <p>Enter exactly {tournament.teamSize} member names. Captain and sub-captain are included in this count.</p>
              </div>
              <div className="form-grid single member-grid">
                {memberSlots.map((label, index) => (
                  <label key={label}>{label}<input value={members[index]} onChange={(event) => setMembers((current) => current.map((name, i) => i === index ? event.target.value : name))} placeholder={index === 0 ? "Arjun Sharma" : index === 1 ? "Rohan Sharma" : `Player ${index + 1}`} /></label>
                ))}
              </div>
            </div>
          </div>
          <button className="btn btn-primary" type="button" onClick={continueToRoster}>Continue to roster</button>
        </form>
      </div>
    </Page>
  );
}

export function RegistrationRosterPage() {
  const { slug } = useParams();
  const tournament = tournaments.find((item) => item.slug === slug) ?? tournaments[0];
  const saved = useMemo(() => {
    return readSavedRegistration(tournament.slug);
  }, [tournament.slug]);

  return (
    <Page>
      <PageHero title="Roster Review" text={`Review the roster for ${tournament.name} before documents, payment, and final submission.`} />
      {!saved ? (
        <section className="panel">
          <h2>Registration details required</h2>
          <p>Please complete team details and team member details before opening roster review.</p>
          <Link className="btn btn-primary" to={`/tournaments/${tournament.slug}/register`}>Back to registration</Link>
        </section>
      ) : (
        <div className="detail-grid">
          <section className="panel">
            <h2>{saved.teamName}</h2>
            <p>Captain: {saved.captainName}</p>
            <p>Email: {saved.email}</p>
            <p>Phone: {saved.phone}</p>
            <p>City: {saved.city}</p>
            <p>Category: {saved.category}</p>
          </section>
          <section className="panel">
            <h2>Roster Members</h2>
            <div className="roster-list">
              {saved.members.map((member, index) => (
                <p key={`${member}-${index}`}><b>{index + 1}</b>{member}</p>
              ))}
            </div>
            <Link className="btn btn-primary" to={`/tournaments/${tournament.slug}/register/payment`}>Continue to payment</Link>
          </section>
        </div>
      )}
    </Page>
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
      const intent = await apiRequest<{ id: string; receipt_number: string; amount: number; method: "card" | "upi"; status: string }>(
        "/payments/local-intent",
        {
          method: "POST",
          body: JSON.stringify({
            tournament_slug: tournament.slug,
            team_name: saved.teamName,
            amount,
            method: selectedMethod,
            contact,
          }),
        },
      );
      await new Promise((resolve) => setTimeout(resolve, selectedMethod === "upi" ? 2600 : 1700));
      const paid = await apiRequest<{ id: string; receipt_number: string; amount: number; method: "card" | "upi" }>(
        `/payments/local-intent/${intent.id}/confirm`,
        {
          method: "POST",
          body: JSON.stringify({ status: "paid", method: selectedMethod }),
        },
      );
      const payment: SavedPayment = {
        id: paid.id,
        receiptNumber: paid.receipt_number,
        amount: paid.amount,
        method: paid.method,
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
    <Page>
      <PageHero title="Secure Payment" text={`Complete payment for ${tournament.name}. In production this step opens Razorpay Checkout for card, UPI, wallet, and bank authentication.`} />
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
              <small>{tournament.name} - {saved.city} - {saved.members.length} members</small>
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
                  <div className="qr-code-grid" aria-label="Generated UPI QR">
                    {qrCells(`${saved.teamName}-${amount}`).map((filled, index) => <span className={filled ? "qr-cell filled" : "qr-cell"} key={index} />)}
                  </div>
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
          <aside className="panel payment-summary-card">
            <span className="status emerald">Payment summary</span>
            <h2>{formatInr(amount)}</h2>
            <p>Entry fee, registration processing, and tournament confirmation for {saved.teamName}.</p>
            <div className="review-list">
              <p><b>Tournament</b><span>{tournament.name}</span></p>
              <p><b>City</b><span>{saved.city}</span></p>
              <p><b>Method</b><span>{method === "upi" ? "UPI QR" : "Card checkout"}</span></p>
              <p><b>Status</b><span>{status === "checking" ? "Checking" : "Ready"}</span></p>
            </div>
          </aside>
        </div>
      )}
    </Page>
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

  return (
    <Page>
      <PageHero title="Registration Review" text="Your team registration is ready for tournament manager approval." />
      {!saved || !payment ? (
        <section className="panel">
          <h2>Payment confirmation required</h2>
          <p>Please complete payment before opening the final review.</p>
          <Link className="btn btn-primary" to={`/tournaments/${tournament.slug}/register/payment`}>Back to payment</Link>
        </section>
      ) : (
        <div className="detail-grid">
          <section className="panel review-summary">
            <span className="status emerald">Submitted for approval</span>
            <h2>{saved.teamName}</h2>
            <div className="review-list">
              <p><b>Tournament</b><span>{tournament.name}</span></p>
              <p><b>Captain</b><span>{saved.captainName}</span></p>
              <p><b>Contact</b><span>{saved.email} / {saved.phone}</span></p>
              <p><b>City</b><span>{saved.city}</span></p>
              <p><b>Members</b><span>{saved.members.length}</span></p>
            </div>
          </section>
          <section className="panel review-summary">
            <span className="status emerald">Payment received</span>
            <h2>{formatInr(payment.amount)}</h2>
            <div className="review-list">
              <p><b>Payment ID</b><span>{payment.id}</span></p>
              <p><b>Receipt</b><span>{payment.receiptNumber}</span></p>
              <p><b>Method</b><span>{payment.method === "upi" ? "UPI QR" : "Card checkout"}</span></p>
              <p><b>Status</b><span>Paid</span></p>
            </div>
            <Link className="btn btn-primary" to="/user/registrations">Open my registrations</Link>
          </section>
        </div>
      )}
    </Page>
  );
}
