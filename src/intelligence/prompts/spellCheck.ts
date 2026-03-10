export function buildSpellCheckPrompt(text: string): string {
  const truncated = text.length > 30000 ? text.substring(0, 30000) + '...[TRUNCATED]' : text;
  
  return `You are a professional proofreader and language expert fluent in both English and French. Analyze the following document text for linguistic errors.

Auto-detect the primary language of the document (English or French). Then find ALL errors in that language.

Error types to detect:
- spelling: Misspelled words (e.g., "teh" -> "the", "recieve" -> "receive")
- conjugation: Wrong verb tense or form (e.g., "they was" -> "they were")
- grammar: Grammatical agreement errors (e.g., "a apples" -> "an apples")
- syntax: Sentence structure problems
- punctuation: Wrong or missing punctuation
- fragmented_word: Word split by space (e.g., "enablin g" -> "enabling")
- merged_word: Two words incorrectly merged (e.g., "thedog" -> "the dog")

Rules:
- Only flag real errors, not stylistic choices
- Do not flag proper nouns, acronyms, or technical terms
- Do not merge words that are legitimately separate
- Provide context of 30-50 characters around each error
- Maximum 50 errors total
- Return ONLY valid JSON, no markdown, no extra text

Return this exact JSON structure:
{
  "detected_language": "en" or "fr",
  "errors": [
    {
      "error": "<the wrong text>",
      "correction": "<the correct text>",
      "context": "<30-50 chars surrounding the error>",
      "severity": "low|medium|high",
      "type": "spelling|conjugation|grammar|syntax|punctuation|fragmented_word|merged_word",
      "message": "<brief explanation>"
    }
  ]
}

DOCUMENT TEXT:
${truncated}`;
}

export function buildRewriteTextPrompt(text: string, tone: 'consulting' | 'formal' | 'friendly'): string {
  const toneDescriptions = {
    consulting: 'professional consulting style - authoritative, precise, business-focused',
    formal: 'formal and official style - structured, polished, appropriate for executive audiences',
    friendly: 'warm and approachable style - clear, engaging, conversational yet professional',
  };

  return `You are an expert business writer. Rewrite the following document text in a ${toneDescriptions[tone]}.

Preserve all factual content, data, numbers, and key information. Only improve the language quality, clarity, and tone.
Maintain the same structure and paragraphs. Do not add or remove information.

Return ONLY the rewritten text, no explanations, no JSON, just the improved text.

ORIGINAL TEXT:
${text}`;
}
