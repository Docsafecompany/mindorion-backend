import pdfParse from 'pdf-parse';

export interface PdfParsedDocument {
  fileType: 'pdf';
  fullText: string;
  pages: number;
  tables: number | null;
  metadata: Record<string, string>;
  rawBuffer: Buffer;
}

export async function parsePdf(buffer: Buffer): Promise<PdfParsedDocument> {
  let fullText = '';
  let pages = 0;
  let metadata: Record<string, string> = {};

  try {
    const data = await pdfParse(buffer);
    fullText = data.text || '';
    pages = data.numpages || 0;

    // Extract metadata from PDF info dictionary
    const info = data.info || {};
    metadata = {
      author: info.Author || '',
      creator: info.Creator || '',
      producer: info.Producer || '',
      title: info.Title || '',
      subject: info.Subject || '',
      keywords: info.Keywords || '',
      created: info.CreationDate || '',
      modified: info.ModDate || '',
      trapped: info.Trapped || '',
    };
  } catch (err) {
    console.error('PDF parse error:', err);
  }

  return {
    fileType: 'pdf',
    fullText,
    pages,
    tables: null,
    metadata,
    rawBuffer: buffer,
  };
}
