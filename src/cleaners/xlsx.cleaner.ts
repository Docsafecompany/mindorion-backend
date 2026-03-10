import JSZip from 'jszip';
import { CleanerOptions, CleanResult } from './docx.cleaner';

export async function cleanXlsx(originalBuffer: Buffer, parsedDoc: any, options: CleanerOptions): Promise<CleanResult> {
  const zip = await JSZip.loadAsync(originalBuffer);
  const operations: string[] = [];
  let removedItems = 0;

  if (options.removeMetadata) {
    if (zip.files['docProps/core.xml']) {
      let coreXml = await zip.files['docProps/core.xml'].async('string');
      coreXml = coreXml.replace(/<dc:creator>[^<]*<\/dc:creator>/g, '<dc:creator></dc:creator>');
      coreXml = coreXml.replace(/<cp:lastModifiedBy>[^<]*<\/cp:lastModifiedBy>/g, '<cp:lastModifiedBy></cp:lastModifiedBy>');
      zip.file('docProps/core.xml', coreXml);
    }
    if (zip.files['docProps/app.xml']) {
      let appXml = await zip.files['docProps/app.xml'].async('string');
      appXml = appXml.replace(/<Company>[^<]*<\/Company>/g, '<Company></Company>');
      zip.file('docProps/app.xml', appXml);
    }
    operations.push('Metadata cleaned');
    removedItems++;
  }

  if (options.removeComments) {
    const commentFiles = Object.keys(zip.files).filter(f => f.match(/^xl\/comments/));
    for (const cf of commentFiles) {
      let commentsXml = await zip.files[cf].async('string');
      commentsXml = commentsXml.replace(/<commentList>[\s\S]*?<\/commentList>/g, '<commentList></commentList>');
      zip.file(cf, commentsXml);
    }
    if (commentFiles.length > 0) {
      operations.push('Comments removed');
      removedItems++;
    }
  }

  // Show hidden sheets
  if (options.removeHiddenContent && zip.files['xl/workbook.xml']) {
    let wbXml = await zip.files['xl/workbook.xml'].async('string');
    wbXml = wbXml.replace(/state="hidden"/g, '');
    wbXml = wbXml.replace(/state="veryHidden"/g, '');
    zip.file('xl/workbook.xml', wbXml);
    operations.push('Hidden sheets unhidden');
    removedItems++;
  }

  if (options.sensitiveDataToClean && options.sensitiveDataToClean.length > 0) {
    const sheetFiles = Object.keys(zip.files).filter(f => f.match(/^xl\/worksheets\/sheet\d+\.xml$/));
    for (const sf of sheetFiles) {
      let sheetXml = await zip.files[sf].async('string');
      for (const item of options.sensitiveDataToClean) {
        if (item.value) {
          const escaped = item.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          sheetXml = sheetXml.replace(new RegExp(escaped, 'g'), '[REDACTED]');
        }
      }
      zip.file(sf, sheetXml);
    }
    // Also check shared strings
    if (zip.files['xl/sharedStrings.xml']) {
      let ssXml = await zip.files['xl/sharedStrings.xml'].async('string');
      for (const item of options.sensitiveDataToClean) {
        if (item.value) {
          const escaped = item.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          ssXml = ssXml.replace(new RegExp(escaped, 'g'), '[REDACTED]');
        }
      }
      zip.file('xl/sharedStrings.xml', ssXml);
    }
    operations.push('Sensitive data redacted: ' + options.sensitiveDataToClean.length + ' items');
    removedItems += options.sensitiveDataToClean.length;
  }

  const originalText = parsedDoc.fullText || '';
  const buffer = Buffer.from(await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
  return { buffer, report: { operations, removedItems, originalText } };
}
