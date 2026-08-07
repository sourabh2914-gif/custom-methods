import type { WalnutContext } from './walnut';
import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import * as https from 'https';

interface Row {
  dateTime: string;
  vital: string;
  recordedBy: string;
  severity: string;
  status: string;
  value: string;
  guidelines: string;
}

interface TextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** @walnut_method
 * name: Extract PDF Report Data
 * description: Extract header and table data from PDF report at ${pdfSource} and store fields into runtime variables
 * actionType: custom_extract_pdf_report_data
 * context: shared
 * needsLocator: false
 * category: Data Processing
 */
export async function extractPdfReportData(ctx: WalnutContext) {
  const allArgs = ((ctx as any).args as string[]) ?? [];
  if (allArgs.length < 1 || !allArgs[0]?.trim()) {
    throw new Error(
      'extractPdfReportData requires a PDF URL or file path as the first argument (${pdfSource}).'
    );
  }

  const source = allArgs[0].trim();
  ctx.log(`Starting PDF report extraction from source: ${source}`);

  const buffer = await loadPdfBuffer(source, ctx);
  validatePdf(buffer);

  let pdfText = '';
  let rows: Row[] = [];
  let parseStrategy = '';

  try {
    pdfText = await extractTextPdfParse(buffer, ctx);
    if (!pdfText.trim()) {
      throw new Error('pdf-parse returned empty text');
    }
    rows = parseTableFromText(pdfText);
    parseStrategy = 'pdf-parse';
  } catch (primaryError) {
    const primaryMessage = errorMessage(primaryError);
    ctx.warn(`pdf-parse based extraction did not succeed: ${primaryMessage}. Falling back to pdfjs-dist.`);

    try {
      pdfText = await extractTextPdfjsDist(buffer, ctx);
      rows = await parseRowsWithPdfjsDist(buffer, ctx);
      parseStrategy = 'pdfjs-dist';
    } catch (fallbackError) {
      const fallbackMessage = errorMessage(fallbackError);
      throw new Error(
        `PDF extraction failed. Primary error: ${primaryMessage}. Fallback error: ${fallbackMessage}`
      );
    }
  }

  if (!pdfText.trim()) {
    throw new Error('Extracted PDF text is empty');
  }

  const header = extractHeader(pdfText);

  if (!header.reportTitle) {
    throw new Error('Report title missing in PDF header');
  }
  if (!header.patientName) {
    throw new Error('Patient name missing in PDF header');
  }
  if (!header.patientId) {
    throw new Error('Patient ID missing in PDF header');
  }
  if (!header.periodRaw) {
    throw new Error('Report period missing in PDF header');
  }
  if (!header.pageNumber) {
    throw new Error('Page number missing in PDF header');
  }

  const { start: reportStartDate, end: reportEndDate } = parsePeriod(header.periodRaw);
  if (!reportStartDate) {
    throw new Error('Report start date missing or malformed in period');
  }
  if (!reportEndDate) {
    throw new Error('Report end date missing or malformed in period');
  }

  if (rows.length === 0) {
    throw new Error('No table rows found in PDF');
  }

  const firstRow = rows[0];
  const mandatoryColumns: (keyof Row)[] = [
    'dateTime',
    'vital',
    'recordedBy',
    'severity',
    'status',
    'value',
    'guidelines',
  ];
  for (const col of mandatoryColumns) {
    if (!firstRow[col] || firstRow[col].trim().length === 0) {
      throw new Error(`Mandatory column "${col}" missing or empty in first table row`);
    }
  }

  ctx.setVariable('reportTitle', header.reportTitle);
  ctx.setVariable('patientName', header.patientName);
  ctx.setVariable('patientId', header.patientId);
  ctx.setVariable('reportStartDate', reportStartDate);
  ctx.setVariable('reportEndDate', reportEndDate);
  ctx.setVariable('pageNumber', header.pageNumber);

  ctx.setVariable('row1DateTime', firstRow.dateTime);
  ctx.setVariable('row1Vital', firstRow.vital);
  ctx.setVariable('row1RecordedBy', firstRow.recordedBy);
  ctx.setVariable('row1Severity', firstRow.severity);
  ctx.setVariable('row1Status', firstRow.status);
  ctx.setVariable('row1Value', firstRow.value);
  ctx.setVariable('row1Guidelines', firstRow.guidelines);

  ctx.setVariable('allPdfRows', JSON.stringify(rows));
  ctx.setVariable('pdfRowCount', rows.length.toString());
  ctx.setVariable('pdfText', pdfText);

  ctx.log(`Parse strategy: ${parseStrategy}`);
  ctx.log(`Report Title : ${header.reportTitle}`);
  ctx.log(`Patient Name : ${header.patientName}`);
  ctx.log(`Patient ID : ${header.patientId}`);
  ctx.log(`Report Start Date : ${reportStartDate}`);
  ctx.log(`Report End Date : ${reportEndDate}`);
  ctx.log(`Page Number : ${header.pageNumber}`);
  ctx.log(`Row Count : ${rows.length}`);
  ctx.log(`Row1 Date : ${firstRow.dateTime}`);
  ctx.log(`Row1 Vital : ${firstRow.vital}`);
  ctx.log(`Row1 Recorded By : ${firstRow.recordedBy}`);
  ctx.log(`Row1 Severity : ${firstRow.severity}`);
  ctx.log(`Row1 Status : ${firstRow.status}`);
  ctx.log(`Row1 Value : ${firstRow.value}`);
  ctx.log(`Row1 Guidelines : ${firstRow.guidelines}`);
}

