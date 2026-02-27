export function normalizeAnyDeskIdInput(raw: string): { normalized: string; display: string } {
  const digits = String(raw ?? "").replace(/\D+/g, "");
  return {
    normalized: digits,
    display: formatAnyDeskId(digits)
  };
}

export function formatAnyDeskId(value: string): string {
  return value.replace(/\B(?=(\d{3})+(?!\d))/g, " ").trim();
}

export function validateAnyDeskId(raw: string): string | null {
  const { normalized } = normalizeAnyDeskIdInput(raw);
  if (!normalized) {
    return "AnyDesk ID is required.";
  }
  if (normalized.length < 9 || normalized.length > 10) {
    return "AnyDesk ID must be 9 or 10 digits (example: 806 716 144 or 1 930 205 528).";
  }
  return null;
}
