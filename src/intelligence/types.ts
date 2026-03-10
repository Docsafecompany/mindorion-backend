export type AnalysisType = 'proposal_intelligence' | 'spell_check' | 'ai_detection' | 'document_hygiene' | 'rewrite_text';

export interface NormalizedInput {
  module: string;
  analysis_type: AnalysisType;
  document_id: string;
  user_id?: string;
  org_id?: string | null;
  content: {
    raw_text: string;
    metadata?: Record<string, any>;
    context?: string;
  };
  options: {
    language?: 'fr' | 'en';
    strict_mode?: boolean;
    skip_storage?: boolean;
    tone?: 'consulting' | 'formal' | 'friendly';
  };
}

export interface IntelligenceResult<T = any> {
  success: boolean;
  analysis_id: string;
  document_id: string;
  module: string;
  analysis_type: AnalysisType;
  output: T | null;
  error: { code: string; message: string; retryable: boolean } | null;
  meta: {
    model_used: string;
    tokens_used: number;
    latency_ms: number;
    stored_at: string | null;
  };
}

// Proposal intelligence types
export interface RiskCategory {
  category: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  recommendation: string;
  evidence: string[];
}

export interface StrengthSignal {
  type: string;
  title: string;
  description: string;
  evidence: string[];
}

export interface ProposalDimension {
  dimension: 'margin' | 'delivery' | 'negotiation' | 'compliance' | 'credibility';
  score: number;
  comment: string;
}

export interface ProposalIntelligenceOutput {
  analysis_type: 'proposal_intelligence';
  client_ready_score: number;
  risk_score: number;
  summary: {
    overall_assessment: string;
    top_risks: string[];
    priority_actions: string[];
  };
  risk_categories: RiskCategory[];
  strength_signals: StrengthSignal[];
  proposal_dimensions: ProposalDimension[];
}

// Spell check types
export interface SpellCheckError {
  error: string;
  correction: string;
  context: string;
  severity: 'low' | 'medium' | 'high';
  type: 'spelling' | 'conjugation' | 'grammar' | 'syntax' | 'punctuation' | 'fragmented_word' | 'merged_word';
  message: string;
}

// AI detection types
export interface AiDetectionOutput {
  ai_detection: {
    overall_score: number;
    confidence: 'low' | 'medium' | 'high';
    verdict: 'likely_human' | 'mixed' | 'likely_ai';
    signals: Array<{
      pattern: string;
      description: string;
      severity: 'low' | 'medium' | 'high';
      evidence: string;
    }>;
    human_indicators: string[];
    ai_indicators: string[];
    summary: string;
  };
}
