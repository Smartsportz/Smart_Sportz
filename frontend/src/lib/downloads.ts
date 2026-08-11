import { API_BASE_URL } from "./api";

function filenameFromDisposition(header: string | null, fallback: string) {
  const match = header?.match(/filename="?([^"]+)"?/i);
  return match?.[1] || fallback;
}

export async function downloadRegistrationPassPdf(registrationId: string, token?: string | null) {
  const response = await fetch(`${API_BASE_URL}/registrations/${registrationId}/pass.pdf`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!response.ok) {
    throw new Error("Unable to download registration PDF.");
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filenameFromDisposition(response.headers.get("Content-Disposition"), `smart-sportz-registration-pass-${registrationId}.pdf`);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
