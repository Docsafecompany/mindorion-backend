export interface MacroItem {
  name: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  location: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
}

const MACRO_ENABLED_EXTENSIONS = {
  'xlsm': 'Excel Macro-Enabled Workbook',
  'xlsb': 'Excel Binary Workbook (may contain macros)',
  'docm': 'Word Macro-Enabled Document',
  'pptm': 'PowerPoint Macro-Enabled Presentation',
  'dotm': 'Word Macro-Enabled Template',
  'xltm': 'Excel Macro-Enabled Template',
  'potm': 'PowerPoint Macro-Enabled Template',
};

export async function detectMacros(parsedDoc: any, fileType: string, fileName: string): Promise<MacroItem[]> {
  const macros: MacroItem[] = [];
  
  // Check file extension for macro-enabled formats
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  
  if (ext in MACRO_ENABLED_EXTENSIONS) {
    macros.push({
      name: 'Macro-Enabled Format',
      riskLevel: 'high',
      location: 'File Format',
      severity: 'high',
      description: MACRO_ENABLED_EXTENSIONS[ext as keyof typeof MACRO_ENABLED_EXTENSIONS] + ' - may contain executable VBA code',
    });
  }

  // Check for VBA project in ZIP
  const zip = parsedDoc.zip;
  if (zip) {
    const vbaFiles = Object.keys(zip.files).filter(f => 
      f.toLowerCase().includes('vbaproject') || 
      f.toLowerCase().endsWith('.bas') ||
      f.toLowerCase().endsWith('.cls') ||
      f.toLowerCase().endsWith('.frm')
    );
    
    for (const vf of vbaFiles) {
      macros.push({
        name: vf.split('/').pop() || vf,
        riskLevel: 'critical',
        location: vf,
        severity: 'critical',
        description: 'VBA project file detected - contains executable macro code',
      });
    }
  }

  // Check XML for macro references
  const rawXml = parsedDoc.rawXml || {};
  const allXml = Object.values(rawXml).join('');
  
  if (allXml.includes('vba') || allXml.includes('VBA') || allXml.includes('macro') || allXml.includes('Macro')) {
    if (!macros.some(m => m.riskLevel === 'critical')) {
      macros.push({
        name: 'Macro Reference',
        riskLevel: 'medium',
        location: 'Document XML',
        severity: 'medium',
        description: 'References to VBA or macros found in document structure',
      });
    }
  }

  return macros;
}
