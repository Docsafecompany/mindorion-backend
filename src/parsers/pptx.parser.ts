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

  const xmlFiles = Object.keys(zip.files).filter(
        f => f.endsWith('.xml') || f.endsWith('.rels')
      );
    await Promise.all(
          xmlFiles.map(async f => {
                  try {
                            rawXml[f] = await zip.files[f].async('string');
                  } catch {}
          })
        );

  // --- Core metadata ---
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

  // --- App metadata ---
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

  // --- Slides ---
  const slideFiles = Object.keys(zip.files)
      .filter(f => f.match(/^ppt\/slides\/slide\d+\.xml$/))
      .sort((a, b) => {
              const numA = parseInt(a.match(/slide(\d+)/)?.[1] || '0');
              const numB = parseInt(b.match(/slide(\d+)/)?.[1] || '0');
              return numA - numB;
      });
    const slides = slideFiles.length;

  // --- Extract text per slide ---
  const slideTexts: Array<{ slideNumber: number; text: string }> = [];
    for (const sf of slideFiles) {
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

  // --- Slide names ---
  // PPTX doesn't have user-defined slide names in standard format.
  // We derive a meaningful label from the slide's title placeholder (p:sp with idx=0),
  // falling back to "Slide N" if no title is found.
  const slideNames: string[] = [];
    for (const sf of slideFiles) {
          const match = sf.match(/slide(\d+)\.xml$/);
          const slideNumber = match ? parseInt(match[1]) : slideNames.length + 1;
          let slideName = 'Slide ' + slideNumber;

      if (rawXml[sf]) {
              try {
                        const doc = await parseStringPromise(rawXml[sf], { explicitArray: false });
                        // Title placeholder has ph type="title" or ph idx="0"
                const titleText = extractSlideTitleText(doc);
                        if (titleText && titleText.trim().length > 0) {
                                    slideName = titleText.trim().substring(0, 60);
                        }
              } catch {}
      }

      slideNames.push(slideName);
    }

  const fullText = slideTexts.map(s => s.text).join(' ').replace(/\s+/g, ' ').trim();

  // --- Count tables ---
  let tables = 0;
    for (const sf of slideFiles) {
          if (rawXml[sf]) {
                  const matches = rawXml[sf].match(/<a:tbl[\s>]/g);
                  if (matches) tables += matches.length;
          }
    }

  return {
        fileType: 'pptx',
        fullText,
        slides,
        tables,
        rawXml,
        zip,
        metadata,
        appMetadata,
        slideTexts,
        slideNames,
  };
}

function extractPptxText(node: any): string {
    const texts: string[] = [];
    function walk(n: any) {
          if (!n || typeof n !== 'object') return;
          if (n['a:t']) {
                  const t = n['a:t'];
                  if (typeof t === 'string') texts.push(t);
                  else if (t._) texts.push(t._);
                  else if (Array.isArray(t)) {
                            t.forEach(i => texts.push(typeof i === 'string' ? i : (i._ || '')));
                  }
          }
          Object.values(n).forEach(v => {
                  if (Array.isArray(v)) v.forEach(walk);
                  else if (typeof v === 'object') walk(v);
          });
    }
    walk(node);
    return texts.join(' ').trim();
}

/**
 * Extract the title text from a PPTX slide XML document.
 * Looks for a shape with a title placeholder (ph type="title" or ph idx="0").
 */
function extractSlideTitleText(doc: any): string {
    const slide = doc['p:sld'] || doc['p:notes'] || {};
    const cSld = slide['p:cSld'] || {};
    const spTree = cSld['p:spTree'] || {};
    const shapes = spTree['p:sp'];
    if (!shapes) return '';

  const shapesArr = Array.isArray(shapes) ? shapes : [shapes];

  for (const sp of shapesArr) {
        const nvSpPr = sp['p:nvSpPr'] || {};
        const nvPr = nvSpPr['p:nvPr'] || {};
        const ph = nvPr['p:ph'];

      if (!ph) continue;

      const phAttr = (Array.isArray(ph) ? ph[0] : ph)?.$ || {};
        const phType = phAttr.type || '';
        const phIdx = phAttr.idx || '';

      // Title placeholder
      if (phType === 'title' || phType === 'ctrTitle' || phIdx === '0') {
              const txBody = sp['p:txBody'] || {};
              const paras = txBody['a:p'];
              if (!paras) continue;

          const parasArr = Array.isArray(paras) ? paras : [paras];
              const texts: string[] = [];

          for (const para of parasArr) {
                    const runs = para['a:r'];
                    if (!runs) continue;
                    const runsArr = Array.isArray(runs) ? runs : [runs];
                    for (const run of runsArr) {
                                const t = run['a:t'];
                                if (t) {
                                              const val = typeof t === 'string' ? t : (t._ || '');
                                              if (val) texts.push(val);
                                }
                    }
          }

          if (texts.length > 0) return texts.join('');
      }
  }

  return '';
}
