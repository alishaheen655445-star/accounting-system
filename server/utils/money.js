// -----------------------------------------------------------------------------
//  money.js — precise money handling using INTEGER CENTS (no floats).
//
//  Why? JavaScript numbers are IEEE-754 doubles: 0.1 + 0.2 !== 0.3. For an
//  accounting system that is unacceptable (requirement 24). We therefore convert
//  every amount to whole cents (integers), do all arithmetic on integers, and
//  only format back to "123.45" strings when storing/returning.
// -----------------------------------------------------------------------------

/** "123.45" | 123.45 -> 12345 (integer cents). Rounds to nearest cent. */
const toCents = (value) => {
  if (value === null || value === undefined || value === '') return 0;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) throw new Error(`Invalid monetary value: ${value}`);
  return Math.round(n * 100);
};

/** 12345 -> "123.45" (exact string, built from integers, never via float math). */
const fromCents = (cents) => {
  const c = Math.round(cents);
  const sign = c < 0 ? '-' : '';
  const abs = Math.abs(c);
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, '0');
  return `${sign}${whole}.${frac}`;
};

/** Sum an array of integer cents. */
const sumCents = (arr) => arr.reduce((acc, x) => acc + x, 0);

module.exports = { toCents, fromCents, sumCents };
