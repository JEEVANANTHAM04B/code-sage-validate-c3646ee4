import type { Language } from "./validation-types";

/** Real execution result captured from the sandboxed runtime. */
export interface ExecutionResult {
  status: "success" | "error";
  output: string;
  error: string | null;
  timeMs: number;
  note: string;
}

const PYODIDE_VERSION = "314.0.3";
const PYODIDE_INDEX = `https://cdn.jsdelivr.net/npm/pyodide@${PYODIDE_VERSION}/`;
const SQLJS_WASM = "https://cdn.jsdelivr.net/npm/sql.js@1.14.1/dist/";

const clean = (value: string) => value.replace(/\r\n?/g, "\n").replace(/\s+$/, "");

type PyodideApi = {
  setStdout: (options: { batched: (line: string) => void }) => void;
  setStderr: (options: { batched: (line: string) => void }) => void;
  runPythonAsync: (code: string) => Promise<unknown>;
};

let pyodidePromise: Promise<PyodideApi> | null = null;

async function getPyodide() {
  if (!pyodidePromise) {
    pyodidePromise = (async () => {
      const { loadPyodide } = await import("pyodide");
      return (await loadPyodide({ indexURL: PYODIDE_INDEX })) as unknown as PyodideApi;
    })().catch((error) => {
      pyodidePromise = null;
      throw error;
    });
  }
  return pyodidePromise;
}

async function runPython(code: string): Promise<ExecutionResult> {
  const startedAt = performance.now();
  const stdout: string[] = [];
  const stderr: string[] = [];

  try {
    const pyodide = await getPyodide();
    pyodide.setStdout({ batched: (line) => stdout.push(line) });
    pyodide.setStderr({ batched: (line) => stderr.push(line) });

    try {
      await pyodide.runPythonAsync(code);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        status: "error",
        output: clean(stdout.join("\n")),
        error: clean(message),
        timeMs: Math.round(performance.now() - startedAt),
        note: "Python 3 sandbox (WebAssembly) — runtime error.",
      };
    }

    const out = clean(stdout.join("\n"));
    const err = clean(stderr.join("\n"));

    return {
      status: "success",
      output: out,
      error: err || null,
      timeMs: Math.round(performance.now() - startedAt),
      note: out
        ? "Executed in the Python 3 sandbox (WebAssembly)."
        : "Program executed successfully but produced no output.",
    };
  } catch (error) {
    return {
      status: "error",
      output: "",
      error: error instanceof Error ? error.message : "Python runtime could not be loaded.",
      timeMs: Math.round(performance.now() - startedAt),
      note: "The Python sandbox could not be started.",
    };
  }
}

function formatSqlTable(columns: string[], values: unknown[][]) {
  const header = columns.join(" | ");
  const rows = values.map((row) =>
    row.map((cell) => (cell === null || cell === undefined ? "NULL" : String(cell))).join(" | "),
  );
  return [header, "-".repeat(Math.max(header.length, 3)), ...rows].join("\n");
}

async function runSql(code: string): Promise<ExecutionResult> {
  const startedAt = performance.now();
  try {
    const initSqlJs = (await import("sql.js")).default;
    const SQL = await initSqlJs({ locateFile: (file: string) => `${SQLJS_WASM}${file}` });
    const db = new SQL.Database();
    try {
      const results = db.exec(code);
      const output = results
        .map((result) => formatSqlTable(result.columns, result.values as unknown[][]))
        .join("\n\n");
      return {
        status: "success",
        output: clean(output),
        error: null,
        timeMs: Math.round(performance.now() - startedAt),
        note: output
          ? "Executed in the SQLite sandbox (WebAssembly)."
          : "Statements executed successfully but produced no result rows.",
      };
    } catch (error) {
      return {
        status: "error",
        output: "",
        error: clean(error instanceof Error ? error.message : String(error)),
        timeMs: Math.round(performance.now() - startedAt),
        note: "SQLite sandbox — SQL error.",
      };
    } finally {
      db.close();
    }
  } catch (error) {
    return {
      status: "error",
      output: "",
      error: error instanceof Error ? error.message : "SQL runtime could not be loaded.",
      timeMs: Math.round(performance.now() - startedAt),
      note: "The SQLite sandbox could not be started.",
    };
  }
}

/** Executes the submission for real and captures stdout/stderr. Never throws. */
export async function executeSubmission(language: Language, code: string): Promise<ExecutionResult> {
  return language === "python" ? runPython(code) : runSql(code);
}
