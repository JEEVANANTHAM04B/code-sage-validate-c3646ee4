import { z } from "zod";

import type { ValidationReport } from "@/lib/validation-types";
import { DEPARTMENTS } from "@/lib/validation-types";
import { validationInputSchema } from "@/lib/validation-schema";

export const submissionInsertSchema = validationInputSchema
  .extend({
    department: z.enum(DEPARTMENTS),
    report: z.record(z.string(), z.unknown()),
  })
  .strict();

export type SubmissionInsertPayload = z.infer<typeof submissionInsertSchema>;

export const submissionIdSchema = z.object({ id: z.string().uuid() });

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function listSubmissions() {
  const supabase = await admin();
  const { data, error } = await supabase
    .from("submissions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) {
    console.error("[submissions] list failed", error);
    throw new Error("Unable to load submissions");
  }
  return data ?? [];
}

export async function getSubmission(id: string) {
  const supabase = await admin();
  const { data, error } = await supabase.from("submissions").select("*").eq("id", id).maybeSingle();
  if (error) {
    console.error("[submissions] get failed", error);
    throw new Error("Unable to load submission");
  }
  return data ?? null;
}

export async function createSubmission(payload: SubmissionInsertPayload) {
  const supabase = await admin();
  const report = payload.report as unknown as ValidationReport;
  const { data, error } = await supabase
    .from("submissions")
    .insert({
      employee_name: payload.employeeName,
      employee_code: payload.employeeCode,
      department: payload.department,
      language: payload.language,
      question: payload.question,
      expected_output: payload.expectedOutput ?? null,
      code: payload.code,
      verdict: report.verdict,
      overall_score: report.scores.overall,
      logic_score: report.scores.logic,
      syntax_score: report.scores.syntax,
      quality_score: report.scores.quality,
      efficiency_score: report.scores.efficiency,
      best_practices_score: report.scores.bestPractices,
      output_match_score: report.scores.outputMatch,
      readability_score: report.scores.readability,
      difficulty: report.difficulty.level,
      difficulty_score: report.difficulty.score,
      time_complexity: report.complexity.time,
      space_complexity: report.complexity.space,
      execution_time_ms: report.execution.estimatedTimeMs,
      problem_type: report.problemType,
      execution_output: report.execution.output,
      execution_error: report.execution.error,
      execution_status: report.executionStatus,
      output_matched: report.outputMatch.matched,
      output_match_reason: report.outputMatch.reason,
      report: JSON.parse(JSON.stringify(report)),
    })
    .select("id")
    .single();
  if (error) {
    console.error("[submissions] insert failed", error);
    throw new Error("Unable to save submission");
  }
  return data as { id: string };
}
