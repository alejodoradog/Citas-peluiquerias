// PostToolUse hook. Exit code 2 shows stderr to Claude; the edit already ran.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const PRETTIER_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".mts",
  ".js",
  ".mjs",
  ".cjs",
  ".json",
  ".css",
  ".yml",
  ".yaml",
]);
const ESLINT_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".mts",
  ".js",
  ".mjs",
  ".cjs",
]);

const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();

function isProjectFile(filePath) {
  const relative = path.relative(projectDir, filePath);
  return (
    relative !== "" &&
    !relative.startsWith("..") &&
    !path.isAbsolute(relative) &&
    !relative.split(path.sep).includes("node_modules")
  );
}

// Runs each tool through node, without a shell, so a file name is never parsed
// as part of a command.
function runTool(script, args) {
  return spawnSync(
    process.execPath,
    [path.join(projectDir, "node_modules", script), ...args],
    { cwd: projectDir, encoding: "utf8" },
  );
}

const { tool_input: input = {} } = JSON.parse(readFileSync(0, "utf8"));
const filePath = input.file_path ? path.resolve(input.file_path) : "";
const extension = path.extname(filePath);

if (
  !filePath ||
  !existsSync(filePath) ||
  !isProjectFile(filePath) ||
  !PRETTIER_EXTENSIONS.has(extension)
) {
  process.exit(0);
}

const problems = [];

const prettier = runTool("prettier/bin/prettier.cjs", [
  "--write",
  "--ignore-unknown",
  "--log-level",
  "warn",
  filePath,
]);
if (prettier.status !== 0) {
  problems.push(`Prettier:\n${prettier.stderr || prettier.stdout}`);
}

if (ESLINT_EXTENSIONS.has(extension)) {
  const eslint = runTool("eslint/bin/eslint.js", [
    "--fix",
    "--no-warn-ignored",
    filePath,
  ]);
  if (eslint.status !== 0) {
    problems.push(`ESLint:\n${eslint.stdout || eslint.stderr}`);
  }
}

if (problems.length > 0) {
  process.stderr.write(`${problems.join("\n")}\n`);
  process.exit(2);
}
