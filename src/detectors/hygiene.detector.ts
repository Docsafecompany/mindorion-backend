export interface HygieneItem {
  type: string;
  value: string;
  location: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  suggestion?: string;
}

const PLACEHOLDER_PATTERNS = [
  /\b(TODO|FIXME|HACK|XXX|TBD|WIP)\b/g,
  /\[INSERT[^\]]*\]/gi,
  /\[YOUR\s+[^\]]*\]/gi,
  /\[PLACEHOLDER[^\]]*\]/gi,
  /\[DATE[^\]]*\]/gi,
  /\[NAME[^\]]*\]/gi,
  /\[COMPANY[^\]]*\]/gi,
  /\[CONTACT[^\]]*\]/gi,
  /\?\?\?+/g,
  /Lorem ipsum/gi,
];

const GARBLED_PATTERN = /\b[bcdfghjklmnpqrstvwxyz]{4,}\b/gi;
const FRAGMENTED_WORD_PATTERN = /\b([a-zA-Z]{1,3})\s+([a-zA-Z]{1,3})\b(?=\s+[a-zA-Z])/g;
const REPEATED_SPACES = /\w\s{2,}\w/g;

export async function detectHygiene(text: string): Promise<HygieneItem[]> {
  const items: HygieneItem[] = [];
  const seen = new Set<string>();

  const addItem = (type: string, value: string, context: string, severity: HygieneItem['severity'], suggestion?: string) => {
    const key = type + ':' + value;
    if (seen.has(key)) return;
    seen.add(key);
    items.push({ type, value, location: context, severity, suggestion });
  };

  // Detect placeholders
  for (const pattern of PLACEHOLDER_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(text)) !== null) {
      const start = Math.max(0, match.index - 20);
      const end = Math.min(text.length, match.index + match[0].length + 20);
      const context = text.substring(start, end).replace(/\s+/g, ' ');
      addItem('placeholder', match[0], context, 'high', 'Replace placeholder with actual content');
    }
  }

  // Detect garbled text clusters (4+ consecutive consonants)
  const garbledRegex = new RegExp(GARBLED_PATTERN.source, GARBLED_PATTERN.flags);
  const commonWords = new Set(['strength', 'through', 'throughout', 'brought', 'thought', 'rhythms', 'sphinx', 'crwth', 'lymph', 'glyph']);
  let match;
  while ((match = garbledRegex.exec(text)) !== null) {
    const word = match[0].toLowerCase();
    if (commonWords.has(word) || word.length < 4) continue;
    
    const start = Math.max(0, match.index - 20);
    const context = text.substring(start, start + 60).replace(/\s+/g, ' ');
    addItem('garbled_text', match[0], context, 'medium', 'Check if this is a typo or encoding error');
  }

  // Detect fragmented words (letter + space + letter pattern that looks broken)
  const fragRegex = /\b([a-zA-Z])\s([a-zA-Z])\s([a-zA-Z]+)\b/g;
  while ((match = fragRegex.exec(text)) !== null) {
    const fragment = match[0];
    const merged = fragment.replace(/\s/g, '');
    const start = Math.max(0, match.index - 20);
    const context = text.substring(start, start + 60).replace(/\s+/g, ' ');
    addItem('fragmented_word', fragment, context, 'high', 'Possible fragmented word: "' + merged + '"');
  }

  // Detect repeated spaces within what might be a single word
  const repeatedSpaceRegex = /\b(\w+)\s{2,}(\w+)\b/g;
  while ((match = repeatedSpaceRegex.exec(text)) !== null) {
    const start = Math.max(0, match.index - 20);
    const context = text.substring(start, start + 60).replace(/  +/g, ' ');
    addItem('repeated_spaces', match[0], context, 'low', 'Multiple spaces detected');
  }

  // Detect orphan lines (very short isolated lines)
  const lines = text.split(/\n/);
  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (trimmed.length > 0 && trimmed.length < 10 && trimmed.length > 1) {
      const prevLine = i > 0 ? lines[i-1].trim() : '';
      const nextLine = i < lines.length - 1 ? lines[i+1].trim() : '';
      if (prevLine === '' && nextLine === '') {
        addItem('orphan_line', trimmed, 'Line ' + (i + 1), 'low', 'Very short isolated line - may be a formatting artifact');
      }
    }
  });

  return items;
}
