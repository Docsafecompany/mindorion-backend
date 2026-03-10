import { parseStringPromise } from 'xml2js';

export interface SpeakerNoteItem {
  text: string;
  slideNumber: number;
  location: string;
  severity: 'high';
}

export async function detectSpeakerNotes(parsedDoc: any, fileType: string): Promise<SpeakerNoteItem[]> {
  if (fileType !== 'pptx') return [];
  
  const notes: SpeakerNoteItem[] = [];
  const rawXml = parsedDoc.rawXml || {};
  
  // Find notes slide files: ppt/notesSlides/notesSlideN.xml
  const notesFiles = Object.keys(rawXml)
    .filter(f => f.match(/^ppt\/notesSlides\/notesSlide\d+\.xml$/))
    .sort();
  
  for (const nf of notesFiles) {
    const match = nf.match(/notesSlide(\d+)\.xml$/);
    const slideNumber = match ? parseInt(match[1]) : 0;
    
    if (!rawXml[nf]) continue;
    
    try {
      const doc = await parseStringPromise(rawXml[nf], { explicitArray: false });
      const text = extractNotesText(doc);
      
      if (text && text.trim() && text.trim().length > 0) {
        notes.push({
          text: text.trim(),
          slideNumber,
          location: 'Slide ' + slideNumber + ' (Speaker Notes)',
          severity: 'high',
        });
      }
    } catch (err) {
      console.error('Notes parse error for ' + nf + ':', err);
    }
  }
  
  return notes;
}

function extractNotesText(node: any): string {
  const texts: string[] = [];
  
  function walk(n: any) {
    if (!n || typeof n !== 'object') return;
    if (n['a:t']) {
      const t = n['a:t'];
      if (typeof t === 'string') texts.push(t);
      else if (t._) texts.push(t._);
      else if (Array.isArray(t)) {
        t.forEach(item => {
          if (typeof item === 'string') texts.push(item);
          else if (item._) texts.push(item._);
        });
      }
    }
    Object.values(n).forEach(v => {
      if (Array.isArray(v)) v.forEach(walk);
      else if (typeof v === 'object') walk(v);
    });
  }
  
  walk(node);
  return texts.join(' ').replace(/\s+/g, ' ').trim();
}
