import JSZip from 'jszip';
import { parseStringPromise } from 'xml2js';

export interface XlsxParsedDocument {
  fileType: 'xlsx' | 'xls';
  fullText: string;
  sheets: number;
  tables: number | null;
  rawXml: Record<string, string>;
  zip: JSZip;
  metadata: Record<string, string>;
  appMetadata: Record<string, string>;
  sheetNames: string[];
  sheetData: Array<{ name: string; index: number; text: string; formulas: string[] }>;
  sharedStrings: string[];
}

export async function parseXlsx(buffer: Buffer): Promise<XlsxParsedDocument> {
  const zip = await JSZip.loadAsync(buffer);
  const rawXml: Record<string, string> = {};

  const xmlFiles = Object.keys(zip.files).filter(f => f.endsWith('.xml') || f.endsWith('.rels'));
  await Promise.all(xmlFiles.map(async f => {
    try { rawXml[f] = await zip.files[f].async('string'); } catch {}
  }));

  let metadata: Record<string, string> = {};
  if (rawXml['docProps/core.xml']) {
    try {
      const core = await parseStringPromise(rawXml['docProps/core.xml'], { explicitArray: false });
      const cp = core['cp:coreProperties'] || core.coreProperties || {};
      metadata = {
        author: cp['dc:creator'] || cp.creator || '',
        lastModifiedBy: cp['cp:lastModifiedBy'] || cp.lastModifiedBy || '',
        created: cp['dcterms:created']?._ || cp['dcterms:created'] || '',
        modified: cp['dcterms:modified']?._ || cp['dcterms:modified'] || '',
        title: cp['dc:title'] || cp.title || '',
      };
    } catch {}
  }

  let appMetadata: Record<string, string> = {};
  if (rawXml['docProps/app.xml']) {
    try {
      const app = await parseStringPromise(rawXml['docProps/app.xml'], { explicitArray: false });
      const props = app.Properties || {};
      appMetadata = {
        application: props.Application || '',
        company: props.Company || '',
        appVersion: props.AppVersion || '',
      };
    } catch {}
  }

  // Get shared strings
  const sharedStrings: string[] = [];
  if (rawXml['xl/sharedStrings.xml']) {
    try {
      const ss = await parseStringPromise(rawXml['xl/sharedStrings.xml'], { explicitArray: true });
      const siArray = ss.sst?.si || [];
      siArray.forEach((si: any) => {
        if (si.t) {
          const t = Array.isArray(si.t) ? si.t[0] : si.t;
          sharedStrings.push(typeof t === 'string' ? t : (t._ || ''));
        } else if (si.r) {
          const rs = Array.isArray(si.r) ? si.r : [si.r];
          const text = rs.map((r: any) => {
            const t = Array.isArray(r.t) ? r.t[0] : r.t;
            return typeof t === 'string' ? t : (t?._ || '');
          }).join('');
          sharedStrings.push(text);
        }
      });
    } catch {}
  }

  // Get sheet names from workbook
  const sheetNames: string[] = [];
  if (rawXml['xl/workbook.xml']) {
    try {
      const wb = await parseStringPromise(rawXml['xl/workbook.xml'], { explicitArray: true });
      const sheets = wb['workbook']?.sheets?.[0]?.sheet || wb.workbook?.sheets?.[0]?.sheet || [];
      const sheetsArr = Array.isArray(sheets) ? sheets : [sheets];
      sheetsArr.forEach((s: any) => {
        if (s?.$?.name) sheetNames.push(s.$.name);
      });
    } catch {}
  }

  // Parse each sheet
  const sheetFiles = Object.keys(zip.files).filter(f => f.match(/^xl\/worksheets\/sheet\d+\.xml$/)).sort();
  const sheetData: Array<{ name: string; index: number; text: string; formulas: string[] }> = [];

  for (let i = 0; i < sheetFiles.length; i++) {
    const sf = sheetFiles[i];
    if (!rawXml[sf]) continue;
    
    const texts: string[] = [];
    const formulas: string[] = [];
    
    try {
      const sheet = await parseStringPromise(rawXml[sf], { explicitArray: true });
      const rows = sheet.worksheet?.sheetData?.[0]?.row || [];
      
      rows.forEach((row: any) => {
        const cells = Array.isArray(row.c) ? row.c : (row.c ? [row.c] : []);
        cells.forEach((cell: any) => {
          const cellObj = Array.isArray(cell) ? cell[0] : cell;
          if (!cellObj) return;
          
          // Get value
          const v = cellObj.v?.[0];
          const t = cellObj.$?.t;
          const f = cellObj.f?.[0];
          
          if (f) {
            const fVal = typeof f === 'string' ? f : (f._ || f);
            formulas.push(fVal);
          }
          
          if (v !== undefined) {
            if (t === 's' && sharedStrings[parseInt(String(v))]) {
              texts.push(sharedStrings[parseInt(String(v))]);
            } else {
              texts.push(String(v));
            }
          }
        });
      });
    } catch {}
    
    sheetData.push({
      name: sheetNames[i] || 'Sheet' + (i + 1),
      index: i,
      text: texts.join(' '),
      formulas,
    });
  }

  const fullText = sheetData.map(s => s.text).join(' ').replace(/\s+/g, ' ').trim();
  const fileType = 'xlsx';

  return { fileType, fullText, sheets: sheetFiles.length, tables: null, rawXml, zip, metadata, appMetadata, sheetNames, sheetData, sharedStrings };
}
