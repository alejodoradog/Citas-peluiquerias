// The week a screen sends as JSON in its hidden "shifts" field (D-55, D-58).
// Far above the 14 shifts a screen can send; longer is not parsed at all.
const MAX_WEEK_LENGTH = 4_000;

export function readWeek(sent: FormDataEntryValue | null): unknown {
  if (typeof sent !== "string" || sent.length > MAX_WEEK_LENGTH) return null;
  try {
    return JSON.parse(sent);
  } catch {
    return null;
  }
}
