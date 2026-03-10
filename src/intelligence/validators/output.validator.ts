import { AnalysisType } from '../types';

/**
 * Parse and validate Claude's JSON output
 * Strips markdown code blocks if present and attempts JSON.parse
 */
export function parseClaudeOutput<T>(rawText: string, analysisType: AnalysisType): T {
  let cleaned = rawText.trim();
  
  // Strip markdown code blocks
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  
  // Remove any leading/trailing non-JSON content
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace > 0) {
    cleaned = cleaned.substring(firstBrace);
  }
  if (lastBrace < cleaned.length - 1 && lastBrace > 0) {
    cleaned = cleaned.substring(0, lastBrace + 1);
  }
  
  try {
    const parsed = JSON.parse(cleaned);
    return validateOutput<T>(parsed, analysisType);
  } catch (err) {
    throw new Error('Failed to parse Claude output as JSON: ' + String(err));
  }
}

function validateOutput<T>(data: any, analysisType: AnalysisType): T {
  switch (analysisType) {
    case 'proposal_intelligence':
      if (!data.analysis_type || !data.client_ready_score === undefined || !data.proposal_dimensions) {
        throw new Error('Invalid proposal intelligence output structure');
      }
      // Ensure required arrays exist
      data.risk_categories = data.risk_categories || [];
      data.strength_signals = data.strength_signals || [];
      data.proposal_dimensions = data.proposal_dimensions || [];
      break;
      
    case 'spell_check':
      if (!data.errors) {
        throw new Error('Invalid spell check output structure');
      }
      data.errors = Array.isArray(data.errors) ? data.errors : [];
      break;
      
    case 'ai_detection':
      if (!data.ai_detection) {
        throw new Error('Invalid AI detection output structure');
      }
      data.ai_detection.signals = data.ai_detection.signals || [];
      data.ai_detection.human_indicators = data.ai_detection.human_indicators || [];
      data.ai_detection.ai_indicators = data.ai_detection.ai_indicators || [];
      break;
  }
  
  return data as T;
}

export function sanitizeSpellErrors(errors: any[]): any[] {
  return errors.filter(e => {
    // Reject if error and correction are the same
    if (e.error === e.correction) return false;
    
    // Reject if correction doesn't look like a real word
    if (e.type === 'spelling' && e.correction && /^[^a-zA-ZÀ-ÿ]/.test(e.correction)) return false;
    
    // Reject if it's trying to merge valid separate common words
    const commonTwoWordPhrases = new Set(['à la', 'c est', 'en fait', 'de plus', 'du coup', 'a lot', 'in fact', 'of course']);
    if (e.type === 'merged_word' && e.error && commonTwoWordPhrases.has(e.error.toLowerCase())) return false;
    
    return true;
  });
}
