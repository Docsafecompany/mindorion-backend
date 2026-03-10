export interface MetadataItem {
  field: string;
  value: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  location: string;
}

const SENSITIVE_METADATA_FIELDS = [
  'author', 'lastModifiedBy', 'company', 'manager', 'creator',
  'producer', 'title', 'subject', 'keywords', 'template',
];

const HIGH_RISK_FIELDS = ['author', 'lastModifiedBy', 'company', 'manager', 'creator', 'producer'];

export async function detectMetadata(parsedDoc: any, fileType: string): Promise<MetadataItem[]> {
  const items: MetadataItem[] = [];

  const addField = (field: string, value: string, source: string) => {
    if (!value || value.trim() === '') return;
    const severity: MetadataItem['severity'] = HIGH_RISK_FIELDS.includes(field) ? 'high' : 'medium';
    items.push({
      field,
      value: value.trim(),
      severity,
      category: 'metadata',
      location: source,
    });
  };

  // Core metadata
  const meta = parsedDoc.metadata || {};
  Object.entries(meta).forEach(([k, v]) => {
    if (v && typeof v === 'string') addField(k, v, 'Document Properties');
  });

  // App metadata
  const appMeta = parsedDoc.appMetadata || {};
  Object.entries(appMeta).forEach(([k, v]) => {
    if (v && typeof v === 'string') addField(k, v, 'Application Properties');
  });

  // XLSX: add sheet names as potentially revealing info
  if (fileType === 'xlsx' || fileType === 'xls') {
    const sheetNames = parsedDoc.sheetNames || [];
    sheetNames.forEach((name: string, i: number) => {
      if (name && name !== 'Sheet' + (i + 1) && name.toLowerCase() !== 'sheet1' && name.toLowerCase() !== 'sheet2') {
        items.push({
          field: 'sheetName',
          value: name,
          severity: 'low',
          category: 'metadata',
          location: 'Workbook',
        });
      }
    });
  }

  return items;
}
