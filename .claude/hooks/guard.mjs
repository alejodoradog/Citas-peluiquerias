// PreToolUse guard. Exit code 2 blocks the tool call; any other failure would
// let it through, so every unexpected error below also exits with 2.
import { readFileSync } from "node:fs";
import process from "node:process";

const ALLOWED_ENV_FILE = ".env.example";

const FILE_TOOLS = new Set([
  "Read",
  "Edit",
  "Write",
  "MultiEdit",
  "NotebookEdit",
]);
const SEARCH_TOOLS = new Set(["Grep", "Glob", "LS"]);

// Matches .env, .env.local and globs like .env*, but not process.env or
// import.meta.env, because a word character comes right before their dot.
const ENV_REFERENCE = /(?<![\w.$-])\.env(?!\.example(?![\w.-]))[\w.*?-]*/;

const PRODUCTION_COMMANDS = [
  /\bsupabase\s+link\b/,
  /\bsupabase\s+db\s+push\b/,
  /--linked\b/,
  /--project-ref\b/,
  /--db-url\b/,
  /\bvercel\b[^\n;|&]*\s--prod\b/,
];

function block(reason) {
  process.stderr.write(`${reason}\n`);
  process.exit(2);
}

function isProtectedEnvFile(filePath) {
  const name = filePath.split(/[\\/]/).pop() ?? "";
  return name.startsWith(".env") && name !== ALLOWED_ENV_FILE;
}

function checkFileTool(input) {
  const filePath = input.file_path ?? input.notebook_path ?? "";
  if (isProtectedEnvFile(filePath)) {
    block(`Bloqueado: el proyecto prohíbe tocar ${filePath}.`);
  }
}

function checkSearchTool(toolName, input) {
  // Glob's pattern selects files; Grep's pattern is only text to look for.
  const targets = [
    input.path,
    input.glob,
    toolName === "Glob" ? input.pattern : undefined,
  ];
  for (const target of targets) {
    if (typeof target === "string" && ENV_REFERENCE.test(target)) {
      block(`Bloqueado: la búsqueda apunta a archivos .env (${target}).`);
    }
  }
}

function checkCommand(command) {
  if (ENV_REFERENCE.test(command)) {
    block("Bloqueado: el comando menciona un archivo .env protegido.");
  }
  for (const pattern of PRODUCTION_COMMANDS) {
    if (pattern.test(command)) {
      block(
        `Bloqueado: comando que puede apuntar a un proyecto remoto (${pattern.source}). Debe hacerlo el dueño del proyecto.`,
      );
    }
  }
}

try {
  const { tool_name: toolName, tool_input: input = {} } = JSON.parse(
    readFileSync(0, "utf8"),
  );

  if (FILE_TOOLS.has(toolName)) {
    checkFileTool(input);
  } else if (SEARCH_TOOLS.has(toolName)) {
    checkSearchTool(toolName, input);
  } else if (typeof input.command === "string") {
    checkCommand(input.command);
  }
} catch (error) {
  block(`Bloqueado: guard.mjs no pudo evaluar la acción (${error.message}).`);
}
