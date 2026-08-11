// Locale-aware number/currency formatting (docs/09 §9.5). All currency and
// percentage formatting is driven by the active JurisdictionPack's `locale`
// and `currency` rather than being hard-coded to a single locale.

const DEFAULT_LOCALE = "en-IN";

export function formatMoney(
  value: number | null | undefined,
  currency: string,
  locale = DEFAULT_LOCALE,
): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatMoneyCompact(
  value: number | null | undefined,
  currency: string,
  locale = DEFAULT_LOCALE,
): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
    notation: "compact",
  }).format(value);
}

export function formatPercent(value: number, digits = 1): string {
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatSignedPercent(value: number, digits = 1): string {
  const pct = value * 100;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(digits)}%`;
}

export function formatNumber(
  value: number | null | undefined,
  locale = DEFAULT_LOCALE,
  digits = 0,
): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: digits,
  }).format(value);
}
