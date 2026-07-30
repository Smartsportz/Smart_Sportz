export type CompletedRegistrationRecord = {
  tournamentSlug: string;
  tournamentName: string;
  registrationId: string;
  confirmationCode: string;
  qrPayload: string;
  teamName: string;
  teamCode: string;
  captainName: string;
  subCaptainName: string;
  coachName: string;
  email: string;
  phone: string;
  city: string;
  category: string;
  members: string[];
  documents: Array<{ documentType: string; fileName: string; fileSize?: number; status: string }>;
  payment: { id: string; receiptNumber: string; amount: number; method: string; status: string; paidAt: string };
  completedAt: string;
};

const completedRegistrationsKey = "smart-sportz-completed-registrations";
const currentUserKey = "smart-sportz-user";

function currentUserEmail() {
  if (typeof localStorage === "undefined") return "";
  try {
    const raw = localStorage.getItem(currentUserKey);
    if (!raw) return "";
    const user = JSON.parse(raw) as { email?: string };
    return user.email?.toLowerCase() ?? "";
  } catch {
    return "";
  }
}

export function readCompletedRegistrations() {
  if (typeof localStorage === "undefined") return [] as CompletedRegistrationRecord[];
  try {
    const raw = localStorage.getItem(completedRegistrationsKey);
    const records = raw ? JSON.parse(raw) as CompletedRegistrationRecord[] : [];
    const email = currentUserEmail();
    if (!email) return [];
    return records.filter((item) => item.email.toLowerCase() === email);
  } catch {
    return [];
  }
}

export function getCompletedRegistration(tournamentSlug: string) {
  return readCompletedRegistrations().find((item) => item.tournamentSlug === tournamentSlug) ?? null;
}

export function saveCompletedRegistration(record: CompletedRegistrationRecord) {
  if (typeof localStorage === "undefined") return;
  const raw = localStorage.getItem(completedRegistrationsKey);
  const allRecords = raw ? JSON.parse(raw) as CompletedRegistrationRecord[] : [];
  const current = allRecords.filter((item) => !(item.tournamentSlug === record.tournamentSlug && item.email.toLowerCase() === record.email.toLowerCase()));
  localStorage.setItem(completedRegistrationsKey, JSON.stringify([record, ...current]));
}
