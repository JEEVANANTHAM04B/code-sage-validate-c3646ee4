import type { Language, ValidationReport } from "@/lib/validation-types";

export interface ReportExportMeta {
  employeeName: string;
  employeeCode: string;
  department: string;
  question: string;
  language: Language;
  submittedAt?: string | undefined;
  code?: string | undefined;
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function baseName(meta: ReportExportMeta) {
  const slug = meta.employeeCode.replace(/[^a-z0-9-_]+/gi, "-") || "submission";
  return `validation-report-${slug}-${new Date().toISOString().slice(0, 10)}`;
}

function statusLines(report: ValidationReport) {
  const executionStatus =
    report.executionStatus ?? (report.execution.error ? "error" : "success");
  const matched = report.outputMatch?.matched ?? report.verdict === "accepted";
  return {
    executionStatus,
    matched,
    expected: report.outputMatch?.expected ?? "(not provided)",
    actual: report.outputMatch?.actual || report.execution.output || "(no output)",
    reason: report.outputMatch?.reason ?? "",
  };
}

/** Ordered sections shared by the PDF and DOCX exports. */
function buildSections(report: ValidationReport, meta: ReportExportMeta) {
  const s = statusLines(report);
  const sections: { title: string; body: string[]; mono?: boolean }[] = [
    {
      title: "Submission details",
      body: [
        `Employee: ${meta.employeeName} (${meta.employeeCode})`,
        `Department: ${meta.department}`,
        `Language: ${meta.language.toUpperCase()}`,
        `Submitted: ${meta.submittedAt ? new Date(meta.submittedAt).toLocaleString() : new Date().toLocaleString()}`,
        `Question: ${meta.question}`,
      ],
    },
    {
      title: "Validation result",
      body: [
        `Validation status: ${report.verdict === "accepted" ? "ACCEPTED" : "REJECTED"}`,
        `Execution status: ${s.executionStatus === "success" ? "Success" : "Error"}`,
        `Output match: ${s.matched ? "Exact match" : "No match"}`,
        s.reason,
        `Note: AI scores and insights below are informational guidance only and do not affect acceptance.`,
      ].filter(Boolean),
    },
    { title: "Expected output", body: [s.expected], mono: true },
    { title: "Actual output", body: [s.actual], mono: true },
  ];

  if (report.execution.error) {
    sections.push({ title: "Execution error", body: [report.execution.error], mono: true });
  }

  sections.push(
    {
      title: "AI insights (informational)",
      body: [
        `Overall score: ${report.scores.overall}/100`,
        `Logic ${report.scores.logic} · Syntax ${report.scores.syntax} · Quality ${report.scores.quality}`,
        `Efficiency ${report.scores.efficiency} · Best practices ${report.scores.bestPractices} · Readability ${report.scores.readability}`,
        `Difficulty: ${report.difficulty.level} (${report.difficulty.score}/100)`,
        `Time complexity: ${report.complexity.time} — ${report.complexity.timeExplanation}`,
        `Space complexity: ${report.complexity.space} — ${report.complexity.spaceExplanation}`,
        `Summary: ${report.summary}`,
      ],
    },
    {
      title: "Issues found",
      body:
        report.issues.length === 0
          ? ["No static-analysis issues reported."]
          : report.issues.map(
              (issue) =>
                `[${issue.severity}] ${issue.title}${issue.line != null ? ` (line ${issue.line})` : ""}: ${issue.detail}${issue.fix ? ` Fix: ${issue.fix}` : ""}`,
            ),
    },
    {
      title: "What is wrong",
      body: report.whatIsWrong.length ? report.whatIsWrong : ["Nothing reported."],
    },
    { title: "How to fix", body: report.howToFix.length ? report.howToFix : ["Nothing reported."] },
    { title: "Better approach", body: [report.betterApproach || "Not provided."] },
    {
      title: "Learning feedback",
      body: [
        `Concepts: ${report.learning.concepts.join(", ") || "—"}`,
        `Interview tips: ${report.learning.interviewTips.join(" | ") || "—"}`,
        `Common mistakes: ${report.learning.commonMistakes.join(" | ") || "—"}`,
        `Best practices: ${report.learning.bestPractices.join(" | ") || "—"}`,
      ],
    },
  );

  if (meta.code) sections.push({ title: "Submitted code", body: [meta.code], mono: true });
  if (report.suggestions.optimized) {
    sections.push({ title: "Optimized solution", body: [report.suggestions.optimized], mono: true });
  }
  if (report.industryStandardSolution) {
    sections.push({
      title: "Industry standard solution",
      body: [report.industryStandardSolution],
      mono: true,
    });
  }

  return sections;
}

export async function exportReportPdf(report: ValidationReport, meta: ReportExportMeta) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 48;
  const width = doc.internal.pageSize.getWidth() - margin * 2;
  const bottom = doc.internal.pageSize.getHeight() - margin;
  let y = margin;

  const ensure = (needed: number) => {
    if (y + needed > bottom) {
      doc.addPage();
      y = margin;
    }
  };

  const write = (text: string, size: number, style: "normal" | "bold", mono = false) => {
    doc.setFont(mono ? "courier" : "helvetica", style);
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text, width) as string[];
    for (const line of lines) {
      ensure(size + 4);
      doc.text(line, margin, y);
      y += size + 4;
    }
  };

  write("Smart Code Validator — Validation Report", 18, "bold");
  y += 6;

  for (const section of buildSections(report, meta)) {
    y += 10;
    ensure(30);
    write(section.title, 13, "bold");
    y += 2;
    for (const line of section.body) write(line, section.mono ? 9 : 10.5, "normal", section.mono);
  }

  download(doc.output("blob"), `${baseName(meta)}.pdf`);
}

export async function exportReportDocx(report: ValidationReport, meta: ReportExportMeta) {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import("docx");

  const children: InstanceType<typeof Paragraph>[] = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: "Smart Code Validator — Validation Report", bold: true })],
    }),
  ];

  for (const section of buildSections(report, meta)) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 240, after: 120 },
        children: [new TextRun({ text: section.title, bold: true })],
      }),
    );
    for (const line of section.body) {
      for (const part of String(line).split("\n")) {
        children.push(
          new Paragraph({
            spacing: { after: 60 },
            children: [
              new TextRun({
                text: part,
                font: section.mono ? "Courier New" : "Arial",
                size: section.mono ? 18 : 22,
              }),
            ],
          }),
        );
      }
    }
  }

  const doc = new Document({
    styles: { default: { document: { run: { font: "Arial", size: 22 } } } },
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  download(blob, `${baseName(meta)}.docx`);
}
