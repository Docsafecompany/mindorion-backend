import JSZip from 'jszip';
import { CleanerOptions, CleanResult } from './docx.cleaner';

export async function cleanXlsx(originalBuffer: Buffer, parsedDoc: any, options: CleanerOptions): Promise<CleanResult> {
    const zip = await JSZip.loadAsync(originalBuffer);
    const operations: string[] = [];
    let removedItems = 0;

  // --- Metadata ---
  if (options.removeMetadata) {
        if (zip.files['docProps/core.xml']) {
                let coreXml = await zip.files['docProps/core.xml'].async('string');
                coreXml = coreXml.replace(/<dc:creator>[^<]*<\/dc:creator>/g, '<dc:creator></dc:creator>');
                coreXml = coreXml.replace(/<cp:lastModifiedBy>[^<]*<\/cp:lastModifiedBy>/g, '<cp:lastModifiedBy></cp:lastModifiedBy>');
                coreXml = coreXml.replace(/<dc:title>[^<]*<\/dc:title>/g, '<dc:title></dc:title>');
                coreXml = coreXml.replace(/<cp:keywords>[^<]*<\/cp:keywords>/g, '<cp:keywords></cp:keywords>');
                zip.file('docProps/core.xml', coreXml);
        }
        if (zip.files['docProps/app.xml']) {
                let appXml = await zip.files['docProps/app.xml'].async('string');
                appXml = appXml.replace(/<Company>[^<]*<\/Company>/g, '<Company></Company>');
                appXml = appXml.replace(/<Manager>[^<]*<\/Manager>/g, '<Manager></Manager>');
                zip.file('docProps/app.xml', appXml);
        }
        operations.push('Metadata cleaned');
        removedItems++;
  }

  // --- Comments ---
  if (options.removeComments) {
        const commentFiles = Object.keys(zip.files).filter(f =>
                f.match(/^xl\/comments\d*\.xml$/) || f.startsWith('xl/comments/')
                                                               );

      if (options.selectedComments.length > 0 && commentFiles.length > 0) {
              // Selective: remove by comment ID / cell ref
          for (const cf of commentFiles) {
                    let xml = await zip.files[cf].async('string');
                    for (const commentId of options.selectedComments) {
                                const escaped = commentId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                                // Match by ref attribute or authorId
                      xml = xml.replace(
                                    new RegExp('<comment[^>]*ref="' + escaped + '"[\\s\\S]*?<\\/comment>', 'g'),
                                    ''
                                  );
                    }
                    zip.file(cf, xml);
          }
              operations.push('Selected comments removed: ' + options.selectedComments.length);
              removedItems += options.selectedComments.length;
      } else if (commentFiles.length > 0) {
              // Clear all comment text
          for (const cf of commentFiles) {
                    let commentsXml = await zip.files[cf].async('string');
                    commentsXml = commentsXml.replace(/<commentList>[\s\S]*?<\/commentList>/g, '<commentList></commentList>');
                    zip.file(cf, commentsXml);
          }
              operations.push('Comments removed');
              removedItems++;
      }
  }

  // --- Hidden content ---
  if (options.removeHiddenContent) {
        // Hidden sheets
      const shouldUnhideSheets =
              options.hiddenContentToClean.length === 0 ||
              options.hiddenContentToClean.some((i: any) => (i.type || i) === 'hidden_sheet');

      if (shouldUnhideSheets && zip.files['xl/workbook.xml']) {
              let wbXml = await zip.files['xl/workbook.xml'].async('string');
              const before = wbXml;
              wbXml = wbXml.replace(/\bstate="hidden"/g, '');
              wbXml = wbXml.replace(/\bstate="veryHidden"/g, '');
              if (wbXml !== before) {
                        zip.file('xl/workbook.xml', wbXml);
                        operations.push('Hidden sheets unhidden');
                        removedItems++;
              }
      }

      // Hidden rows
      const shouldUnhideRows =
              options.hiddenContentToClean.length === 0 ||
              options.hiddenContentToClean.some((i: any) => (i.type || i) === 'hidden_row');

      // Hidden columns
      const shouldUnhideCols =
              options.hiddenContentToClean.length === 0 ||
              options.hiddenContentToClean.some((i: any) => (i.type || i) === 'hidden_column');

      if (shouldUnhideRows || shouldUnhideCols) {
              const sheetFiles = Object.keys(zip.files).filter(f => f.match(/^xl\/worksheets\/sheet\d+\.xml$/));
              for (const sf of sheetFiles) {
                        let sheetXml = await zip.files[sf].async('string');
                        const before = sheetXml;
                        if (shouldUnhideRows) {
                                    sheetXml = sheetXml.replace(/(<row\b[^>]*)\bhidden="1"([^>]*>)/g, '$1$2');
                        }
                        if (shouldUnhideCols) {
                                    sheetXml = sheetXml.replace(/(<col\b[^>]*)\bhidden="1"([^>]*>)/g, '$1$2');
                        }
                        if (sheetXml !== before) {
                                    zip.file(sf, sheetXml);
                        }
              }
              if (shouldUnhideRows) { operations.push('Hidden rows unhidden'); removedItems++; }
              if (shouldUnhideCols) { operations.push('Hidden columns unhidden'); removedItems++; }
      }
  }

  // --- Sensitive data redaction ---
  if (options.sensitiveDataToClean && options.sensitiveDataToClean.length > 0) {
        const sheetFiles = Object.keys(zip.files).filter(f => f.match(/^xl\/worksheets\/sheet\d+\.xml$/));
        let redacted = 0;

      for (const sf of sheetFiles) {
              let sheetXml = await zip.files[sf].async('string');
              for (const item of options.sensitiveDataToClean) {
                        if (item.value) {
                                    const escaped = item.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                                    const before = sheetXml;
                                    sheetXml = sheetXml.replace(new RegExp(escaped, 'g'), '[REDACTED]');
                                    if (sheetXml !== before) redacted++;
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
                                    const before = ssXml;
                                    ssXml = ssXml.replace(new RegExp(escaped, 'g'), '[REDACTED]');
                                    if (ssXml !== before) redacted++;
                        }
              }
              zip.file('xl/sharedStrings.xml', ssXml);
      }

      if (redacted > 0) {
              operations.push('Sensitive data redacted: ' + redacted + ' items');
              removedItems += redacted;
      }
  }

  // --- Spelling corrections ---
  if (options.correctSpelling && options.approvedSpellingErrors.length > 0) {
        let corrected = 0;

      if (zip.files['xl/sharedStrings.xml']) {
              let ssXml = await zip.files['xl/sharedStrings.xml'].async('string');
              for (const c of options.approvedSpellingErrors) {
                        if (c.error && c.correction && c.error !== c.correction) {
                                    const escaped = c.error.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                                    const before = ssXml;
                                    ssXml = ssXml.replace(new RegExp(escaped, 'g'), c.correction);
                                    if (ssXml !== before) corrected++;
                        }
              }
              zip.file('xl/sharedStrings.xml', ssXml);
      }

      if (corrected > 0) {
              operations.push('Spelling corrections applied: ' + corrected);
      }
  }

  const originalText = parsedDoc.fullText || '';
    const buffer = Buffer.from(await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));

  return { buffer, report: { operations, removedItems, originalText } };
}
