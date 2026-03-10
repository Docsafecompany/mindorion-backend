export interface DocFieldItem {
  fieldType: string;
  fieldCode: string;
  displayValue: string;
  location: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

const SENSITIVE_FIELD_TYPES = ['AUTHOR', 'FILENAME', 'FILESIZE', 'DATE', 'TIME', 'LASTSAVEDBY', 'REVNUM', 'USERINITIALS', 'USERNAME'];
const REFERENCE_FIELD_TYPES = ['REF', 'HYPERLINK', 'INCLUDETEXT', 'INCLUDEPICTURE', 'LINK', 'IF', 'COMPARE'];

export async function detectDocFields(parsedDoc: any, fileType: string): Promise<DocFieldItem[]> {
  if (fileType !== 'docx') return [];
  
  const items: DocFieldItem[] = [];
  const rawXml = parsedDoc.rawXml || {};
  const docXml = rawXml['word/document.xml'] || '';
  
  if (!docXml) return items;

  // Find field codes: <w:fldChar> and <w:instrText>
  const fieldCodeRegex = /<w:instrText[^>]*>([^<]+)<\/w:instrText>/g;
  let match;
  
  while ((match = fieldCodeRegex.exec(docXml)) !== null) {
    const fieldCode = match[1].trim();
    const fieldType = fieldCode.split(/\s+/)[0].toUpperCase();
    
    let severity: DocFieldItem['severity'] = 'low';
    
    if (SENSITIVE_FIELD_TYPES.includes(fieldType)) {
      severity = 'high';
    } else if (REFERENCE_FIELD_TYPES.includes(fieldType)) {
      severity = 'medium';
    }
    
    // Check for file path in field code
    if (fieldCode.match(/[A-Za-z]:\\/)) {
      severity = 'critical';
    }
    
    items.push({
      fieldType,
      fieldCode,
      displayValue: '',
      location: 'Document',
      severity,
    });
  }

  // Also find simple field chars
  const simpleFldRegex = /<w:fldChar[^>]*w:fldCharType="begin"[^>]*\/>/g;
  
  // Count simple field occurrences
  const fldCharCount = (docXml.match(/<w:fldChar/g) || []).length;
  
  // Detect DATE and TIME fields via <w:date> elements
  const dateFieldMatches = docXml.match(/<w:date[\s>]/g) || [];
  if (dateFieldMatches.length > 0 && !items.some(i => i.fieldType === 'DATE')) {
    items.push({
      fieldType: 'DATE',
      fieldCode: 'DATE (content control)',
      displayValue: '',
      location: 'Document',
      severity: 'medium',
    });
  }

  return items;
}
