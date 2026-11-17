// Addresses that moved, and where they go now (src/proxy.ts sends a 308):
// - "Profesionales" lived at /panel/barberos until task 7.1b;
// - "Link privado" of a professional (/panel/profesionales/<id>/link, task
//   2.3) went with task 7.6c: its old address opens the professional's card,
//   where the owner invites them now.
// Null when the address did not move.
const OLD_TEAM = "/panel/barberos";
const TEAM = "/panel/profesionales";
const OLD_LINK = /^\/panel\/(?:profesionales|barberos)\/([^/]+)\/link\/?$/;

export function movedAddress(pathname: string): string | null {
  const link = OLD_LINK.exec(pathname);
  if (link) return `${TEAM}/${link[1]}`;
  if (pathname === OLD_TEAM || pathname.startsWith(`${OLD_TEAM}/`)) {
    return TEAM + pathname.slice(OLD_TEAM.length);
  }
  return null;
}
