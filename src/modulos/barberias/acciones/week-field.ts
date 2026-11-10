// The week a screen sends as JSON in its hidden "shifts" field (D-55, D-58).
// Far above the 14 shifts a screen can send; longer is not parsed at all.
export const MAX_WEEK_LENGTH = 4_000;

export function readWeek(sent: FormDataEntryValue | null): unknown {
  if (typeof sent !== "string" || sent.length > MAX_WEEK_LENGTH) return null;
  try {
    return JSON.parse(sent);
  } catch {
    return null;
  }
}

// What the action echoes back to the screen: the week as sent, unless it is
// longer than any screen could send, so a forged request cannot make the
// response carry it back.
export function echoWeek(sent: FormDataEntryValue | null): string {
  return typeof sent === "string" && sent.length <= MAX_WEEK_LENGTH
    ? sent
    : "";
}