async function loadPdfBuffer(source: string, ctx: WalnutContext): Promise<Buffer> {
  if (/^https?:\/\//i.test(source)) {
    return downloadBuffer(source, ctx);
  }
  return readFileBuffer(source, ctx);
}

function downloadBuffer(
  url: string,
  ctx: WalnutContext,
  maxRedirects: number = 5,
  redirectCount: number = 0
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    if (redirectCount > maxRedirects) {
      reject(new Error(`Too many redirects while downloading PDF from ${url}`));
      return;
    }

    const client = url.toLowerCase().startsWith('https:') ? https : http;
    const request = client.get(
      url,
      { timeout: 30000 },
      (response) => {
        if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          const redirectUrl = new URL(response.headers.location, url).toString();
          ctx.log(`Following redirect ${redirectCount + 1}/${maxRedirects} to ${redirectUrl}`);
          resolve(downloadBuffer(redirectUrl, ctx, maxRedirects, redirectCount + 1));
          return;
        }

        if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
          reject(
            new Error(
              `Failed to download PDF from ${url}: HTTP ${response.statusCode} ${response.statusMessage || ''}`
            )
          );
          return;
        }

        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => {
          const buffer = Buffer.concat(chunks);
          ctx.log(`Downloaded PDF from ${url} (${buffer.length} bytes)`);
          resolve(buffer);
        });
        response.on('error', (err: Error) => {
          reject(new Error(`Error downloading PDF from ${url}: ${err.message}`));
        });
      }
    );

    request.on('error', (err: Error) => {
      reject(new Error(`Could not connect to PDF URL ${url}: ${err.message}`));
    });

    request.on('timeout', () => {
      request.destroy();
      reject(new Error(`Timeout downloading PDF from ${url}`));
    });
  });
}

async function readFileBuffer(filePath: string, ctx: WalnutContext): Promise<Buffer> {
  try {
    const buffer = await fs.promises.readFile(path.resolve(filePath));
    ctx.log(`Loaded PDF file from ${filePath} (${buffer.length} bytes)`);
    return buffer;
  } catch (err) {
    throw new Error(`Could not read PDF file at ${filePath}: ${errorMessage(err)}`);
  }
}

function validatePdf(buffer: Buffer): void {
  if (!buffer || buffer.length < 5) {
    throw new Error('PDF file is empty or too small to be valid');
  }
  const header = buffer.slice(0, 5).toString('ascii');
  if (header !== '%PDF-') {
    throw new Error(`Invalid PDF: expected header "%PDF-", found "${header}"`);
  }
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}

