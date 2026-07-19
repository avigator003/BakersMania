export type XlsxCellValue = string | number | null | undefined;

export type XlsxCell = {
  value: XlsxCellValue;
  style?: "default" | "header" | "metaLabel" | "metaValue" | "name" | "summary" | "amount";
  colSpan?: number;
};

export type XlsxRow = {
  cells: XlsxCell[];
  height?: number;
};

export type XlsxColumn = {
  width: number;
};

const textEncoder = new TextEncoder();
const crcTable = new Uint32Array(256);

for (let i = 0; i < 256; i += 1) {
  let crc = i;
  for (let j = 0; j < 8; j += 1) {
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  crcTable[i] = crc >>> 0;
}

function escapeXml(value: XlsxCellValue) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeUint16(output: number[], value: number) {
  output.push(value & 0xff, (value >>> 8) & 0xff);
}

function writeUint32(output: number[], value: number) {
  output.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
}

function columnName(index: number) {
  let value = index + 1;
  let name = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    value = Math.floor((value - 1) / 26);
  }
  return name;
}

function styleId(style: XlsxCell["style"]) {
  switch (style) {
    case "header":
      return 1;
    case "metaLabel":
      return 2;
    case "name":
      return 3;
    case "summary":
      return 4;
    case "amount":
      return 5;
    case "metaValue":
    case "default":
    default:
      return 0;
  }
}

function worksheetXml(rows: XlsxRow[], columns: XlsxColumn[]) {
  const maxColumns = Math.max(columns.length, 1);
  const dimensionRef = `A1:${columnName(maxColumns - 1)}${Math.max(rows.length, 1)}`;
  const colsXml = Array.from({ length: maxColumns }, (_, index) => {
    const width = columns[index]?.width ?? 12;
    return `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`;
  }).join("");

  const merges: string[] = [];
  const rowsXml = rows.map((row, rowIndex) => {
    const rowNumber = rowIndex + 1;
    const height = row.height ?? 48;
    let cellIndex = 0;
    const cellsXml = row.cells.map((cell) => {
      if (cellIndex >= maxColumns) return "";
      const ref = `${columnName(cellIndex)}${rowNumber}`;
      const style = styleId(cell.style);
      const colSpan = Math.min(Math.max(1, cell.colSpan || 1), maxColumns - cellIndex);
      if (colSpan > 1) {
        merges.push(`${ref}:${columnName(cellIndex + colSpan - 1)}${rowNumber}`);
      }
      cellIndex += colSpan;
      if (cell.value === null || cell.value === undefined || cell.value === "") {
        return `<c r="${ref}" s="${style}"/>`;
      }
      if (typeof cell.value === "number" && Number.isFinite(cell.value)) {
        return `<c r="${ref}" s="${style}"><v>${cell.value}</v></c>`;
      }
      return `<c r="${ref}" s="${style}" t="inlineStr"><is><t>${escapeXml(cell.value)}</t></is></c>`;
    }).join("");
    return `<row r="${rowNumber}" ht="${height}" customHeight="1">${cellsXml}</row>`;
  }).join("");

  const mergeXml = merges.length
    ? `<mergeCells count="${merges.length}">${merges.map((ref) => `<mergeCell ref="${ref}"/>`).join("")}</mergeCells>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <dimension ref="${dimensionRef}"/>
  <sheetViews><sheetView workbookViewId="0"/></sheetViews>
  <sheetFormatPr defaultRowHeight="48"/>
  <cols>${colsXml}</cols>
  <sheetData>${rowsXml}</sheetData>
  ${mergeXml}
</worksheet>`;
}

function stylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font><sz val="10"/><name val="Arial"/></font>
    <font><b/><sz val="10"/><name val="Arial"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFE7F4F0"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="1"><border><left style="thin"/><right style="thin"/><top style="thin"/><bottom style="thin"/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="6">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyBorder="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyBorder="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyBorder="1"><alignment horizontal="right" vertical="center"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
}

function contentTypesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;
}

const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="Truck Loading" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;

const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

function createZip(entries: Array<{ path: string; content: string }>) {
  const output: number[] = [];
  const centralDirectory: number[] = [];

  entries.forEach((entry) => {
    const nameBytes = textEncoder.encode(entry.path);
    const contentBytes = textEncoder.encode(entry.content);
    const crc = crc32(contentBytes);
    const localHeaderOffset = output.length;

    writeUint32(output, 0x04034b50);
    writeUint16(output, 20);
    writeUint16(output, 0);
    writeUint16(output, 0);
    writeUint16(output, 0);
    writeUint16(output, 0);
    writeUint32(output, crc);
    writeUint32(output, contentBytes.length);
    writeUint32(output, contentBytes.length);
    writeUint16(output, nameBytes.length);
    writeUint16(output, 0);
    output.push(...nameBytes, ...contentBytes);

    writeUint32(centralDirectory, 0x02014b50);
    writeUint16(centralDirectory, 20);
    writeUint16(centralDirectory, 20);
    writeUint16(centralDirectory, 0);
    writeUint16(centralDirectory, 0);
    writeUint16(centralDirectory, 0);
    writeUint16(centralDirectory, 0);
    writeUint32(centralDirectory, crc);
    writeUint32(centralDirectory, contentBytes.length);
    writeUint32(centralDirectory, contentBytes.length);
    writeUint16(centralDirectory, nameBytes.length);
    writeUint16(centralDirectory, 0);
    writeUint16(centralDirectory, 0);
    writeUint16(centralDirectory, 0);
    writeUint16(centralDirectory, 0);
    writeUint32(centralDirectory, 0);
    writeUint32(centralDirectory, localHeaderOffset);
    centralDirectory.push(...nameBytes);
  });

  const centralDirectoryOffset = output.length;
  output.push(...centralDirectory);

  writeUint32(output, 0x06054b50);
  writeUint16(output, 0);
  writeUint16(output, 0);
  writeUint16(output, entries.length);
  writeUint16(output, entries.length);
  writeUint32(output, centralDirectory.length);
  writeUint32(output, centralDirectoryOffset);
  writeUint16(output, 0);

  return new Uint8Array(output);
}

export function createXlsxBlob(rows: XlsxRow[], columns: XlsxColumn[]) {
  return new Blob([
    createZip([
      { path: "[Content_Types].xml", content: contentTypesXml() },
      { path: "_rels/.rels", content: rootRelsXml },
      { path: "xl/workbook.xml", content: workbookXml },
      { path: "xl/_rels/workbook.xml.rels", content: workbookRelsXml },
      { path: "xl/styles.xml", content: stylesXml() },
      { path: "xl/worksheets/sheet1.xml", content: worksheetXml(rows, columns) }
    ])
  ], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

export function downloadXlsx(filename: string, rows: XlsxRow[], columns: XlsxColumn[]) {
  const url = URL.createObjectURL(createXlsxBlob(rows, columns));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
