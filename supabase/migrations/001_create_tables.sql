-- Mindorion Backend: Supabase Database Schema
-- Run this migration in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. document_analyses
CREATE TABLE IF NOT EXISTS document_analyses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL,
  user_id UUID,
  org_id UUID,
  analysis_type TEXT NOT NULL CHECK (analysis_type IN ('proposal_intelligence', 'document_hygiene')),
  client_ready_score INTEGER CHECK (client_ready_score >= 0 AND client_ready_score <= 100),
  risk_score INTEGER CHECK (risk_score >= 0 AND risk_score <= 100),
  overall_assessment TEXT,
  raw_output JSONB,
  model_used TEXT,
  tokens_used INTEGER,
  latency_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_analyses_document_id ON document_analyses(document_id);
CREATE INDEX IF NOT EXISTS idx_document_analyses_user_id ON document_analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_document_analyses_created_at ON document_analyses(created_at);

-- 2. proposal_signals
CREATE TABLE IF NOT EXISTS proposal_signals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  analysis_id UUID NOT NULL REFERENCES document_analyses(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  title TEXT NOT NULL,
  description TEXT,
  recommendation TEXT,
  evidence JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proposal_signals_analysis_id ON proposal_signals(analysis_id);
CREATE INDEX IF NOT EXISTS idx_proposal_signals_category ON proposal_signals(category);
CREATE INDEX IF NOT EXISTS idx_proposal_signals_severity ON proposal_signals(severity);

-- 3. proposal_dimension_scores
CREATE TABLE IF NOT EXISTS proposal_dimension_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  analysis_id UUID NOT NULL REFERENCES document_analyses(id) ON DELETE CASCADE,
  dimension TEXT NOT NULL CHECK (dimension IN ('margin', 'delivery', 'negotiation', 'compliance', 'credibility')),
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dimension_scores_analysis_id ON proposal_dimension_scores(analysis_id);

-- 4. proposal_strength_signals
CREATE TABLE IF NOT EXISTS proposal_strength_signals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  analysis_id UUID NOT NULL REFERENCES document_analyses(id) ON DELETE CASCADE,
  signal_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  evidence JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_strength_signals_analysis_id ON proposal_strength_signals(analysis_id);

-- 5. usage_events
CREATE TABLE IF NOT EXISTS usage_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID,
  module TEXT NOT NULL,
  analysis_type TEXT NOT NULL,
  model_used TEXT,
  tokens_used INTEGER DEFAULT 0,
  latency_ms INTEGER DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('success', 'error')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usage_events_user_id ON usage_events(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_module ON usage_events(module);
CREATE INDEX IF NOT EXISTS idx_usage_events_created_at ON usage_events(created_at);

-- Row Level Security (optional but recommended)
ALTER TABLE document_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_dimension_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_strength_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;

-- Service role bypass (for backend with service role key)
CREATE POLICY "Service role full access" ON document_analyses
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access" ON proposal_signals
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access" ON proposal_dimension_scores
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access" ON proposal_strength_signals
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access" ON usage_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Comments
COMMENT ON TABLE document_analyses IS 'Stores all AI analysis results for documents';
COMMENT ON TABLE proposal_signals IS 'Stores risk signals detected in proposals';
COMMENT ON TABLE proposal_dimension_scores IS 'Stores proposal quality dimension scores';
COMMENT ON TABLE proposal_strength_signals IS 'Stores positive signals found in proposals';
COMMENT ON TABLE usage_events IS 'Tracks API usage for billing and monitoring';
