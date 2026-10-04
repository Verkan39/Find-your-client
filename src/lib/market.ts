/**
 * Rough market scaling per country. `scale` converts US-market dollar figures into what
 * a comparable local business earns / pays (purchasing-power adjusted), and `fx` converts
 * USD into local currency. These are deliberately coarse estimates, not live rates.
 */
interface Market {
  currency: string;
  fx: number;
  scale: number;
}

const MARKETS: Record<string, Market> = {
  us: { currency: "USD", fx: 1, scale: 1 },
  ca: { currency: "CAD", fx: 1.37, scale: 0.85 },
  gb: { currency: "GBP", fx: 0.77, scale: 0.85 },
  ie: { currency: "EUR", fx: 0.9, scale: 0.85 },
  au: { currency: "AUD", fx: 1.5, scale: 0.9 },
  nz: { currency: "NZD", fx: 1.65, scale: 0.8 },
  de: { currency: "EUR", fx: 0.9, scale: 0.85 },
  fr: { currency: "EUR", fx: 0.9, scale: 0.8 },
  nl: { currency: "EUR", fx: 0.9, scale: 0.85 },
  es: { currency: "EUR", fx: 0.9, scale: 0.65 },
  it: { currency: "EUR", fx: 0.9, scale: 0.7 },
  pt: { currency: "EUR", fx: 0.9, scale: 0.55 },
  se: { currency: "SEK", fx: 10.5, scale: 0.85 },
  ch: { currency: "CHF", fx: 0.85, scale: 1.1 },
  pl: { currency: "PLN", fx: 3.9, scale: 0.45 },
  ae: { currency: "AED", fx: 3.67, scale: 0.9 },
  sa: { currency: "SAR", fx: 3.75, scale: 0.75 },
  sg: { currency: "SGD", fx: 1.33, scale: 0.95 },
  jp: { currency: "JPY", fx: 150, scale: 0.7 },
  kr: { currency: "KRW", fx: 1350, scale: 0.65 },
  in: { currency: "INR", fx: 84, scale: 0.16 },
  pk: { currency: "PKR", fx: 280, scale: 0.11 },
  bd: { currency: "BDT", fx: 120, scale: 0.11 },
  lk: { currency: "LKR", fx: 300, scale: 0.12 },
  np: { currency: "NPR", fx: 134, scale: 0.1 },
  id: { currency: "IDR", fx: 15800, scale: 0.18 },
  ph: { currency: "PHP", fx: 57, scale: 0.17 },
  vn: { currency: "VND", fx: 25000, scale: 0.15 },
  th: { currency: "THB", fx: 35, scale: 0.25 },
  my: { currency: "MYR", fx: 4.5, scale: 0.3 },
  ng: { currency: "NGN", fx: 1600, scale: 0.1 },
  ke: { currency: "KES", fx: 129, scale: 0.12 },
  za: { currency: "ZAR", fx: 18, scale: 0.3 },
  eg: { currency: "EGP", fx: 48, scale: 0.12 },
  br: { currency: "BRL", fx: 5.5, scale: 0.3 },
  mx: { currency: "MXN", fx: 19, scale: 0.32 },
  ar: { currency: "ARS", fx: 950, scale: 0.25 },
  co: { currency: "COP", fx: 4100, scale: 0.25 },
  tr: { currency: "TRY", fx: 34, scale: 0.3 },
};

const DEFAULT: Market = { currency: "USD", fx: 1, scale: 0.5 };

export function market(countryCode: string | null | undefined): Market {
  return (countryCode && MARKETS[countryCode.toLowerCase()]) || DEFAULT;
}

/** Convert a US-market USD amount into a local-currency amount for this country. */
export function localize(usd: number, countryCode: string | null | undefined): number {
  const m = market(countryCode);
  return roundNice(usd * m.scale * m.fx);
}

/** Round to 2 significant figures so estimates don't look falsely precise. */
export function roundNice(n: number): number {
  if (n <= 0) return 0;
  const mag = Math.pow(10, Math.floor(Math.log10(n)) - 1);
  return Math.round(n / mag) * mag;
}

export function formatMoney(n: number, currency: string, compact = true): string {
  try {
    return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
      style: "currency",
      currency,
      notation: compact ? "compact" : "standard",
      maximumFractionDigits: compact ? 1 : 0,
    }).format(n);
  } catch {
    return `${currency} ${Math.round(n).toLocaleString()}`;
  }
}
