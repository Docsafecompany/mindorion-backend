// AI Content Detection is handled by the intelligence service
// This module provides the interface types for AI detection results

export interface AiDetectionSignal {
  pattern: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  evidence: string;
}

export interface AiDetectionResult {
  overall_score: number;
  confidence: 'low' | 'medium' | 'high';
  verdict: 'likely_human' | 'mixed' | 'likely_ai';
  signals: AiDetectionSignal[];
  human_indicators: string[];
  ai_indicators: string[];
  summary: string;
}

// Detection is orchestrated by mindorionIntelligenceService
// See src/intelligence/service.ts for implementation