async function extractTextPdfParse(buffer: Buffer, ctx: WalnutContext): Promise<string> {
  ctx.log('Attempting PDF text extraction with pdf-parse');
  try {
    const pdfParseModule: any = await import('pdf-parse');
    const pdfParse = pdfParseModule.default || pdfParseModule;
    const result = await pdfParse(buffer);
    const text = result && typeof result.text === 'string' ? result.text : '';
    ctx.log(`pdf-parse extracted ${text.length} characters`);
    return text;
  } catch (err) {
    throw new Error(`pdf-parse extraction failed: ${errorMessage(err)}`);
  }
}

async function extractTextPdfjsDist(buffer: Buffer, ctx: WalnutContext): Promise<string> {
  ctx.log('Attempting PDF text extraction with pdfjs-dist');
  try {
    const pdfjs: any = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(buffer),
      useSystemFonts: true,
    });
    const pdf = await loadingTask.promise;

    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const items = (content.items || []) as any[];
      const pageText = items.map((it: any) => (it.str || '')).join(' ');
      text += pageText + '\n';
    }

    ctx.log(`pdfjs-dist extracted ${text.length} characters`);
    return text;
  } catch (err) {
    throw new Error(`pdfjs-dist extraction failed: ${errorMessage(err)}`);
  }
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function extractHeader(text: string) {
  const tableHeaderMatch = text.match(/DATE\s*&\s*TIME/i);
  const headerSection =
    tableHeaderMatch && tableHeaderMatch.index !== undefined
      ? text.slice(0, tableHeaderMatch.index)
      : text;

  const patientName = extractLabelValue(headerSection, 'Patient', ['ID:']);
  const patientId = extractLabelValue(headerSection, 'ID', ['Period:']);
  const periodRaw = extractLabelValue(headerSection, 'Period', ['Page']);

  const reportTitle = extractReportTitle(headerSection);

  const pageMatch = text.match(/Page\s+(\d+)\s+of\s+(\d+)/i);
  const pageNumber = pageMatch ? pageMatch[0] : '';

  return {
    reportTitle,
    patientName,
    patientId,
    periodRaw,
    pageNumber,
  };
}

function extractLabelValue(
  section: string,
  label: string,
  nextLabels: string[]
): string {
  const labelPrefix = label + ':';
  const labelIdx = section.indexOf(labelPrefix);
  if (labelIdx === -1) {
    return '';
  }

  const valueStart = labelIdx + labelPrefix.length;
  let nextIdx = section.length;
  for (const next of nextLabels) {
    const idx = section.indexOf(next, valueStart);
    if (idx !== -1 && idx < nextIdx) {
      nextIdx = idx;
    }
  }

  return normalizeWhitespace(section.slice(valueStart, nextIdx));
}

function extractReportTitle(headerSection: string): string {
  const patientMatch = headerSection.match(/(?:^|\n)\s*Patient\s*:/i);
  const beforePatient =
    patientMatch && patientMatch.index !== undefined
      ? headerSection.slice(0, patientMatch.index)
      : headerSection;
  return normalizeWhitespace(beforePatient);
}

function parsePeriod(periodRaw: string): { start: string; end: string } {
  const normalized = normalizeWhitespace(periodRaw);

  const toMatch = normalized.match(/^(.+?)\s+to\s+(.+)$/i);
  if (toMatch) {
    return { start: toMatch[1].trim(), end: toMatch[2].trim() };
  }

  const dateRegex = /[A-Za-z]{3},?\s+\d{1,2}\s+[A-Za-z]{3,}\s+\d{4}[\s\S]*?\d{1,2}:\d{2}:\d{2}(?:\s*(?:GMT|UTC|[+-]\d{4}))?/g;
  const dates = normalized.match(dateRegex);
  if (dates && dates.length >= 2) {
    return { start: dates[0].trim(), end: dates[1].trim() };
  }

  return { start: normalized, end: '' };
}

