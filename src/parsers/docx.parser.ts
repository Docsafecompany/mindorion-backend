import JSZip from 'jszip';
import { parseStringPromise } from 'xml2js';

export interface DocxParsedDocument {
  fileType: 'docx';
  fullText: string;
  pages: number | null;
  tables: number | null;
  rawXml: Record<string, string>;
  zip: JSZip;
  metadata: Record<string, string>;
  appMetadata: Record<string, string>;
}

export async function parseDocx(buffer: Buffer): Promise<DocxParsedDocument> {
  const zip = await JSZip.loadAsync(buffer);
  const rawXml: Record<string, string> = {};

  // Extract all XML files
  const xmlFiles = Object.keys(zip.files).filter(f => f.endsWith('.xml') || f.endsWith('.rels'));
  await Promise.all(xmlFiles.map(async f => {
    try { rawXml[f] = await zip.files[f].async('string'); } catch {}
  }));

  // Parse document.xml for full text
  let fullText = '';
  if (rawXml['word/document.xml']) {
    const doc = await parseStringPromise(rawXml['word/document.xml'], { explicitArray: false });
    fullText = extractTextFromWordXml(doc);
  }

  // Parse core.xml for metadata
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
        subject: cp['dc:subject'] || cp.subject || '',
        keywords: cp['cp:keywords'] || cp.keywords || '',
        revision: cp['cp:revision'] || cp.revision || '',
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
        manager: props.Manager || '',
        template: props.Template || '',
        appVersion: props.AppVersion || '',
      };
    } catch {}
  }

  // Count pages
  let pages: number | null = null;
  if (rawXml['docProps/app.xml']) {
    try {
      const app = await parseStringPromise(rawXml['docProps/app.xml'], { explicitArray: false });
      const p = app.Properties?.Pages;
      if (p) pages = parseInt(String(p), 10);
    } catch {}
  }

  // Count tables
  let tables: number | null = null;
  if (rawXml['word/document.xml']) {
    const tableMatches = rawXml['word/document.xml'].match(/<w:tbl[\s>]/g);
    tables = tableMatches ? tableMatches.length : 0;
  }

  return { fileType: 'docx', fullText, pages, tables, rawXml, zip, metadata, appMetadata };
}

function extractTextFromWordXml(doc: any): string {
  const texts: string[] = [];
  
  function walkNode(node: any) {
    if (!node || typeof node !== 'object') return;
    if (node['w:t']) {
      const t = node['w:t'];
      if (typeof t === 'string') texts.push(t);
      else if (t._) texts.push(t._);
      else if (Array.isArray(t)) t.forEach(i => texts.push(typeof i === 'string' ? i : (i._ || '')));
    }
    Object.values(node).forEach(v => {
      if (Array.isArray(v)) v.forEach(walkNode);
      else if (typeof v === 'object') walkNode(v);
    });
  }
  
  walkNode(doc);
  return texts.join(' ').replace(/\s+/g, ' ').trim();
}
