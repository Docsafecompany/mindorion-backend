import JSZip from 'jszip';
import { CleanerOptions, CleanResult } from './docx.cleaner';

export async function cleanPptx(originalBuffer: Buffer, parsedDoc: any, options: CleanerOptions): Promise<CleanResult> {
  const zip = await JSZip.loadAsync(originalBuffer);
  const operations: string[] = [];
  let removedItems = 0;

  if (options.removeMetadata) {
    if (zip.files['docProps/core.xml']) {
      let coreXml = await zip.files['docProps/core.xml'].async('string');
      coreXml = coreXml.replace(/<dc:creator>[^<]*<\/dc:creator>/g, '<dc:creator></dc:creator>');
      coreXml = coreXml.replace(/<cp:lastModifiedBy>[^<]*<\/cp:lastModifiedBy>/g, '<cp:lastModifiedBy></cp:lastModifiedBy>');
      zip.file('docProps/core.xml', coreXml);
      operations.push('Metadata cleaned');
      removedItems++;
    }
  }

  if (options.removeComments) {
    const commentFiles = Object.keys(zip.files).filter(f => f.startsWith('ppt/comments/'));
    for (const cf of commentFiles) {
      zip.remove(cf);
    }
    if (commentFiles.length > 0) {
      operations.push('Speaker notes/comments removed: ' + commentFiles.length);
      removedItems += commentFiles.length;
    }
  }

  // Remove speaker notes
  if (options.removeHiddenContent) {
    const notesFiles = Object.keys(zip.files).filter(f => f.match(/^ppt\/notesSlides\/notesSlide\d+\.xml$/));
    for (const nf of notesFiles) {
      const content = await zip.files[nf].async('string');
      // Clear the text content but keep the structure
      const cleared = content.replace(/<a:t>[^<]*<\/a:t>/g, '<a:t></a:t>');
      zip.file(nf, cleared);
    }
    if (notesFiles.length > 0) {
      operations.push('Speaker notes cleared: ' + notesFiles.length + ' slides');
      removedItems += notesFiles.length;
    }
  }

  if (options.sensitiveDataToClean && options.sensitiveDataToClean.length > 0) {
    const slideFiles = Object.keys(zip.files).filter(f => f.match(/^ppt\/slides\/slide\d+\.xml$/));
    for (const sf of slideFiles) {
      let slideXml = await zip.files[sf].async('string');
      for (const item of options.sensitiveDataToClean) {
        if (item.value) {
          const escaped = item.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          slideXml = slideXml.replace(new RegExp(escaped, 'g'), '[REDACTED]');
        }
      }
      zip.file(sf, slideXml);
    }
    operations.push('Sensitive data redacted');
    removedItems += options.sensitiveDataToClean.length;
  }

  const originalText = parsedDoc.fullText || '';
  const buffer = Buffer.from(await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
  return { buffer, report: { operations, removedItems, originalText } };
}
