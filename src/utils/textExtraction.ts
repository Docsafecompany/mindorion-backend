—/**
 * Text extraction utilities for document content analysis
 */

/**
 * Truncate text to maximum token-safe length for Claude API
 * Approximately 4 chars per token, so 80000 chars ~ 20000 tokens
 */
export function truncateForAI(text: string, maxChars = 80000): string {
  if (text.length <= maxChars) return text;
  return text.substring(0, maxChars) + '...[TRUNCATED: ' + (text.length - maxChars) + ' chars omitted]';
}

/**
 * Clean and normalize text extracted from documents
 */
export function normalizeText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/ {3,}/g, '  ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Detect language from text (basic heuristic)
 */
export function detectLanguage(text: string): 'fr' | 'en' {
  const sample = text.substring(0, 2000).toLowerCase();
  
  // French indicators
  const frWords = ['le ', 'la ', 'les ', 'de ', 'du ', 'des ', 'et ', 'en ', 'un ', 'une ', 'pour ', 'dans ', 'est ', 'sont ', 'nous ', 'vous ', 'avec ', 'sur ', 'par '];
  const enWords = ['the ', 'is ', 'are ', 'and ', 'or ', 'to ', 'of ', 'in ', 'for ', 'on ', 'at ', 'by ', 'with ', 'this ', 'that ', 'we ', 'you ', 'from '];
  
  let frScore = 0;
  let enScore = 0;
  
  frWords.forEach(word => { frScore += (sample.split(word).length - 1); });
  enWords.forEach(word => { enScore += (sample.split(word).length - 1); });
  
  // French accent letters bonus
  const frAccents = (sample.match(/[éèêëàâùûüçîï]/g) || []).length;
  frScore += frAccents * 2;
  
  return frScore > enScore ? 'fr' : 'en';
}

/**
 * Extract context around a position in text
 */
export function getContext(text: string, position: number, contextLength = 50): string {
  const start = Math.max(0, position - contextLength);
  const end = Math.min(text.length, position + contextLength);
  return text.substring(start, end).replace(/\s+/g, ' ').trim();
}

/**
 * Split text into sentences (basic)
 */
export function splitIntoSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=[A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖÙÚÛÜÝ])/)
    .filter(s => s.trim().length > 0);
}
