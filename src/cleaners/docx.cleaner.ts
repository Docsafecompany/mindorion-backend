import JSZip from 'jszip';

export interface CleanerOptions {
  removeMetadata: boolean;
  removeComments: boolean;
  acceptTrackChanges: boolean;
  removeHiddenContent: boolean;
  removeEmbeddedObjects: boolean;
  removeMacros: boolean;
  removeVisualObjects: boolean;
  sensitiveDataToClean: any[];
  hiddenContentToClean: any[];
  selectedComments: string[];
  selectedMetadata: string[];
  correctSpelling: boolean;
  approvedSpellingErrors: Array<{ id?: string; error: string; correction: string }>;
  aiRewritingEnabled: boolean;
  aiRewritingTone: 'consulting' | 'formal' | 'friendly';
}

export interface CleanResult {
  buffer: Buffer;
  report: { operations: string[]; removedItems: number; originalText?: string; };
}

export async function cleanDocx(originalBuffer: Buffer, parsedDoc: any, options: CleanerOptions): Promise<CleanResult> {
  const zip = await JSZip.loadAsync(originalBuffer);
  const operations: string[] = [];
  let removedItems = 0;

  if (options.removeMetadata) {
    if (zip.files['docProps/core.xml']) {
      let coreXml = await zip.files['docProps/core.xml'].async('string');
      const fields = options.selectedMetadata.length > 0 ? options.selectedMetadata : ['author', 'lastModifiedBy', 'company', 'manager'];
      const tagMap: Record<string, string> = { author: 'dc:creator', lastModifiedBy: 'cp:lastModifiedBy', title: 'dc:title' };
      for (const field of fields) {
        const tag = tagMap[field];
        if (tag) coreXml = coreXml.replace(new RegExp('<' + tag + '>[^<]*<\/' + tag + '>', 'g'), '<' + tag + '></' + tag + '>');
      }
      zip.file('docProps/core.xml', coreXml);
      operations.push('Metadata cleaned');
      removedItems++;
    }
    if (zip.files['docProps/app.xml']) {
      let appXml = await zip.files['docProps/app.xml'].async('string');
      appXml = appXml.replace(/<Company>[^<]*<\/Company>/g, '<Company></Company>');
      appXml = appXml.replace(/<Manager>[^<]*<\/Manager>/g, '<Manager></Manager>');
      zip.file('docProps/app.xml', appXml);
    }
  }

  if (options.removeComments && zip.files['word/comments.xml']) {
    zip.file('word/comments.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:comments xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"></w:comments>');
    operations.push('Comments removed');
    removedItems++;
  }

  if (options.acceptTrackChanges && zip.files['word/document.xml']) {
    let docXml = await zip.files['word/document.xml'].async('string');
    docXml = docXml.replace(/<w:del[\s\S]*?<\/w:del>/g, '');
    docXml = docXml.replace(/<w:ins([^>]*)>([\s\S]*?)<\/w:ins>/g, '$2');
    docXml = docXml.replace(/<w:rPrChange[\s\S]*?<\/w:rPrChange>/g, '');
    zip.file('word/document.xml', docXml);
    operations.push('Track changes accepted');
    removedItems++;
  }

  if (options.removeHiddenContent && zip.files['word/document.xml']) {
    let docXml = await zip.files['word/document.xml'].async('string');
    docXml = docXml.replace(/<w:r[^>]*>[\s\S]*?<w:vanish\/>[\s\S]*?<\/w:r>/g, '');
    zip.file('word/document.xml', docXml);
    operations.push('Hidden content removed');
    removedItems++;
  }

  if (options.correctSpelling && options.approvedSpellingErrors.length > 0 && zip.files['word/document.xml']) {
    let docXml = await zip.files['word/document.xml'].async('string');
    for (const c of options.approvedSpellingErrors) {
      if (c.error && c.correction) {
        const escaped = c.error.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        docXml = docXml.replace(new RegExp(escaped, 'g'), c.correction);
      }
    }
    zip.file('word/document.xml', docXml);
    operations.push('Spelling corrections applied: ' + options.approvedSpellingErrors.length);
  }

  if (options.sensitiveDataToClean && options.sensitiveDataToClean.length > 0 && zip.files['word/document.xml']) {
    let docXml = await zip.files['word/document.xml'].async('string');
    for (const item of options.sensitiveDataToClean) {
      if (item.value) {
        const escaped = item.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        docXml = docXml.replace(new RegExp(escaped, 'g'), '[REDACTED]');
      }
    }
    zip.file('word/document.xml', docXml);
    operations.push('Sensitive data redacted: ' + options.sensitiveDataToClean.length + ' items');
    removedItems += options.sensitiveDataToClean.length;
  }

  const originalText = parsedDoc.fullText || '';
  const buffer = Buffer.from(await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
  return { buffer, report: { operations, removedItems, originalText } };
}import JSZip from 'jszip';

export interface CleanerOptions {
  removeMetadata: boolean;
  removeComments: boolean;
  acceptTrackChanges: boolean;
  removeHiddenContent: boolean;
  removeEmbeddedObjects: boolean;
  removeMacros: boolean;
  removeVisualObjects: boolean;
  sensitiveDataToClean: any[];
  selectedComments: string[];
  selectedMetadata: string[];
  correctSpelling: boolean;
  approvedSpellingErrors: Array<{ id?: string; error: string; correction: string }>;
  aiRewritingEnabled: boolean;
  aiRewritingTone: 'consulting' | 'formal' | 'friendly';
}

export interface CleanResult {
  buffer: Buffer;
  report: { operations: string[]; removedItems: number; originalText?: string; };
}

export async function cleanDocx(originalBuffer: Buffer, parsedDoc: any, options: CleanerOptions): Promise<CleanResult> {
  const zip = await JSZip.loadAsync(originalBuffer);
  const operations: string[] = [];
  let removedItems = 0;

  if (options.removeMetadata) {
    if (zip.files['docProps/core.xml']) {
      let coreXml = await zip.files['docProps/core.xml'].async('string');
      const fields = options.selectedMetadata.length > 0 ? options.selectedMetadata : ['author', 'lastModifiedBy', 'company', 'manager'];
      const tagMap: Record<string, string> = { author: 'dc:creator', lastModifiedBy: 'cp:lastModifiedBy', title: 'dc:title' };
      for (const field of fields) {
        const tag = tagMap[field];
        if (tag) coreXml = coreXml.replace(new RegExp('<' + tag + '>[^<]*<\/' + tag + '>', 'g'), '<' + tag + '></' + tag + '>');
      }
      zip.file('docProps/core.xml', coreXml);
      operations.push('Metadata cleaned');
      removedItems++;
    }
    if (zip.files['docProps/app.xml']) {
      let appXml = await zip.files['docProps/app.xml'].async('string');
      appXml = appXml.replace(/<Company>[^<]*<\/Company>/g, '<Company></Company>');
      appXml = appXml.replace(/<Manager>[^<]*<\/Manager>/g, '<Manager></Manager>');
      zip.file('docProps/app.xml', appXml);
    }
  }

  if (options.removeComments && zip.files['word/comments.xml']) {
    zip.file('word/comments.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:comments xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"></w:comments>');
    operations.push('Comments removed');
    removedItems++;
  }

  if (options.acceptTrackChanges && zip.files['word/document.xml']) {
    let docXml = await zip.files['word/document.xml'].async('string');
    docXml = docXml.replace(/<w:del[\s\S]*?<\/w:del>/g, '');
    docXml = docXml.replace(/<w:ins([^>]*)>([\s\S]*?)<\/w:ins>/g, '$2');
    docXml = docXml.replace(/<w:rPrChange[\s\S]*?<\/w:rPrChange>/g, '');
    zip.file('word/document.xml', docXml);
    operations.push('Track changes accepted');
    removedItems++;
  }

  if (options.removeHiddenContent && zip.files['word/document.xml']) {
    let docXml = await zip.files['word/document.xml'].async('string');
    docXml = docXml.replace(/<w:r[^>]*>[\s\S]*?<w:vanish\/>[\s\S]*?<\/w:r>/g, '');
    zip.file('word/document.xml', docXml);
    operations.push('Hidden content removed');
    removedItems++;
  }

  if (options.correctSpelling && options.approvedSpellingErrors.length > 0 && zip.files['word/document.xml']) {
    let docXml = await zip.files['word/document.xml'].async('string');
    for (const c of options.approvedSpellingErrors) {
      if (c.error && c.correction) {
        const escaped = c.error.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        docXml = docXml.replace(new RegExp(escaped, 'g'), c.correction);
      }
    }
    zip.file('word/document.xml', docXml);
    operations.push('Spelling corrections applied: ' + options.approvedSpellingErrors.length);
  }

  if (options.sensitiveDataToClean && options.sensitiveDataToClean.length > 0 && zip.files['word/document.xml']) {
    let docXml = await zip.files['word/document.xml'].async('string');
    for (const item of options.sensitiveDataToClean) {
      if (item.value) {
        const escaped = item.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        docXml = docXml.replace(new RegExp(escaped, 'g'), '[REDACTED]');
      }
    }
    zip.file('word/document.xml', docXml);
    operations.push('Sensitive data redacted: ' + options.sensitiveDataToClean.length + ' items');
    removedItems += options.sensitiveDataToClean.length;
  }

  const originalText = parsedDoc.fullText || '';
  const buffer = Buffer.from(await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
  return { buffer, report: { operations, removedItems, originalText } };
}
