import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { ProposalIntelligenceOutput } from '../types';

let supabaseClient: ReturnType<typeof createClient> | null = null;

function getSupabase() {
  if (!supabaseClient) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
    }
    supabaseClient = createClient(url, key);
  }
  return supabaseClient;
}

export interface StorageResult {
  analysisId: string;
  storedAt: string | null;
  error?: string;
}

export async function storeProposalAnalysis(
  documentId: string,
  userId: string | null,
  orgId: string | null,
  output: ProposalIntelligenceOutput,
  meta: { model_used: string; tokens_used: number; latency_ms: number }
): Promise<StorageResult> {
  const analysisId = uuidv4();
  const now = new Date().toISOString();

  try {
    const supabase = getSupabase();

    // 1. Insert document_analyses
    const { error: analysisError } = await supabase.from('document_analyses').insert({
      id: analysisId,
      document_id: documentId,
      user_id: userId,
      org_id: orgId,
      analysis_type: 'proposal_intelligence',
      client_ready_score: output.client_ready_score,
      risk_score: output.risk_score,
      overall_assessment: output.summary?.overall_assessment || '',
      raw_output: output,
      model_used: meta.model_used,
      tokens_used: meta.tokens_used,
      latency_ms: meta.latency_ms,
      created_at: now,
    });

    if (analysisError) throw analysisError;

    // 2. Insert proposal_signals
    if (output.risk_categories && output.risk_categories.length > 0) {
      const signals = output.risk_categories.map(rc => ({
        id: uuidv4(),
        analysis_id: analysisId,
        category: rc.category,
        severity: rc.severity,
        title: rc.title,
        description: rc.description,
        recommendation: rc.recommendation,
        evidence: rc.evidence || [],
        created_at: now,
      }));

      const { error: signalsError } = await supabase.from('proposal_signals').insert(signals);
      if (signalsError) console.error('Failed to insert signals:', signalsError);
    }

    // 3. Insert proposal_dimension_scores
    if (output.proposal_dimensions && output.proposal_dimensions.length > 0) {
      const dims = output.proposal_dimensions.map(d => ({
        id: uuidv4(),
        analysis_id: analysisId,
        dimension: d.dimension,
        score: d.score,
        comment: d.comment,
        created_at: now,
      }));

      const { error: dimsError } = await supabase.from('proposal_dimension_scores').insert(dims);
      if (dimsError) console.error('Failed to insert dimensions:', dimsError);
    }

    // 4. Insert proposal_strength_signals
    if (output.strength_signals && output.strength_signals.length > 0) {
      const strengths = output.strength_signals.map(s => ({
        id: uuidv4(),
        analysis_id: analysisId,
        signal_type: s.type,
        title: s.title,
        description: s.description,
        evidence: s.evidence || [],
        created_at: now,
      }));

      const { error: strengthsError } = await supabase.from('proposal_strength_signals').insert(strengths);
      if (strengthsError) console.error('Failed to insert strengths:', strengthsError);
    }

    // 5. Insert usage_event
    await storeUsageEvent({
      userId,
      module: 'qualion_proposal',
      analysisType: 'proposal_intelligence',
      modelUsed: meta.model_used,
      tokensUsed: meta.tokens_used,
      latencyMs: meta.latency_ms,
      status: 'success',
    });

    return { analysisId, storedAt: now };
  } catch (err: any) {
    console.error('Supabase storage error:', err);
    
    // Store failed usage event
    try {
      await storeUsageEvent({
        userId,
        module: 'qualion_proposal',
        analysisType: 'proposal_intelligence',
        modelUsed: meta.model_used,
        tokensUsed: meta.tokens_used,
        latencyMs: meta.latency_ms,
        status: 'error',
        errorMessage: err.message,
      });
    } catch {}
    
    return { analysisId, storedAt: null, error: err.message };
  }
}

export async function storeUsageEvent(params: {
  userId?: string | null;
  module: string;
  analysisType: string;
  modelUsed: string;
  tokensUsed: number;
  latencyMs: number;
  status: 'success' | 'error';
  errorMessage?: string;
}): Promise<void> {
  try {
    const supabase = getSupabase();
    await supabase.from('usage_events').insert({
      id: uuidv4(),
      user_id: params.userId || null,
      module: params.module,
      analysis_type: params.analysisType,
      model_used: params.modelUsed,
      tokens_used: params.tokensUsed,
      latency_ms: params.latencyMs,
      status: params.status,
      error_message: params.errorMessage || null,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Failed to store usage event:', err);
  }
}
