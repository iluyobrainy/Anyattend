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

  if (digitsOnly.length < 9 || digitsOnly.length > 12) {
    throw new Error("AnyDesk ID must be 9 to 12 digits.");
  }

  return {
    normalized: digitsOnly,
    display: formatAnyDeskId(digitsOnly)
  };
}

export function formatAnyDeskId(normalized: string): string {
  return normalized.replace(/(\d{3})(?=\d)/g, "$1 ").trim();
}
