export interface TrackChangeItem {
  type: 'insertion' | 'deletion' | 'modification';
  text: string;
  originalText: string;
  author: string;
  date: string;
  location: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export async function detectTrackChanges(parsedDoc: any, fileType: string): Promise<TrackChangeItem[]> {
  const changes: TrackChangeItem[] = [];

  if (fileType !== 'docx') return changes;

  const rawXml = parsedDoc.rawXml || {};
  const docXml = rawXml['word/document.xml'] || '';

  if (!docXml) return changes;

  // Detect insertions: <w:ins>
  const insRegex = /<w:ins[^>]*w:author="([^"]*)"[^>]*w:date="([^"]*)"[^>]*>([sS]*?)</w:ins>/g;
  let match;
  while ((match = insRegex.exec(docXml)) !== null) {
    const author = match[1];
    const date = match[2];
    const innerXml = match[3];
    const text = extractTextFromXmlFragment(innerXml);
    
    changes.push({
      type: 'insertion',
      text,
      originalText: '',
      author,
      date,
      location: 'Document',
      severity: 'high',
    });
  }

  // Detect deletions: <w:del>
  const delRegex = /<w:del[^>]*w:author="([^"]*)"[^>]*w:date="([^"]*)"[^>]*>([sS]*?)</w:del>/g;
  while ((match = delRegex.exec(docXml)) !== null) {
    const author = match[1];
    const date = match[2];
    const innerXml = match[3];
    const text = extractTextFromXmlFragment(innerXml);
    
    changes.push({
      type: 'deletion',
      text: '',
      originalText: text,
      author,
      date,
      location: 'Document',
      severity: 'high',
    });
  }

  // Detect formatting changes: <w:rPrChange>
  const rPrRegex = /<w:rPrChange[^>]*w:author="([^"]*)"[^>]*w:date="([^"]*)"[^>]*/g;
  while ((match = rPrRegex.exec(docXml)) !== null) {
    const author = match[1];
    const date = match[2];
    
    changes.push({
      type: 'modification',
      text: '',
      originalText: '',
      author,
      date,
      location: 'Document',
      severity: 'medium',
    });
  }

  return changes;
}

function extractTextFromXmlFragment(xml: string): string {
  const texts: string[] = [];
  
  // Extract <w:t> content
  const tRegex = /<w:t[^>]*>([^<]*)</w:t>/g;
  let match;
  while ((match = tRegex.exec(xml)) !== null) {
    texts.push(match[1]);
  }
  
  // Also <w:delText>
  const delTRegex = /<w:delText[^>]*>([^<]*)</w:delText>/g;
  while ((match = delTRegex.exec(xml)) !== null) {
    texts.push(match[1]);
  }
  
  return texts.join('').trim();
}
