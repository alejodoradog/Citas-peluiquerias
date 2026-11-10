// Colombian pesos are whole numbers (CLAUDE.md: "Dinero en pesos enteros").
// Prices are typed the way people write them: "25.000", "$ 25.000" or "25000".

const MAX_PRICE_COP = 9_999_999;

// Returns the integer value, or null for anything that is not a whole,
// non-negative amount up to the maximum (decimals with a comma, signs, text).
export function parsePesos(input: string): number | null {
  const cleaned = input.replace(/\$/g, "").replace(/\s/g, "");
  if (!/^\d{1,3}(\.\d{3})*$|^\d+$/.test(cleaned)) return null;
  const value = Number(cleaned.replace(/\./g, ""));
  if (!Number.isSafeInteger(value) || value > MAX_PRICE_COP) return null;
  return value;
}

const pesosFormatter = new Intl.NumberFormat("es-CO", {
  maximumFractionDigits: 0,
});

// "$25.000", as the design writes prices.
export function formatPesos(value: number): string {
  return `$${pesosFormatter.format(value)}`;
}

export { MAX_PRICE_COP };
