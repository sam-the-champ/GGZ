/** Money helpers. All amounts are integer kobo (1 NGN = 100 kobo). */

export function formatNaira(kobo: number): string {
  const naira = kobo / 100;
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: Number.isInteger(naira) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(naira);
}

/**
 * Parses an admin-entered naira amount ("15000", "15,000.50") to integer kobo.
 * Returns null for anything that is not a positive amount with ≤ 2 decimals.
 */
export function nairaInputToKobo(input: string): number | null {
  const cleaned = input.replace(/[,\s₦]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, frac = ""] = cleaned.split(".");
  const kobo = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  if (!Number.isSafeInteger(kobo) || kobo <= 0) return null;
  return kobo;
}

export function koboToNairaInput(kobo: number | null | undefined): string {
  if (kobo == null) return "";
  const whole = Math.floor(kobo / 100);
  const frac = kobo % 100;
  return frac === 0 ? String(whole) : `${whole}.${String(frac).padStart(2, "0")}`;
}
