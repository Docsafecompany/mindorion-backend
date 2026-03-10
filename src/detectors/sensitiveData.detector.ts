export interface SensitiveDataItem {
  type: string;
  value: string;
  location: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'personal' | 'internal' | 'financial' | 'technical';
}

interface PatternDef {
  type: string;
  pattern: RegExp;
  severity: SensitiveDataItem['severity'];
  category: SensitiveDataItem['category'];
  mask?: boolean;
}

const SENSITIVE_PATTERNS: PatternDef[] = [
  {
    type: 'email',
    pattern: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g,
    severity: 'high',
    category: 'personal',
  },
  {
    type: 'phone',
    pattern: /(\+?[0-9]{1,3}[\s.-]?)?(\(?[0-9]{2,4}\)?[\s.-]?){2,4}[0-9]{2,4}/g,
    severity: 'high',
    category: 'personal',
  },
  {
    type: 'iban',
    pattern: /\b[A-Z]{2}\d{2}[A-Z0-9]{4,30}\b/g,
    severity: 'critical',
    category: 'financial',
  },
  {
    type: 'ip_address',
    pattern: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
    severity: 'medium',
    category: 'technical',
  },
  {
    type: 'file_path_windows',
    pattern: /[A-Za-z]:\\[\\\w\s.\-]+/g,
    severity: 'high',
    category: 'internal',
  },
  {
    type: 'file_path_unix',
    pattern: /\/home\/[\w\s\/.\_\-]+|\/var\/[\w\/.\_\-]+|\/etc\/[\w\/.\_\-]+/g,
    severity: 'high',
    category: 'internal',
  },
  {
    type: 'unc_path',
    pattern: /\\\\[\w\-]+\\[\w\-\\]+/g,
    severity: 'critical',
    category: 'internal',
  },
  {
    type: 'ssn',
    pattern: /\b\d{3}[\-\s]?\d{2}[\-\s]?\d{4}\b/g,
    severity: 'critical',
    category: 'personal',
  },
  {
    type: 'credit_card',
    pattern: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|6(?:011|5[0-9]{2})[0-9]{12})\b/g,
    severity: 'critical',
    category: 'financial',
    mask: true,
  },
  {
    type: 'currency_amount',
    pattern: /[€$£¥][\s]?[0-9]{1,3}(?:[\s,][0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]{1,3}(?:[\s,][0-9]{3})*(?:\.[0-9]{1,2})?[\s]?[€$£¥]/g,
    severity: 'medium',
    category: 'financial',
  },
  {
    type: 'confidential_keyword',
    pattern: /\b(?:confidentiel|confidential|internal use only|draft|ne pas diffuser|do not distribute|proprietary|restricted|secret)\b/gi,
    severity: 'critical',
    category: 'internal',
  },
];

// Luhn algorithm for credit card validation
function luhnCheck(num: string): boolean {
  const digits = num.replace(/\D/g, '').split('').map(Number).reverse();
  const sum = digits.reduce((acc, digit, idx) => {
    if (idx % 2 === 1) {
      const doubled = digit * 2;
      return acc + (doubled > 9 ? doubled - 9 : doubled);
    }
    return acc + digit;
  }, 0);
  return sum % 10 === 0;
}

export async function detectSensitiveData(text: string): Promise<SensitiveDataItem[]> {
  const items: SensitiveDataItem[] = [];
  const seen = new Set<string>();

  for (const patternDef of SENSITIVE_PATTERNS) {
    const regex = new RegExp(patternDef.pattern.source, patternDef.pattern.flags);
    let match;
    
    while ((match = regex.exec(text)) !== null) {
      const value = match[0].trim();
      
      if (!value || value.length < 3) continue;
      
      // Skip if already detected
      const key = patternDef.type + ':' + value;
      if (seen.has(key)) continue;
      seen.add(key);
      
      // Validate credit cards with Luhn
      if (patternDef.type === 'credit_card') {
        const cleaned = value.replace(/\D/g, '');
        if (!luhnCheck(cleaned)) continue;
      }
      
      // Get context
      const start = Math.max(0, match.index - 30);
      const end = Math.min(text.length, match.index + value.length + 30);
      const context = text.substring(start, end).replace(/\s+/g, ' ');
      
      items.push({
        type: patternDef.type,
        value: patternDef.mask ? value.replace(/./g, '*').slice(0, -4) + value.slice(-4) : value,
        location: context,
        severity: patternDef.severity,
        category: patternDef.category,
      });
    }
  }

  return items;
}
