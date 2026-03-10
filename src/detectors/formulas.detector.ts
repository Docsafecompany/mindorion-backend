export interface FormulaItem {
  sheet: string;
  cell: string;
  formula: string;
  risk: 'low' | 'medium' | 'high' | 'critical';
  reason: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

const RISKY_FORMULA_PATTERNS = [
  {
    pattern: /\[([^\]]+\.xl[sx][xmb]?)\]/gi,
    risk: 'critical' as const,
    reason: 'Formula references external workbook file',
  },
  {
    pattern: /[A-Za-z]:\\/g,
    risk: 'high' as const,
    reason: 'Formula contains absolute Windows file path',
  },
  {
    pattern: /\/home\/|\/var\/|\/etc\//g,
    risk: 'high' as const,
    reason: 'Formula contains Unix file path',
  },
  {
    pattern: /\\\\[\w\-]+\\/g,
    risk: 'critical' as const,
    reason: 'Formula contains UNC network path',
  },
  {
    pattern: /\bINDIRECT\s*\(/gi,
    risk: 'medium' as const,
    reason: 'INDIRECT function can reference external data dynamically',
  },
  {
    pattern: /\bOFFSET\s*\([^)]*,[^)]*,[^)]*,[^)]*,[^)]*\)/gi,
    risk: 'low' as const,
    reason: 'OFFSET with 5 arguments can reference dynamic ranges',
  },
  {
    pattern: /\bHYPERLINK\s*\("http/gi,
    risk: 'medium' as const,
    reason: 'HYPERLINK formula with external URL',
  },
];

export async function detectFormulas(parsedDoc: any, fileType: string): Promise<FormulaItem[]> {
  if (fileType !== 'xlsx' && fileType !== 'xls') return [];
  
  const items: FormulaItem[] = [];
  const sheetData = parsedDoc.sheetData || [];
  
  for (const sheet of sheetData) {
    for (const formula of (sheet.formulas || [])) {
      for (const patternDef of RISKY_FORMULA_PATTERNS) {
        if (patternDef.pattern.test(formula)) {
          items.push({
            sheet: sheet.name,
            cell: 'Unknown',
            formula,
            risk: patternDef.risk,
            reason: patternDef.reason,
            severity: patternDef.risk,
          });
          break; // Only flag once per formula
        }
      }
    }
  }
  
  // Also check raw XML for external references
  const rawXml = parsedDoc.rawXml || {};
  if (rawXml['xl/externalLinks/externalLink1.xml']) {
    items.push({
      sheet: 'Workbook',
      cell: 'External Links',
      formula: 'External workbook link detected',
      risk: 'critical',
      reason: 'Workbook has external link connections to other files',
      severity: 'critical',
    });
  }
  
  return items;
}
