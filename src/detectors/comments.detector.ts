import { parseStringPromise } from 'xml2js';

export interface CommentItem {
  id: string;
  author: string;
  text: string;
  date: string;
  location: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export async function detectComments(parsedDoc: any, fileType: string): Promise<CommentItem[]> {
  const comments: CommentItem[] = [];

  if (fileType === 'docx') {
    await detectDocxComments(parsedDoc, comments);
  } else if (fileType === 'pptx') {
    await detectPptxComments(parsedDoc, comments);
  } else if (fileType === 'xlsx' || fileType === 'xls') {
    await detectXlsxComments(parsedDoc, comments);
  } else if (fileType === 'pdf') {
    detectPdfAnnotations(parsedDoc, comments);
  }

  return comments;
}

async function detectDocxComments(parsedDoc: any, comments: CommentItem[]): Promise<void> {
  const rawXml = parsedDoc.rawXml || {};
  const commentsXml = rawXml['word/comments.xml'];
  
  if (commentsXml) {
    try {
      const doc = await parseStringPromise(commentsXml, { explicitArray: true });
      const commentList = doc['w:comments']?.['w:comment'] || [];
      
      commentList.forEach((comment: any, i: number) => {
        const attr = comment.$ || {};
        const id = attr['w:id'] || String(i);
        const author = attr['w:author'] || 'Unknown';
        const date = attr['w:date'] || '';
        
        // Extract text from comment
        const texts: string[] = [];
        function extractText(node: any) {
          if (!node || typeof node !== 'object') return;
          if (node['w:t']) {
            const t = node['w:t'];
            const tArr = Array.isArray(t) ? t : [t];
            tArr.forEach((item: any) => {
              if (typeof item === 'string') texts.push(item);
              else if (item._) texts.push(item._);
            });
          }
          Object.values(node).forEach(v => {
            if (Array.isArray(v)) v.forEach(extractText);
            else if (typeof v === 'object') extractText(v);
          });
        }
        extractText(comment);
        
        comments.push({
          id,
          author,
          text: texts.join(' ').trim(),
          date,
          location: 'Document',
          severity: 'high',
        });
      });
    } catch (err) {
      console.error('Comment parse error:', err);
    }
  }
}

async function detectPptxComments(parsedDoc: any, comments: CommentItem[]): Promise<void> {
  const rawXml = parsedDoc.rawXml || {};
  
  // Find comment files in ppt/comments/
  const commentFiles = Object.keys(rawXml).filter(f => f.startsWith('ppt/comments/'));
  
  for (const cf of commentFiles) {
    try {
      const doc = await parseStringPromise(rawXml[cf], { explicitArray: true });
      const slideMatch = cf.match(/comment(\d+)/);
      const slideNum = slideMatch ? slideMatch[1] : '?';
      
      const cmLst = doc['p:cmLst']?.['p:cm'] || [];
      cmLst.forEach((cm: any, i: number) => {
        const attr = cm.$ || {};
        const author = attr.authorId || 'Unknown';
        const date = attr.dt || '';
        
        const textEl = cm['p:text']?.[0];
        const text = typeof textEl === 'string' ? textEl : (textEl?._ || '');
        
        comments.push({
          id: String(i),
          author,
          text,
          date,
          location: 'Slide ' + slideNum,
          severity: 'high',
        });
      });
    } catch {}
  }
}

async function detectXlsxComments(parsedDoc: any, comments: CommentItem[]): Promise<void> {
  const rawXml = parsedDoc.rawXml || {};
  const commentFiles = Object.keys(rawXml).filter(f => f.match(/^xl\/comments\d*\.xml$/) || f.match(/^xl\/comments\//));
  
  for (const cf of commentFiles) {
    try {
      const doc = await parseStringPromise(rawXml[cf], { explicitArray: true });
      const commentList = doc.comments?.commentList?.[0]?.comment || [];
      
      commentList.forEach((c: any, i: number) => {
        const ref = c.$?.ref || '';
        const authorIdx = parseInt(c.$?.authorId || '0');
        const authors = doc.comments?.authors?.[0]?.author || [];
        const author = authors[authorIdx] || 'Unknown';
        
        const texts: string[] = [];
        const runs = c.text?.[0]?.r || [];
        runs.forEach((r: any) => {
          const t = r.t?.[0];
          if (t) texts.push(typeof t === 'string' ? t : (t._ || ''));
        });
        
        comments.push({
          id: String(i),
          author: typeof author === 'string' ? author : String(author),
          text: texts.join('').trim(),
          date: '',
          location: 'Cell ' + ref,
          severity: 'high',
        });
      });
    } catch {}
  }
}

function detectPdfAnnotations(parsedDoc: any, comments: CommentItem[]): void {
  // For PDF, we detect annotations from the text (basic approach)
  // A full PDF annotation parser would require pdf.js
  const text = parsedDoc.fullText || '';
  const annotationPattern = /\[Comment:\s*([^\]]+)\]/gi;
  let match;
  let i = 0;
  while ((match = annotationPattern.exec(text)) !== null) {
    comments.push({
      id: String(i++),
      author: 'Unknown',
      text: match[1],
      date: '',
      location: 'PDF Annotation',
      severity: 'high',
    });
  }
}
