import { parseStringPromise } from 'xml2js';

export interface HiddenContentItem {
  type: string;
  count: number;
  location: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  items: Array<{ value: string; location: string }>;
}

export interface HiddenContentResult {
  general: HiddenContentItem[];
  sheets: HiddenContentItem[];
  columns: HiddenContentItem[];
  rows: HiddenContentItem[];
  rowsColumns: HiddenContentItem[];
}

export async function detectHiddenContent(parsedDoc: any, fileType: string): Promise<HiddenContentResult> {
  const result: HiddenContentResult = {
    general: [],
    sheets: [],
    columns: [],
    rows: [],
    rowsColumns: [],
  };

  if (fileType === 'docx') {
    await detectDocxHidden(parsedDoc, result);
  } else if (fileType === 'pptx') {
    await detectPptxHidden(parsedDoc, result);
  } else if (fileType === 'xlsx' || fileType === 'xls') {
    await detectXlsxHidden(parsedDoc, result);
  }

  return result;
}

async function detectDocxHidden(parsedDoc: any, result: HiddenContentResult): Promise<void> {
  const rawXml = parsedDoc.rawXml || {};
  const docXml = rawXml['word/document.xml'] || '';

  if (!docXml) return;

  // Detect vanished text: <w:vanish/>
  const vanishMatches = docXml.match(/<w:vanish\/>/g) || [];
  if (vanishMatches.length > 0) {
    result.general.push({
      type: 'vanished_text',
      count: vanishMatches.length,
      location: 'Document',
      severity: 'high',
      description: 'Text with vanish formatting (hidden from view)',
      items: [],
    });
  }

  // Detect white-on-white text (color FFFFFF with no highlight)
  const whiteColorMatches = docXml.match(/<w:color w:val="FFFFFF"/g) || [];
  if (whiteColorMatches.length > 0) {
    result.general.push({
      type: 'white_text',
      count: whiteColorMatches.length,
      location: 'Document',
      severity: 'critical',
      description: 'White-colored text (potentially invisible on white background)',
      items: [],
    });
  }
}

async function detectPptxHidden(parsedDoc: any, result: HiddenContentResult): Promise<void> {
  const rawXml = parsedDoc.rawXml || {};

  // Check presentation.xml for hidden slides
  const presXml = rawXml['ppt/presentation.xml'];
  if (presXml) {
    const hiddenSlideMatches = presXml.match(/show="0"/g) || [];
    if (hiddenSlideMatches.length > 0) {
      result.general.push({
        type: 'hidden_slide',
        count: hiddenSlideMatches.length,
        location: 'Presentation',
        severity: 'high',
        description: 'Hidden slides detected (show="0")',
        items: [],
      });
    }
  }

  // Check individual slide files for off-slide objects
  const slideFiles = Object.keys(rawXml).filter(f => f.match(/^ppt\/slides\/slide\d+\.xml$/));
  for (const sf of slideFiles) {
    const slideXml = rawXml[sf];
    if (!slideXml) continue;

    // Objects positioned outside slide bounds (negative coordinates)
    const offSlideMatches = slideXml.match(/cx="-[0-9]+"/g) || [];
    if (offSlideMatches.length > 0) {
      const slideMatch = sf.match(/slide(\d+)/);
      result.general.push({
        type: 'off_slide_object',
        count: offSlideMatches.length,
        location: 'Slide ' + (slideMatch ? slideMatch[1] : '?'),
        severity: 'medium',
        description: 'Objects positioned outside slide boundaries',
        items: [],
      });
    }
  }
}

async function detectXlsxHidden(parsedDoc: any, result: HiddenContentResult): Promise<void> {
  const rawXml = parsedDoc.rawXml || {};

  // Check workbook for hidden sheets
  const wbXml = rawXml['xl/workbook.xml'];
  if (wbXml) {
    const hiddenSheetMatches = [...wbXml.matchAll(/state="(hidden|veryHidden)"/g)];
    if (hiddenSheetMatches.length > 0) {
      const sheetItems = hiddenSheetMatches.map(m => ({
        value: 'State: ' + m[1],
        location: 'Workbook',
      }));
      result.sheets.push({
        type: 'hidden_sheet',
        count: hiddenSheetMatches.length,
        location: 'Workbook',
        severity: 'high',
        description: 'Hidden worksheets detected',
        items: sheetItems,
      });
    }
  }

  // Check individual sheets for hidden rows/columns
  const sheetFiles = Object.keys(rawXml).filter(f => f.match(/^xl\/worksheets\/sheet\d+\.xml$/));
  
  for (const sf of sheetFiles) {
    const sheetXml = rawXml[sf];
    if (!sheetXml) continue;

    try {
      const doc = await parseStringPromise(sheetXml, { explicitArray: true });
      const ws = doc.worksheet || {};
      const sheetName = parsedDoc.sheetNames?.[parseInt(sf.match(/sheet(\d+)/)?.[1] || '1') - 1] || sf;

      // Hidden rows
      const rows = ws.sheetData?.[0]?.row || [];
      const hiddenRows = rows.filter((r: any) => r.$?.hidden === '1');
      if (hiddenRows.length > 0) {
        result.rows.push({
          type: 'hidden_row',
          count: hiddenRows.length,
          location: sheetName,
          severity: 'medium',
          description: 'Hidden rows detected',
          items: hiddenRows.map((r: any) => ({ value: 'Row ' + r.$?.r, location: sheetName })),
        });
        result.rowsColumns.push(...result.rows.slice(-1));
      }

      // Hidden columns
      const cols = ws.cols?.[0]?.col || [];
      const hiddenCols = cols.filter((c: any) => c.$?.hidden === '1');
      if (hiddenCols.length > 0) {
        result.columns.push({
          type: 'hidden_column',
          count: hiddenCols.length,
          location: sheetName,
          severity: 'medium',
          description: 'Hidden columns detected',
          items: hiddenCols.map((c: any) => ({ value: 'Col ' + c.$?.min + '-' + c.$?.max, location: sheetName })),
        });
        result.rowsColumns.push(...result.columns.slice(-1));
      }
    } catch {}
  }
}
