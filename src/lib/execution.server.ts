import type { Language } from "./validation-types";

const PISTON_URL = "https://emkc.org/api/v2/piston/execute";

const RUNTIMES: Record<Language, { language: string; version: string; file: string }> = {
  python: { language: "python", version: "3.10.0", file: "main.py" },
  sql: { language: "sqlite3", version: "3.36.0", file: "main.sql" },
};

export interface ExecutionResult {
  status: "success" | "error";
  /** Captured stdout (already trimmed of trailing newlines). */
  output: string;
  /** Captured stderr / compile error, or null when the run succeeded. */
  error: string | null;
  timeMs: number;
  note: string;
}

interface PistonStage {
  stdout?: string;
  stderr?: string;
  output?: string;
  code?: number | null;
  signal?: string | null;
}

const clean = (value: string | undefined) => (value ?? "").replace(/\r\n?/g, "\n").replace(/\s+$/, "");

/**
 * Runs the submitted code in an isolated sandbox and captures real stdout/stderr.
 * Never throws: transport failures come back as an execution error so the UI can show them.
 */
export async function executeCode(language: Language, code: string): Promise<ExecutionResult> {
  const runtime = RUNTIMES[language];
  const startedAt = Date.now();

  try {
    const response = await fetch(PISTON_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        language: runtime.language,
        version: runtime.version,
        files: [{ name: runtime.file, content: code }],
        stdin: "",
        compile_timeout: 10_000,
        run_timeout: 15_000,
      }),
    });

    const timeMs = Date.now() - startedAt;

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return {
        status: "error",
        output: "",
        error: `Execution service unavailable (HTTP ${response.status}). ${body.slice(0, 300)}`.trim(),
        timeMs,
        note: "The sandbox could not run the code.",
      };
    }

    const payload = (await response.json()) as {
      run?: PistonStage;
      compile?: PistonStage;
      message?: string;
    };

    if (payload.message && !payload.run) {
      return {
        status: "error",
        output: "",
        error: payload.message,
        timeMs,
        note: "The sandbox rejected the request.",
      };
    }

    const compileError = clean(payload.compile?.stderr);
    if (compileError) {
      return {
        status: "error",
        output: clean(payload.compile?.stdout),
        error: compileError,
        timeMs,
        note: `Compilation failed (${runtime.language} ${runtime.version}).`,
      };
    }

    const stdout = clean(payload.run?.stdout);
    const stderr = clean(payload.run?.stderr);
    const exitCode = payload.run?.code ?? 0;
    const failed = Boolean(stderr) || exitCode !== 0 || Boolean(payload.run?.signal);

    if (failed) {
      return {
        status: "error",
        output: stdout,
        error:
          stderr ||
          (payload.run?.signal
            ? `Process terminated by signal ${payload.run.signal} (possible timeout or memory limit).`
            : `Process exited with a non-zero status code (${exitCode}).`),
        timeMs,
        note: `Executed with ${runtime.language} ${runtime.version}.`,
      };
    }

    return {
      status: "success",
      output: stdout,
      error: null,
      timeMs,
      note: stdout
        ? `Executed with ${runtime.language} ${runtime.version}.`
        : `Program executed successfully but produced no output (${runtime.language} ${runtime.version}).`,
    };
  } catch (error) {
    console.error("[execution] sandbox call failed", error);
    return {
      status: "error",
      output: "",
      error: error instanceof Error ? error.message : "Unknown execution failure.",
      timeMs: Date.now() - startedAt,
      note: "The sandbox could not be reached.",
    };
  }
}
