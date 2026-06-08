function escapeCsvCell(value) {
  const s = value === null || value === undefined ? "" : String(value);
  const needsQuotes = s.includes(",") || s.includes("\"") || s.includes("\n") || s.includes("\r");
  const escaped = s.replaceAll("\"", "\"\"");
  return needsQuotes ? `"${escaped}"` : escaped;
}

export function coordinatesToCsv(rows) {
  const header = ["punto", "norte", "este", "cota_z", "descripcion"];
  const lines = [header.join(",")];

  for (const row of rows) {
    lines.push(
      [
        escapeCsvCell(row.punto),
        escapeCsvCell(row.norte),
        escapeCsvCell(row.este),
        escapeCsvCell(row.cota_z),
        escapeCsvCell(row.descripcion),
      ].join(","),
    );
  }

  return lines.join("\n");
}
