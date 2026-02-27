export function normalizeAnyDeskIdInput(raw: string): { normalized: string; display: string } {
  const digits = String(raw ?? "").replace(/\D+/g, "");
  return {
    normalized: digits,
    display: formatAnyDeskId(digits)
  };
}

export function formatAnyDeskId(value: string): string {
  return value.replace(/(\d{3})(?=\d)/g, "$1 ").trim();
}

export function validateAnyDeskId(raw: string): string | null {
  const { normalized } = normalizeAnyDeskIdInput(raw);
  if (!normalized) {
    return "AnyDesk ID is required.";
  }
  if (normalized.length < 9 || normalized.length > 12) {
    return "AnyDesk ID must be 9 to 12 digits (example: 806 716 144).";
  }
  return null;
}
