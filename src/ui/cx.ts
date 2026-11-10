// Joins class names, skipping the empty ones. A className passed from outside
// only places a component (margins, width), never restyles it, so two classes
// for the same property never meet and no merge is needed.
export function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}
