export interface NormalizedAnyDeskId {
  normalized: string;
  display: string;
}

export function normalizeAnyDeskId(raw: string): NormalizedAnyDeskId {
  const cleaned = String(raw ?? "").trim();
  const digitsOnly = cleaned.replace(/\D+/g, "");

  if (!digitsOnly) {
    throw new Error("AnyDesk ID is required.");
  }

  if (!/^\d+$/.test(digitsOnly)) {
    throw new Error("AnyDesk ID must contain digits only.");
  }

  if (digitsOnly.length < 9 || digitsOnly.length > 10) {
    throw new Error("AnyDesk ID must be 9 or 10 digits.");
  }

  return {
    normalized: digitsOnly,
    display: formatAnyDeskId(digitsOnly)
  };
}

export function formatAnyDeskId(normalized: string): string {
  return normalized.replace(/\B(?=(\d{3})+(?!\d))/g, " ").trim();
}
