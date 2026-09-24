/**
 * Minimal RFC 4180 writer: quotes a field only when it contains a comma,
 * quote, or newline, and escapes embedded quotes by doubling them.
 *
 * @param {string[]} headers
 * @param {(string | number)[][]} rows
 * @returns {string}
 */
export function toCsv(headers, rows) {
  const lines = [headers.map(escapeField).join(",")];
  for (const row of rows) lines.push(row.map(escapeField).join(","));
  return lines.join("\n") + "\n";
}

/** @param {string | number} value */
function escapeField(value) {
  const str = String(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

/**
 * Parses a simple CSV (as produced by a Dune export) into row objects keyed
 * by the header row. Handles quoted fields with embedded commas/quotes;
 * does not handle embedded newlines inside quoted fields.
 *
 * @param {string} text
 * @returns {Record<string, string>[]}
 */
export function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((line) => line.length > 0);
  if (lines.length === 0) return [];

  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const fields = parseCsvLine(line);
    /** @type {Record<string, string>} */
    const row = {};
    headers.forEach((header, i) => {
      row[header] = fields[i] ?? "";
    });
    return row;
  });
}

/** @param {string} line */
function parseCsvLine(line) {
  const fields = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}
