// Stop hook. Exit code 2 keeps Claude working, up to MAX_FAILED_ATTEMPTS in a
// row so a problem Claude cannot fix does not turn into an endless loop.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";

const MAX_FAILED_ATTEMPTS = 3;
const MAX_OUTPUT_CHARS = 4000;
const CHECKED_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".mts",
  ".mjs",
  ".json",
  ".css",
]);
const TESTABLE_EXTENSIONS = new Set([".ts", ".tsx", ".mts", ".mjs"]);

const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();

function gitFiles(args) {
  const result = spawnSync("git", [...args, "-z"], {
    cwd: projectDir,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(result.stderr);
  }
  return result.stdout.split("\0").filter(Boolean);
}

function getChangedFiles() {
  const files = [
    ...gitFiles(["diff", "--name-only", "HEAD"]),
    ...gitFiles(["ls-files", "--others", "--exclude-standard"]),
  ];
  return [...new Set(files)].filter(
    (file) =>
      CHECKED_EXTENSIONS.has(path.extname(file)) &&
      existsSync(path.join(projectDir, file)),
  );
}

function tail(result) {
  return `${result.stdout ?? ""}${result.stderr ?? ""}`.slice(
    -MAX_OUTPUT_CHARS,
  );
}

function runChecks(changedFiles) {
  const failures = [];

  // pnpm is a .cmd file on Windows, which needs a shell. The string is fixed.
  const typecheck = spawnSync("pnpm typecheck", {
    cwd: projectDir,
    encoding: "utf8",
    shell: true,
  });
  if (typecheck.status !== 0) {
    failures.push(`Typecheck:\n${tail(typecheck)}`);
  }

  const testable = changedFiles.filter((file) =>
    TESTABLE_EXTENSIONS.has(path.extname(file)),
  );
  if (testable.length > 0) {
    const tests = spawnSync(
      process.execPath,
      [
        path.join(projectDir, "node_modules/vitest/vitest.mjs"),
        "related",
        "--run",
        "--passWithNoTests",
        ...testable,
      ],
      { cwd: projectDir, encoding: "utf8" },
    );
    if (tests.status !== 0) {
      failures.push(`Pruebas:\n${tail(tests)}`);
    }
  }

  return failures;
}

const { session_id: sessionId = "default" } = JSON.parse(
  readFileSync(0, "utf8"),
);
const safeSessionId = String(sessionId).replace(/[^\w-]/g, "");
const attemptsFile = path.join(
  tmpdir(),
  `barberias-stop-checks-${safeSessionId}`,
);

const changedFiles = getChangedFiles();
const failures = changedFiles.length > 0 ? runChecks(changedFiles) : [];

if (failures.length === 0) {
  rmSync(attemptsFile, { force: true });
  process.exit(0);
}

const previous = existsSync(attemptsFile)
  ? Number(readFileSync(attemptsFile, "utf8")) || 0
  : 0;
const attempt = previous + 1;

if (attempt >= MAX_FAILED_ATTEMPTS) {
  rmSync(attemptsFile, { force: true });
  process.stdout.write(
    JSON.stringify({
      systemMessage: `Los chequeos siguen fallando tras ${attempt} intentos. Claude Code se detiene; hay que revisarlo.`,
    }),
  );
  process.exit(0);
}

writeFileSync(attemptsFile, String(attempt));
process.stderr.write(
  `Chequeos en rojo (intento ${attempt} de ${MAX_FAILED_ATTEMPTS}). Corrige la causa antes de terminar.\n\n${failures.join("\n\n")}\n`,
);
process.exit(2);
