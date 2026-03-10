import JSZip from 'jszip';
import { parseStringPromise } from 'xml2js';

export interface PptxParsedDocument {
  fileType: 'pptx';
  fullText: string;
  slides: number;
  tables: number | null;
  rawXml: Record<string, string>;
  zip: JSZip;
  metadata: Record<string, string>;
  appMetadata: Record<string, string>;
  slideTexts: Array<{ slideNumber: number; text: string }>;
  slideNames: string[];
}

export async function parsePptx(buffer: Buffer): Promise<PptxParsedDocument> {
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
        appVersion: props.AppVersion || '',
      };
    } catch {}
  }

  // Count slides
  const slideFiles = Object.keys(zip.files).filter(f => f.match(/^ppt\/slides\/slide\d+\.xml$/));
  const slides = slideFiles.length;

  // Extract text per slide
  const slideTexts: Array<{ slideNumber: number; text: string }> = [];
  for (const sf of slideFiles.sort()) {
    const match = sf.match(/slide(\d+)\.xml$/);
    const slideNumber = match ? parseInt(match[1]) : 0;
    if (rawXml[sf]) {
      try {
        const doc = await parseStringPromise(rawXml[sf], { explicitArray: false });
        const text = extractPptxText(doc);
        slideTexts.push({ slideNumber, text });
      } catch {}
    }
  }

  // Get slide names from presentation.xml
  const slideNames: string[] = [];
  if (rawXml['ppt/presentation.xml']) {
    try {
      const pres = await parseStringPromise(rawXml['ppt/presentation.xml'], { explicitArray: false });
      const sldIdLst = pres['p:presentation']?.['p:sldIdLst']?.['p:sldId'];
      if (Array.isArray(sldIdLst)) {
        sldIdLst.forEach((s: any, i: number) => {
          slideNames.push(s.$?.['r:id'] || 'Slide ' + (i + 1));
        });
      }
    } catch {}
  }

  const fullText = slideTexts.map(s => s.text).join(' ').replace(/\s+/g, ' ').trim();

  // Count tables
  let tables = 0;
  for (const sf of slideFiles) {
    if (rawXml[sf]) {
      const matches = rawXml[sf].match(/<a:tbl[\s>]/g);
      if (matches) tables += matches.length;
    }
  }

  return { fileType: 'pptx', fullText, slides, tables, rawXml, zip, metadata, appMetadata, slideTexts, slideNames };
}

function extractPptxText(node: any): string {
  const texts: string[] = [];
  function walk(n: any) {
    if (!n || typeof n !== 'object') return;
    if (n['a:t']) {
      const t = n['a:t'];
      if (typeof t === 'string') texts.push(t);
      else if (t._) texts.push(t._);
      else if (Array.isArray(t)) t.forEach(i => texts.push(typeof i === 'string' ? i : (i._ || '')));
    }
    Object.values(n).forEach(v => {
      if (Array.isArray(v)) v.forEach(walk);
      else if (typeof v === 'object') walk(v);
    });
  }
  walk(node);
  return texts.join(' ').trim();
}
