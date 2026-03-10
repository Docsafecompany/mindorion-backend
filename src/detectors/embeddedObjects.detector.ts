export interface EmbeddedObjectItem {
  type: string;
  name: string;
  size: number;
  location: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export async function detectEmbeddedObjects(parsedDoc: any, fileType: string): Promise<EmbeddedObjectItem[]> {
  const items: EmbeddedObjectItem[] = [];
  const rawXml = parsedDoc.rawXml || {};
  const zip = parsedDoc.zip;

  if (!zip) return items;

  if (fileType === 'docx') {
    await detectDocxEmbedded(zip, rawXml, items);
  } else if (fileType === 'pptx') {
    await detectPptxEmbedded(zip, rawXml, items);
  }

  return items;
}

async function detectDocxEmbedded(zip: any, rawXml: Record<string, string>, items: EmbeddedObjectItem[]): Promise<void> {
  // Check for OLE objects in embeddings directory
  const oleFiles = Object.keys(zip.files).filter(f => 
    f.startsWith('word/embeddings/') || f.startsWith('word/media/')
  );
  
  for (const f of oleFiles) {
    try {
      const fileData = await zip.files[f].async('uint8array');
      const size = fileData.length;
      const name = f.split('/').pop() || f;
      const type = f.startsWith('word/embeddings/') ? 'ole_object' : 'media_file';
      
      items.push({
        type,
        name,
        size,
        location: 'Document Embeddings',
        severity: type === 'ole_object' ? 'high' : 'medium',
      });
    } catch {}
  }

  // Check for external image references in rels
  const relsContent = rawXml['word/_rels/document.xml.rels'] || '';
  const externalImgRegex = /Target="(https?:\/\/[^"]+)"/g;
  let match;
  while ((match = externalImgRegex.exec(relsContent)) !== null) {
    items.push({
      type: 'external_link',
      name: match[1],
      size: 0,
      location: 'Document Relationships',
      severity: 'high',
    });
  }
}

async function detectPptxEmbedded(zip: any, rawXml: Record<string, string>, items: EmbeddedObjectItem[]): Promise<void> {
  // Check for embedded Excel files
  const embedFiles = Object.keys(zip.files).filter(f => 
    f.startsWith('ppt/embeddings/') || f.startsWith('ppt/media/')
  );
  
  for (const f of embedFiles) {
    try {
      const fileData = await zip.files[f].async('uint8array');
      const size = fileData.length;
      const name = f.split('/').pop() || f;
      const isExcel = name.endsWith('.xlsx') || name.endsWith('.xlsm') || name.includes('oleObject');
      
      items.push({
        type: isExcel ? 'embedded_excel' : 'media_file',
        name,
        size,
        location: 'Presentation Embeddings',
        severity: isExcel ? 'high' : 'low',
      });
    } catch {}
  }
}
