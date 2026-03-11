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
    approvedSpellingErrors: Array<{ id?: string; error: string; correction: string; contextBefore?: string; contextAfter?: string }>;
    aiRewritingEnabled: boolean;
    aiRewritingTone: 'consulting' | 'formal' | 'friendly';
}

export interface CleanResult {
    buffer: Buffer;
    report: {
      operations: string[];
      removedItems: number;
      originalText?: string;
    };
}

export async function cleanDocx(originalBuffer: Buffer, parsedDoc: any, options: CleanerOptions): Promise<CleanResult> {
    const zip = await JSZip.loadAsync(originalBuffer);
    const operations: string[] = [];
    let removedItems = 0;

  // --- Metadata ---
  if (options.removeMetadata) {
        if (zip.files['docProps/core.xml']) {
                let coreXml = await zip.files['docProps/core.xml'].async('string');
                const fieldsToClean = options.selectedMetadata.length > 0
                  ? options.selectedMetadata
                          : ['author', 'lastModifiedBy', 'title', 'subject', 'keywords'];

          const tagMap: Record<string, string> = {
                    author: 'dc:creator',
                    lastModifiedBy: 'cp:lastModifiedBy',
                    title: 'dc:title',
                    subject: 'dc:subject',
                    keywords: 'cp:keywords',
                    revision: 'cp:revision',
                    created: 'dcterms:created',
                    modified: 'dcterms:modified',
          };

          for (const field of fieldsToClean) {
                    const tag = tagMap[field];
                    if (tag) {
                                coreXml = coreXml.replace(
                                              new RegExp('<' + tag + '[^>]*>[^<]*<\\/' + tag + '>', 'g'),
                                              '<' + tag + '></' + tag + '>'
                                            );
                    }
          }
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
  if (options.removeComments && zip.files['word/comments.xml']) {
        if (options.selectedComments.length > 0) {
                // Selective removal: only remove comments with matching IDs
          let commentsXml = await zip.files['word/comments.xml'].async('string');
                let docXml = zip.files['word/document.xml']
                  ? await zip.files['word/document.xml'].async('string')
                          : null;

          for (const commentId of options.selectedComments) {
                    const escaped = commentId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    // Remove comment node
                  commentsXml = commentsXml.replace(
                              new RegExp('<w:comment[^>]*w:id="' + escaped + '"[^>]*>[\\s\\S]*?<\\/w:comment>', 'g'),
                              ''
                            );
                    // Remove comment range markers from document.xml
                  if (docXml) {
                              docXml = docXml.replace(
                                            new RegExp('<w:commentRangeStart[^>]*w:id="' + escaped + '"[^/]*/>', 'g'),
                                            ''
                                          );
                              docXml = docXml.replace(
                                            new RegExp('<w:commentRangeEnd[^>]*w:id="' + escaped + '"[^/]*/>', 'g'),
                                            ''
                                          );
                              docXml = docXml.replace(
                                            new RegExp('<w:commentReference[^>]*w:id="' + escaped + '"[^/]*/>', 'g'),
                                            ''
                                          );
                  }
          }
                zip.file('word/comments.xml', commentsXml);
                if (docXml) zip.file('word/document.xml', docXml);
                operations.push('Selected comments removed: ' + options.selectedComments.length);
                removedItems += options.selectedComments.length;
        } else {
                // Remove all comments
          zip.file(
                    'word/comments.xml',
                    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:comments xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"></w:comments>'
                  );
                operations.push('All comments removed');
                removedItems++;
        }
  }

  // --- Track changes ---
  if (options.acceptTrackChanges && zip.files['word/document.xml']) {
        let docXml = await zip.files['word/document.xml'].async('string');
        // Remove deleted content
      docXml = docXml.replace(/<w:del\b[\s\S]*?<\/w:del>/g, '');
        // Accept insertions (keep content, remove w:ins wrapper)
      docXml = docXml.replace(/<w:ins\b[^>]*>([\s\S]*?)<\/w:ins>/g, '$1');
        // Remove formatting change markers
      docXml = docXml.replace(/<w:rPrChange\b[\s\S]*?<\/w:rPrChange>/g, '');
        docXml = docXml.replace(/<w:pPrChange\b[\s\S]*?<\/w:pPrChange>/g, '');
        zip.file('word/document.xml', docXml);
        operations.push('Track changes accepted');
        removedItems++;
  }

  // --- Hidden content ---
  if (options.removeHiddenContent && zip.files['word/document.xml']) {
        let docXml = await zip.files['word/document.xml'].async('string');

      if (options.hiddenContentToClean.length > 0) {
              // Selective: only remove specified hidden content types
          const types = options.hiddenContentToClean.map((i: any) => i.type || i);
              if (types.includes('vanished_text') || types.includes('hidden_text')) {
                        // Remove runs containing <w:vanish/>
                docXml = docXml.replace(/<w:r\b[^>]*>(?:(?!<\/w:r>)[\s\S])*<w:vanish\/>(?:(?!<\/w:r>)[\s\S])*<\/w:r>/g, '');
              }
              if (types.includes('white_text')) {
                        // Neutralize white text color
                docXml = docXml.replace(/<w:color w:val="FFFFFF"\/>/g, '');
              }
      } else {
              // Remove all hidden text
          docXml = docXml.replace(/<w:r\b[^>]*>(?:(?!<\/w:r>)[\s\S])*<w:vanish\/>(?:(?!<\/w:r>)[\s\S])*<\/w:r>/g, '');
              docXml = docXml.replace(/<w:color w:val="FFFFFF"\/>/g, '');
      }

      zip.file('word/document.xml', docXml);
        operations.push('Hidden content removed');
        removedItems++;
  }

  // --- Spelling corrections ---
  if (options.correctSpelling && options.approvedSpellingErrors.length > 0 && zip.files['word/document.xml']) {
        let docXml = await zip.files['word/document.xml'].async('string');
        let corrected = 0;
        for (const c of options.approvedSpellingErrors) {
                if (c.error && c.correction && c.error !== c.correction) {
                          const escaped = c.error.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                          const before = docXml;
                          docXml = docXml.replace(new RegExp(escaped, 'g'), c.correction);
                          if (docXml !== before) corrected++;
                }
        }
        zip.file('word/document.xml', docXml);
        if (corrected > 0) {
                operations.push('Spelling corrections applied: ' + corrected);
        }
  }

  // --- Sensitive data redaction ---
  if (options.sensitiveDataToClean && options.sensitiveDataToClean.length > 0 && zip.files['word/document.xml']) {
        let docXml = await zip.files['word/document.xml'].async('string');
        let redacted = 0;
        for (const item of options.sensitiveDataToClean) {
                if (item.value) {
                          const escaped = item.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                          const before = docXml;
                          docXml = docXml.replace(new RegExp(escaped, 'g'), '[REDACTED]');
                          if (docXml !== before) redacted++;
                }
        }
        zip.file('word/document.xml', docXml);
        operations.push('Sensitive data redacted: ' + redacted + ' items');
        removedItems += redacted;
  }

  // --- Embedded objects ---
  if (options.removeEmbeddedObjects) {
        const embedFiles = Object.keys(zip.files).filter(f => f.startsWith('word/embeddings/'));
        for (const f of embedFiles) {
                zip.remove(f);
        }
        if (embedFiles.length > 0) {
                operations.push('Embedded objects removed: ' + embedFiles.length);
                removedItems += embedFiles.length;
        }
  }

  const originalText = parsedDoc.fullText || '';
    const buffer = Buffer.from(await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));

  return { buffer, report: { operations, removedItems, originalText } };
}
