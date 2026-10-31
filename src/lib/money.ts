// Monetary calculations use integer kopecks; the legacy account.balance field
// remains expressed in RUB for compatibility with existing dashboard profiles.
export function rublesInputToMinor(value: string): number | null {
  const input = value.trim();
  if (!/^\d{1,14}(?:[.,]\d{1,2})?$/.test(input)) return null;
  const [whole, fraction = ""] = input.replace(",", ".").split(".");
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(minor) && minor > 0 ? minor : null;
}

export function balanceToMinor(balance: number): number | null {
  if (!Number.isFinite(balance) || balance < 0) return null;
  const minor = Math.round(balance * 100);
  if (!Number.isSafeInteger(minor) || Math.abs(balance * 100 - minor) > 0.0001) return null;
  return minor;
}
