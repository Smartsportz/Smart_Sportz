import { Link, useParams } from "react-router-dom";
import { Page, PortalShell } from "../components/UI";
import { sidebar } from "../data/platform";
import { InfoPanel, PageHero } from "./shared";
import { useEffect, useMemo, useState } from "react";
import { Download, Printer } from "lucide-react";
import { apiRequest } from "../lib/api";
import { SectionSkeleton } from "../lib/progressive";

const utilityDetails = {
  payment: {
    title: "Registration Payment Receipt",
    text: "Receipt and payment status page for Razorpay order, invoice, refund, and webhook verification.",
    panels: ["Order created", "Payment captured", "Webhook verified", "Receipt generated"],
  },
  "admin-payments": {
    title: "Payment Operations Review",
    text: "Admin review page for payment events, refund checks, invoice states, and Razorpay webhook audit.",
    panels: ["Gateway event", "Signature validation", "Receipt status", "Refund review"],
  },
  "admin-reports": {
    title: "Reports Detail Review",
    text: "Admin report detail page for revenue, registration funnel, venue utilization, and live score audit.",
    panels: ["Filter report", "Validate numbers", "Export CSV/PDF", "Schedule email"],
  },
  "admin-logs": {
    title: "Audit Log Detail",
    text: "Security and software event log detail page for login events, score corrections, CMS publishing, and webhook activity.",
    panels: ["Actor", "Event type", "IP and device", "Before and after state"],
  },
};

type ReceiptResponse = {
  payment: {
    id: string;
    registration_id: string;
    status: string;
    amount: number;
    method: string;
    receipt_number: string;
    created_at: string;
  };
  registration?: {
    id: string;
    tournament_slug: string;
    tournament_name?: string;
    team_name: string;
    team_code?: string;
    captain_name: string;
    sub_captain_name?: string;
    email: string;
    phone: string;
    city: string;
    category: string;
    confirmation_code?: string;
  } | null;
};

function formatInr(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}

function downloadReceiptFile(receipt: ReceiptResponse) {
  const registration = receipt.registration;
  const lines = [
    "SMART SPORTZ PAYMENT RECEIPT",
    `Receipt Number: ${receipt.payment.receipt_number}`,
    `Payment ID: ${receipt.payment.id}`,
    `Payment Status: ${receipt.payment.status}`,
    `Payment Method: ${receipt.payment.method.toUpperCase()}`,
    `Amount Paid: ${formatInr(receipt.payment.amount)}`,
    `Paid At: ${new Date(receipt.payment.created_at).toLocaleString()}`,
    "",
    "REGISTRATION DETAILS",
    `Registration ID: ${registration?.id ?? receipt.payment.registration_id}`,
    `Tournament: ${registration?.tournament_name ?? registration?.tournament_slug ?? "Tournament"}`,
    `Team Name: ${registration?.team_name ?? "Team"}`,
    `Team Code: ${registration?.team_code ?? "Generated"}`,
    `Captain: ${registration?.captain_name ?? "Captain"}`,
    `Sub-captain: ${registration?.sub_captain_name ?? "Sub-captain"}`,
    `City: ${registration?.city ?? "City"}`,
    `Category: ${registration?.category ?? "Category"}`,
    `Email: ${registration?.email ?? ""}`,
    `Phone: ${registration?.phone ?? ""}`,
    `Confirmation Code: ${registration?.confirmation_code ?? "Pending approval"}`,
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${receipt.payment.receipt_number || "smart-sportz-receipt"}.txt`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function PaymentReceiptPage() {
  const params = useParams();
  const [receipt, setReceipt] = useState<ReceiptResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!params.id) return;
    apiRequest<ReceiptResponse>(`/payments/${params.id}/receipt`)
      .then(setReceipt)
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load receipt"));
  }, [params.id]);

  const registration = receipt?.registration;
  const rows = useMemo(() => {
    if (!receipt) return [];
    return [
      ["Receipt number", receipt.payment.receipt_number],
      ["Payment ID", receipt.payment.id],
      ["Status", receipt.payment.status],
      ["Method", receipt.payment.method.toUpperCase()],
      ["Amount paid", formatInr(receipt.payment.amount)],
      ["Paid at", new Date(receipt.payment.created_at).toLocaleString()],
      ["Registration ID", registration?.id ?? receipt.payment.registration_id],
      ["Tournament", registration?.tournament_name ?? registration?.tournament_slug ?? "Tournament"],
      ["Team", registration?.team_name ?? "Team"],
      ["Team code", registration?.team_code ?? "Generated after payment"],
      ["Captain", registration?.captain_name ?? "Captain"],
      ["City", registration?.city ?? "City"],
    ];
  }, [receipt, registration]);

  return (
    <Page>
      <PageHero title="Payment Receipt" text="Official Smart Sportz local payment receipt for tournament registration." />
      {error && <div className="error-banner">{error}</div>}
      {!receipt && !error ? (
        <section className="panel"><SectionSkeleton rows={2} /></section>
      ) : receipt ? (
        <section className="receipt-card panel">
          <div className="receipt-header">
            <div>
              <p className="eyebrow">SmartSportz.in</p>
              <h2>{receipt.payment.receipt_number}</h2>
              <p>{registration?.team_name ?? "Registered team"} - {registration?.tournament_name ?? registration?.tournament_slug ?? "Tournament"}</p>
            </div>
            <span className="status emerald">{receipt.payment.status}</span>
          </div>
          <div className="receipt-total">
            <span>Total Paid</span>
            <strong>{formatInr(receipt.payment.amount)}</strong>
          </div>
          <div className="review-list receipt-list">
            {rows.map(([label, value]) => (
              <p key={label}><b>{label}</b><span>{value}</span></p>
            ))}
          </div>
          <div className="registration-actions compact-actions">
            <button className="btn btn-primary" type="button" onClick={() => downloadReceiptFile(receipt)}><Download size={16} />Download Receipt</button>
            <button className="btn btn-secondary" type="button" onClick={() => window.print()}><Printer size={16} />Print Receipt</button>
            <Link className="btn btn-secondary" to="/user/payments">Back to payments</Link>
          </div>
        </section>
      ) : null}
    </Page>
  );
}

export function UtilityDetailPage({ type }: { type: keyof typeof utilityDetails }) {
  const detail = utilityDetails[type];
  const body = (
    <>
      <InfoPanel title="Workflow Status" items={detail.panels} highlight />
      <InfoPanel title="Connected Records" items={["Tournament", "Team", "User", "Audit log"]} to="/admin/logs" />
      <InfoPanel title="Security Checks" items={["RBAC verified", "Sensitive data masked", "Encrypted references", "Immutable event tracking"]} />
      <InfoPanel title="Next Actions" items={["Review", "Approve", "Export", "Notify user"]} to="/admin/reports" />
    </>
  );

  if (type === "payment") {
    return <PaymentReceiptPage />;
  }

  return (
    <Page>
      <PortalShell title={detail.title} subtitle={detail.text} sidebar={sidebar} action={<Link className="btn btn-primary" to="/admin/dashboard">Dashboard</Link>}>
        <div className="detail-grid">{body}</div>
      </PortalShell>
    </Page>
  );
}
