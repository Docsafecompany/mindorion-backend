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

  // Detect insertions: <w:ins w:author="..." w:date="...">...</w:ins>
  // Use string-based scanning to avoid regex dotall issues
  const insBlocks = extractXmlBlocks(docXml, 'w:ins');
    for (const block of insBlocks) {
          const author = extractAttr(block.tag, 'w:author');
          const date = extractAttr(block.tag, 'w:date');
          const text = extractTextFromXmlFragment(block.inner);
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

  // Detect deletions: <w:del w:author="..." w:date="...">...</w:del>
  const delBlocks = extractXmlBlocks(docXml, 'w:del');
    for (const block of delBlocks) {
          const author = extractAttr(block.tag, 'w:author');
          const date = extractAttr(block.tag, 'w:date');
          const text = extractTextFromXmlFragment(block.inner);
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

  // Detect formatting changes: <w:rPrChange w:author="..." w:date="..."/>
  const rPrRegex = /w:author="([^"]*)"[^>]*w:date="([^"]*)"/g;
    const rPrBlocks = extractXmlBlocks(docXml, 'w:rPrChange');
    for (const block of rPrBlocks) {
          const author = extractAttr(block.tag, 'w:author');
          const date = extractAttr(block.tag, 'w:date');
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

/**
 * Extract all occurrences of <tagName ...>...</tagName> from XML string.
 * Returns array of { tag: opening tag string, inner: inner content string }.
 * Handles self-closing tags gracefully.
 */
function extractXmlBlocks(xml: string, tagName: string): Array<{ tag: string; inner: string }> {
    const results: Array<{ tag: string; inner: string }> = [];
    const openPattern = new RegExp('<' + tagName + '[\\s>]', 'g');
    let match: RegExpExecArray | null;

  while ((match = openPattern.exec(xml)) !== null) {
        const startIdx = match.index;
        // Find end of opening tag
      const tagEnd = xml.indexOf('>', startIdx);
        if (tagEnd === -1) continue;
        const tag = xml.substring(startIdx, tagEnd + 1);

      // Self-closing?
      if (tag.endsWith('/>')) {
              results.push({ tag, inner: '' });
              continue;
      }

      // Find closing tag
      const closeTag = '</' + tagName + '>';
        const closeIdx = xml.indexOf(closeTag, tagEnd);
        if (closeIdx === -1) continue;

      const inner = xml.substring(tagEnd + 1, closeIdx);
        results.push({ tag, inner });
  }

  return results;
}

/**
 * Extract attribute value from an XML opening tag string.
 */
function extractAttr(tag: string, attrName: string): string {
    const pattern = new RegExp(attrName + '="([^"]*)"');
    const m = tag.match(pattern);
    return m ? m[1] : '';
}

/**
 * Extract text content from an XML fragment (handles w:t and w:delText).
 */
function extractTextFromXmlFragment(xml: string): string {
    const texts: string[] = [];

  // Extract <w:t> and <w:t xml:space="preserve"> content
  const tRegex = /<w:t(?:[^>]*)>([^<]*)<\/w:t>/g;
    let match: RegExpExecArray | null;
    while ((match = tRegex.exec(xml)) !== null) {
          texts.push(match[1]);
    }

  // Also extract <w:delText> content
  const delTRegex = /<w:delText(?:[^>]*)>([^<]*)<\/w:delText>/g;
    while ((match = delTRegex.exec(xml)) !== null) {
          texts.push(match[1]);
    }

  return texts.join('').trim();
}