function parseTableFromText(text: string): Row[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);

  const headerLineIndex = lines.findIndex(
    (line) =>
      /DATE\s*&\s*TIME/i.test(line) &&
      /VITAL/i.test(line) &&
      /GUIDELINES/i.test(line)
  );
  if (headerLineIndex === -1) {
    throw new Error('Table header not found: missing required columns');
  }

  const headerLine = lines[headerLineIndex];
  const columnNames = [
    'DATE & TIME',
    'VITAL',
    'RECORDED BY',
    'SEVERITY',
    'STATUS',
    'VALUE',
    'GUIDELINES',
  ];

  const positions: { name: string; start: number; end: number }[] = [];
  for (const name of columnNames) {
    const start = headerLine.indexOf(name);
    if (start !== -1) {
      positions.push({ name, start, end: start + name.length });
    }
  }
  positions.sort((a, b) => a.start - b.start);

  if (positions.length < columnNames.length) {
    throw new Error(
      `Table header incomplete: found ${positions.length}/${columnNames.length} columns`
    );
  }

  const dateRegex = /^[A-Z][a-z]{2}\s+\d{1,2},\s+\d{4},\s+\d{1,2}:\d{2}\s+(?:AM|PM)/;
  const rows: Row[] = [];
  let currentRowText = '';

  for (let i = headerLineIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    if (dateRegex.test(line.trim())) {
      if (currentRowText) {
        const row = parseRowText(currentRowText, positions);
        if (row) {
          rows.push(row);
        }
      }
      currentRowText = line;
    } else {
      currentRowText += ' ' + line;
    }
  }

  if (currentRowText) {
    const row = parseRowText(currentRowText, positions);
    if (row) {
      rows.push(row);
    }
  }

  if (rows.length === 0) {
    throw new Error('No table rows found after header');
  }

  return rows;
}

function parseRowText(
  rowText: string,
  positions: { name: string; start: number; end: number }[]
): Row | null {
  const cells: string[] = [];
  for (let i = 0; i < positions.length; i++) {
    const start = positions[i].start;
    const end = i < positions.length - 1 ? positions[i + 1].start : rowText.length;
    cells.push(rowText.substring(start, end).trim());
  }

  if (cells.every((cell) => cell.length === 0)) {
    return null;
  }

  const value = cells[5].replace(/\s+(?=\S+?:)/g, '\n');

  return {
    dateTime: cells[0],
    vital: cells[1],
    recordedBy: cells[2],
    severity: cells[3],
    status: cells[4],
    value,
    guidelines: cells[6],
  };
}

async function parseRowsWithPdfjsDist(
  buffer: Buffer,
  ctx: WalnutContext
): Promise<Row[]> {
  const pdfjs: any = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
  });
  const pdf = await loadingTask.promise;

  const allItems: TextItem[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const items = (content.items || []) as any[];

    for (const it of items) {
      const transform = it.transform || [0, 0, 0, 0, 0, 0];
      allItems.push({
        str: String(it.str || ''),
        x: parseFloat(transform[4]) || 0,
        y: parseFloat(transform[5]) || 0,
        width: parseFloat(it.width) || 0,
        height: parseFloat(it.height) || 0,
      });
    }
  }

  return parseItemsIntoRows(allItems, ctx);
}

