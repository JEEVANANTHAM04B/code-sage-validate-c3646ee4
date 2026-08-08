import { z } from "zod";

export const executionResultSchema = z.object({
  status: z.enum(["success", "error"]),
  output: z.string().max(20000),
  error: z.string().max(20000).nullable(),
  timeMs: z.number().nonnegative(),
  note: z.string().max(500),
});

export const validationInputSchema = z.object({
  question: z.string().trim().min(10).max(4000),
  expectedOutput: z.string().trim().max(4000).optional(),
  code: z.string().trim().min(1).max(20000),
  language: z.enum(["python", "sql"]),
  employeeName: z.string().trim().min(2).max(80),
  employeeCode: z.string().trim().min(1).max(40),
  department: z.string().trim().min(2).max(60),
  execution: executionResultSchema.optional(),
});


export type ValidationInputPayload = z.infer<typeof validationInputSchema>;
