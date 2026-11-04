// Colombian mobiles have 10 digits and start with 3. They are stored in E.164
// (+573001234567), the format the database accepts.

const COUNTRY_CODE = "57";
const MOBILE = /^3\d{9}$/;
const SEPARATORS = /[\s().-]/g;

export function normalizeColombianMobile(input: string): string | null {
  let digits = input.trim().replace(SEPARATORS, "");

  if (digits.startsWith(`+${COUNTRY_CODE}`)) {
    digits = digits.slice(COUNTRY_CODE.length + 1);
  } else if (digits.length === 12 && digits.startsWith(COUNTRY_CODE)) {
    digits = digits.slice(COUNTRY_CODE.length);
  }

  return MOBILE.test(digits) ? `+${COUNTRY_CODE}${digits}` : null;
}
