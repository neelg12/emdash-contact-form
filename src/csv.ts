import type { ContactFormSubmission } from "./types.js";

// Cells beginning with `=`, `+`, `-`, or `@` are interpreted as formulas by
// Excel / Sheets / LibreOffice. A submission like `=cmd|'/c calc'!A1` becomes
// remote code execution when an admin opens the export. Prefix a single quote
// to force the cell to be treated as text.
function neutralizeFormula(str: string): string {
  if (str.length === 0) return str;
  const first = str.charAt(0);
  if (first === "=" || first === "+" || first === "-" || first === "@") {
    return `'${str}`;
  }
  return str;
}

function csvCell(value: unknown): string {
  const raw = value === null || value === undefined ? "" : String(value);
  const str = neutralizeFormula(raw);
  // Escape: wrap in quotes if contains comma, newline, quote, or leading single
  // quote (we just added). Double internal quotes.
  if (str.includes(",") || str.includes("\n") || str.includes('"') || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function csvRow(cells: unknown[]): string {
  return cells.map(csvCell).join(",");
}

export function submissionsToCSV(
  submissions: Array<{ id: string; data: ContactFormSubmission }>,
): string {
  if (submissions.length === 0) return "No submissions found.\n";

  // Collect all unique field keys across all submissions for dynamic columns.
  const fieldKeys = new Set<string>();
  for (const { data } of submissions) {
    for (const key of Object.keys(data.fields)) {
      fieldKeys.add(key);
    }
  }

  const dynamicKeys = [...fieldKeys];

  const headers = [
    "id",
    "status",
    "submittedAt",
    "formId",
    "formTitle",
    "pageSlug",
    ...dynamicKeys,
    "ip",
    "userAgent",
    "referrer",
  ];

  const rows = [csvRow(headers)];

  for (const { id, data } of submissions) {
    const row = [
      id,
      data.status,
      data.submittedAt,
      data.formId,
      data.formTitle ?? "",
      data.pageSlug ?? "",
      ...dynamicKeys.map((k) => data.fields[k] ?? ""),
      data.meta.ip ?? "",
      data.meta.userAgent ?? "",
      data.meta.referrer ?? "",
    ];
    rows.push(csvRow(row));
  }

  return rows.join("\r\n") + "\r\n";
}
