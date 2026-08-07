import type { SubmissionRow } from "@/lib/submissions";

const HEADERS = [
  "Submitted at",
  "Employee name",
  "Employee ID",
  "Department",
  "Language",
  "Question",
  "Expected output",
  "Actual output",
  "Execution status",
  "Output match",
  "Validation status",
  "Overall score",
  "Difficulty",
  "Time complexity",
  "Space complexity",
] as const;

function rowValues(row: SubmissionRow) {
  const report = row.report as SubmissionRow["report"] | undefined;
  const status = row.execution_status ?? (row.execution_error ? "error" : "success");
  const matched = row.output_matched ?? report?.outputMatch?.matched ?? row.verdict === "accepted";
  return [
    new Date(row.created_at).toLocaleString(),
    row.employee_name,
    row.employee_code,
    row.department,
    row.language.toUpperCase(),
    row.question,
    row.expected_output ?? "",
    row.execution_output ?? "",
    status === "success" ? "Success" : "Error",
    matched ? "Matched" : "Not matched",
    row.verdict === "accepted" ? "Accepted" : "Rejected",
    row.overall_score,
    row.difficulty,
    row.time_complexity,
    row.space_complexity,
  ];
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function csvCell(value: string | number) {
  const text = String(value ?? "");
  return /["\n,]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function exportHistoryCsv(rows: SubmissionRow[]) {
  const lines = [HEADERS.join(",")];
  for (const row of rows) lines.push(rowValues(row).map(csvCell).join(","));
  download(
    new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" }),
    `submission-history-${new Date().toISOString().slice(0, 10)}.csv`,
  );
}

export async function exportHistoryExcel(rows: SubmissionRow[]) {
  const XLSX = await import("xlsx");
  const data = [HEADERS as unknown as (string | number)[], ...rows.map(rowValues)];
  const sheet = XLSX.utils.aoa_to_sheet(data);
  sheet["!cols"] = HEADERS.map((header) => ({ wch: Math.min(42, Math.max(14, header.length + 4)) }));
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Submissions");
  const buffer = XLSX.write(book, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  download(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `submission-history-${new Date().toISOString().slice(0, 10)}.xlsx`,
  );
}
