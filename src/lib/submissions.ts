import type { Difficulty, Language, ValidationReport, Verdict } from "@/lib/validation-types";

import { createSubmissionFn, getSubmissionFn, listSubmissionsFn } from "./submissions.functions";

export interface SubmissionRow {
  id: string;
  employee_name: string;
  employee_code: string;
  department: string;
  language: Language;
  question: string;
  expected_output: string | null;
  code: string;
  verdict: Verdict;
  overall_score: number;
  logic_score: number;
  syntax_score: number;
  quality_score: number;
  efficiency_score: number;
  best_practices_score: number;
  output_match_score: number;
  readability_score: number;
  difficulty: Difficulty;
  difficulty_score: number;
  time_complexity: string;
  space_complexity: string;
  execution_time_ms: number;
  problem_type: string[];
  execution_output: string | null;
  execution_error: string | null;
  execution_status: "success" | "error";
  output_matched: boolean;
  output_match_reason: string | null;
  reviewer_notes: string | null;
  report: ValidationReport;
  created_at: string;
}

export async function fetchSubmissions(): Promise<SubmissionRow[]> {
  const rows = await listSubmissionsFn();
  return (rows ?? []) as unknown as SubmissionRow[];
}

export async function fetchSubmission(id: string): Promise<SubmissionRow | null> {
  const row = await getSubmissionFn({ data: { id } });
  return (row as unknown as SubmissionRow | null) ?? null;
}

export async function insertSubmission(payload: {
  employeeName: string;
  employeeCode: string;
  department: string;
  language: Language;
  question: string;
  expectedOutput?: string | undefined;
  code: string;
  report: ValidationReport;
}) {
  return createSubmissionFn({
    data: {
      employeeName: payload.employeeName,
      employeeCode: payload.employeeCode,
      department: payload.department,
      language: payload.language,
      question: payload.question,
      ...(payload.expectedOutput ? { expectedOutput: payload.expectedOutput } : {}),
      code: payload.code,
      report: payload.report as unknown as Record<string, unknown>,
    },
  });
}
