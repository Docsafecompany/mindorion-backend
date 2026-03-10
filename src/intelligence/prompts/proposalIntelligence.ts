export function buildProposalIntelligencePrompt(text: string, language: 'fr' | 'en' = 'en'): string {
  const truncatedText = text.length > 80000 ? text.substring(0, 80000) + '...[TRUNCATED]' : text;
  
  return `You are an expert business proposal analyst and executive consultant. Analyze the following business proposal document and return a structured JSON assessment.

You must respond with ONLY valid JSON. No markdown, no explanations, no text outside the JSON object.

Analyze for these risk categories:
- client_error: Wrong client name, outdated references, copy-paste errors from other proposals
- scope_mismatch: Scope does not match objectives, inconsistent deliverables
- delivery_risk: Unrealistic timelines, overcommitments, resource constraints exposed
- risky_commitment: Unconditional guarantees, penalties, SLAs without caveats
- generic_content: Boilerplate text, lorem ipsum, lack of specificity
- confidentiality_exposure: Internal pricing, previous client names, confidential markers visible
- pricing_signal: Internal cost structures, margin calculations, discount levels visible
- missing_reference: No case studies, no references, no proof of capability
- weak_value_proposition: No clear differentiator, generic claims, no measurable outcomes
- insufficient_detail: Vague technical approach, missing methodology

Also identify strength signals:
- technical_clarity, client_alignment, precise_scope, convincing_references, strong_value_proposition

Score 5 proposal dimensions (0-100):
- margin: How well is pricing protected?
- delivery: How realistic are commitments?
- negotiation: How strong is the negotiation position?
- compliance: How well is confidentiality maintained?
- credibility: How professional is the presentation?

Return exactly this JSON structure:
{
  "analysis_type": "proposal_intelligence",
  "client_ready_score": <0-100>,
  "risk_score": <0-100>,
  "summary": {
    "overall_assessment": "<one paragraph executive summary>",
    "top_risks": ["<risk 1>", "<risk 2>", "<risk 3>"],
    "priority_actions": ["<action 1>", "<action 2>", "<action 3>"]
  },
  "risk_categories": [
    {
      "category": "<category from taxonomy>",
      "severity": "<critical|high|medium|low>",
      "title": "<short title>",
      "description": "<detailed description>",
      "recommendation": "<specific action to take>",
      "evidence": ["<excerpt 1>", "<excerpt 2>"]
    }
  ],
  "strength_signals": [
    {
      "type": "<signal type>",
      "title": "<title>",
      "description": "<description>",
      "evidence": ["<excerpt>"]
    }
  ],
  "proposal_dimensions": [
    { "dimension": "margin", "score": <0-100>, "comment": "<explanation>" },
    { "dimension": "delivery", "score": <0-100>, "comment": "<explanation>" },
    { "dimension": "negotiation", "score": <0-100>, "comment": "<explanation>" },
    { "dimension": "compliance", "score": <0-100>, "comment": "<explanation>" },
    { "dimension": "credibility", "score": <0-100>, "comment": "<explanation>" }
  ]
}

Document language detected: ${language}

PROPOSAL TEXT:
${truncatedText}`;
}
