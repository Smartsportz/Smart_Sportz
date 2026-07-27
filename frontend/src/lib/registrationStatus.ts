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

export function readCompletedRegistrations() {
  if (typeof localStorage === "undefined") return [] as CompletedRegistrationRecord[];
  try {
    const raw = localStorage.getItem(completedRegistrationsKey);
    return raw ? JSON.parse(raw) as CompletedRegistrationRecord[] : [];
  } catch {
    return [];
  }
}

export function getCompletedRegistration(tournamentSlug: string) {
  return readCompletedRegistrations().find((item) => item.tournamentSlug === tournamentSlug) ?? null;
}

export function saveCompletedRegistration(record: CompletedRegistrationRecord) {
  if (typeof localStorage === "undefined") return;
  const current = readCompletedRegistrations().filter((item) => item.tournamentSlug !== record.tournamentSlug);
  localStorage.setItem(completedRegistrationsKey, JSON.stringify([record, ...current]));
}