function parseItemsIntoRows(items: TextItem[], ctx: WalnutContext): Row[] {
  const columnNames = [
    'DATE & TIME',
    'VITAL',
    'RECORDED BY',
    'SEVERITY',
    'STATUS',
    'VALUE',
    'GUIDELINES',
  ];

  const yThreshold = 3;
  const rowsMap = new Map<number, TextItem[]>();

  for (const item of items) {
    if (!item.str.trim()) {
      continue;
    }

    let placed = false;
    for (const [keyY, rowItems] of rowsMap.entries()) {
      if (Math.abs(item.y - keyY) <= yThreshold) {
        rowItems.push(item);
        placed = true;
        break;
      }
    }

    if (!placed) {
      rowsMap.set(item.y, [item]);
    }
  }

  const sortedRows = Array.from(rowsMap.entries())
    .sort((a, b) => b[0] - a[0])
    .map((entry) => entry[1]);

  let headerIndex = -1;
  let headerRanges: { name: string; center: number; start: number; end: number }[] = [];

  for (let i = 0; i < sortedRows.length; i++) {
    const rowText = sortedRows[i].map((it) => it.str).join(' ');
    if (columnNames.every((name) => rowText.includes(name))) {
      headerIndex = i;
      headerRanges = computeHeaderRanges(sortedRows[i], columnNames);
      ctx.log(
        `pdfjs-dist found table header at row ${headerIndex} with ${headerRanges.length} columns`
      );
      break;
    }
  }

  if (headerIndex === -1 || headerRanges.length < columnNames.length) {
    throw new Error('Table header not found via positional parsing');
  }

  const rows: Row[] = [];
  for (let i = headerIndex + 1; i < sortedRows.length; i++) {
    const rowText = sortedRows[i].map((it) => it.str).join(' ');
    if (/Page\s+\d+\s+of\s+\d+/i.test(rowText)) {
      continue;
    }

    const cells = assignRowToColumns(sortedRows[i], headerRanges);
    if (cells.some((cell) => cell.length > 0)) {
      rows.push({
        dateTime: cells[0],
        vital: cells[1],
        recordedBy: cells[2],
        severity: cells[3],
        status: cells[4],
        value: cells[5],
        guidelines: cells[6],
      });
    }
  }

  return rows;
}

function computeHeaderRanges(
  headerItems: TextItem[],
  columnNames: string[]
): { name: string; center: number; start: number; end: number }[] {
  const sorted = headerItems.slice().sort((a, b) => a.x - b.x);
  const ranges: { name: string; center: number; start: number; end: number }[] = [];

  let i = 0;
  while (i < sorted.length) {
    let matched = false;
    for (const name of columnNames) {
      const tokens = name.split(/\s+/);
      if (i + tokens.length <= sorted.length) {
        const candidate = sorted.slice(i, i + tokens.length);
        const candidateText = candidate.map((it) => it.str).join(' ');
        if (candidateText === name) {
          const start = candidate[0].x;
          const last = candidate[candidate.length - 1];
          const end = last.x + (last.width || 0);
          ranges.push({ name, center: (start + end) / 2, start, end });
          i += tokens.length;
          matched = true;
          break;
        }
      }
    }
    if (!matched) {
      i++;
    }
  }

  return ranges.sort((a, b) => a.start - b.start);
}

function assignRowToColumns(
  rowItems: TextItem[],
  ranges: { name: string; center: number; start: number; end: number }[]
): string[] {
  const cellItems: TextItem[][] = ranges.map(() => []);

  for (const item of rowItems) {
    const itemCenter = item.x + (item.width || 0) / 2;
    let bestIdx = 0;
    let bestDist = Infinity;

    for (let j = 0; j < ranges.length; j++) {
      const dist = Math.abs(itemCenter - ranges[j].center);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = j;
      }
    }

    cellItems[bestIdx].push(item);
  }

  return cellItems.map((items) => buildCellText(items));
}

function buildCellText(items: TextItem[]): string {
  if (items.length === 0) {
    return '';
  }

  const sorted = items.slice().sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: TextItem[][] = [];
  let currentLine: TextItem[] = [];
  let currentY: number | null = null;

  for (const item of sorted) {
    if (currentY === null || Math.abs(item.y - currentY) <= 3) {
      currentLine.push(item);
    } else {
      currentLine.sort((a, b) => a.x - b.x);
      lines.push(currentLine);
      currentLine = [item];
    }
    currentY = item.y;
  }

  if (currentLine.length > 0) {
    currentLine.sort((a, b) => a.x - b.x);
    lines.push(currentLine);
  }

  return lines.map((line) => line.map((it) => it.str).join(' ')).join('\n');
}
