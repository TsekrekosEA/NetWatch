export function countryCodeToFlag(countryCode?: string): string {
  if (!countryCode || countryCode.length !== 2) return "";
  const code = countryCode.toUpperCase();
  const first = code.codePointAt(0);
  const second = code.codePointAt(1);
  if (!first || !second) return "";
  return String.fromCodePoint(first + 127397) + String.fromCodePoint(second + 127397);
}
