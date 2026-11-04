// Prints the variables the app needs to reach the local Supabase that CI
// started, in the KEY=value format of $GITHUB_ENV. Local keys only.
import { execFileSync } from "node:child_process";

const output = execFileSync(
  "pnpm",
  ["exec", "supabase", "status", "-o", "env"],
  {
    encoding: "utf8",
  },
);
const status = Object.fromEntries(
  output
    .split("\n")
    .map((line) => /^([A-Z_]+)="?(.*?)"?$/.exec(line.trim()))
    .filter(Boolean)
    .map((match) => [match[1], match[2]]),
);
const pick = (...names) => names.map((name) => status[name]).find(Boolean);

const variables = {
  NEXT_PUBLIC_SUPABASE_URL: pick("API_URL"),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: pick("PUBLISHABLE_KEY", "ANON_KEY"),
  SUPABASE_SECRET_KEY: pick("SECRET_KEY", "SERVICE_ROLE_KEY"),
};
const missing = Object.keys(variables).filter((name) => !variables[name]);
if (missing.length > 0) {
  console.error(
    `Missing ${missing.join(", ")}. supabase status gave: ${Object.keys(status).join(", ")}`,
  );
  process.exit(1);
}
for (const [name, value] of Object.entries(variables)) {
  console.log(`${name}=${value}`);
}
