// What a mail client would turn into a link: a scheme (also with a
// full-width colon), "www.", or a word ending in a common domain. "Cra. 15"
// or "J.R." are not links. The same rule as private.has_link (migration
// add_appointment_reminders, task 5.3): what reaches an email never carries
// a link.
const LINK =
  /([:：]\/\/|www\.|\b[a-z0-9-]+\.(com|co|net|org|io|me|ly|link|info|biz|xyz|app|site|online|store|shop|top|click|gg|to|cc|ws|tk|ru|cn)\b)/i;

export function hasLink(value: string): boolean {
  return LINK.test(value);
}
