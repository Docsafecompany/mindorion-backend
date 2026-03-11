import JSZip from 'jszip';
import { CleanerOptions, CleanResult } from './docx.cleaner';

export async function cleanPptx(originalBuffer: Buffer, parsedDoc: any, options: CleanerOptions): Promise<CleanResult> {
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
                coreXml = coreXml.replace(/<dc:subject>[^<]*<\/dc:subject>/g, '<dc:subject></dc:subject>');
                coreXml = coreXml.replace(/<cp:keywords>[^<]*<\/cp:keywords>/g, '<cp:keywords></cp:keywords>');
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

  // --- Comments ---
  if (options.removeComments) {
        const commentFiles = Object.keys(zip.files).filter(f => f.startsWith('ppt/comments/'));

      if (options.selectedComments.length > 0 && commentFiles.length > 0) {
              // Selective removal: filter by comment ID
          for (const cf of commentFiles) {
                    let xml = await zip.files[cf].async('string');
                    for (const commentId of options.selectedComments) {
                                const escaped = commentId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                                xml = xml.replace(
                                              new RegExp('<p:cm\\b[^>]*w:id="' + escaped + '"[\\s\\S]*?<\\/p:cm>', 'g'),
                                              ''
                                            );
                    }
                    zip.file(cf, xml);
          }
              operations.push('Selected comments removed: ' + options.selectedComments.length);
              removedItems += options.selectedComments.length;
      } else if (commentFiles.length > 0) {
              // Remove all comment files
          for (const cf of commentFiles) {
                    zip.remove(cf);
          }
              operations.push('Comments removed: ' + commentFiles.length);
              removedItems += commentFiles.length;
      }
  }

  // --- Speaker notes (hidden content) ---
  if (options.removeHiddenContent) {
        const notesFiles = Object.keys(zip.files).filter(f =>
                f.match(/^ppt\/notesSlides\/notesSlide\d+\.xml$/)
                                                             );

      const shouldClearNotes =
              options.hiddenContentToClean.length === 0 ||
              options.hiddenContentToClean.some((i: any) => (i.type || i) === 'speaker_notes');

      if (shouldClearNotes && notesFiles.length > 0) {
              for (const nf of notesFiles) {
                        const content = await zip.files[nf].async('string');
                        const cleared = content.replace(/<a:t>[^<]*<\/a:t>/g, '<a:t></a:t>');
                        zip.file(nf, cleared);
              }
              operations.push('Speaker notes cleared: ' + notesFiles.length + ' slides');
              removedItems += notesFiles.length;
      }

      // Hidden slides: unhide them (remove show="0")
      const shouldUnhideSlides =
              options.hiddenContentToClean.length === 0 ||
              options.hiddenContentToClean.some((i: any) => (i.type || i) === 'hidden_slide');

      if (shouldUnhideSlides && zip.files['ppt/presentation.xml']) {
              let presXml = await zip.files['ppt/presentation.xml'].async('string');
              const before = presXml;
              presXml = presXml.replace(/\bshow="0"/g, '');
              if (presXml !== before) {
                        zip.file('ppt/presentation.xml', presXml);
                        operations.push('Hidden slides unhidden');
                        removedItems++;
              }
      }
  }

  // --- Sensitive data redaction ---
  if (options.sensitiveDataToClean && options.sensitiveDataToClean.length > 0) {
        const slideFiles = Object.keys(zip.files).filter(f => f.match(/^ppt\/slides\/slide\d+\.xml$/));
        let redacted = 0;
        for (const sf of slideFiles) {
                let slideXml = await zip.files[sf].async('string');
                for (const item of options.sensitiveDataToClean) {
                          if (item.value) {
                                      const escaped = item.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                                      const before = slideXml;
                                      slideXml = slideXml.replace(new RegExp(escaped, 'g'), '[REDACTED]');
                                      if (slideXml !== before) redacted++;
                          }
                }
                zip.file(sf, slideXml);
        }
        if (redacted > 0) {
                operations.push('Sensitive data redacted: ' + redacted + ' items');
                removedItems += redacted;
        }
  }

  // --- Spelling corrections ---
  if (options.correctSpelling && options.approvedSpellingErrors.length > 0) {
        const slideFiles = Object.keys(zip.files).filter(f => f.match(/^ppt\/slides\/slide\d+\.xml$/));
        let corrected = 0;
        for (const sf of slideFiles) {
                let slideXml = await zip.files[sf].async('string');
                for (const c of options.approvedSpellingErrors) {
                          if (c.error && c.correction && c.error !== c.correction) {
                                      const escaped = c.error.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                                      const before = slideXml;
                                      slideXml = slideXml.replace(new RegExp(escaped, 'g'), c.correction);
                                      if (slideXml !== before) corrected++;
                          }
                }
                zip.file(sf, slideXml);
        }
        if (corrected > 0) {
                operations.push('Spelling corrections applied: ' + corrected);
        }
  }

  const originalText = parsedDoc.fullText || '';
    const buffer = Buffer.from(await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));

  return { buffer, report: { operations, removedItems, originalText } };
}
