import Anthropic from '@anthropic-ai/sdk';
import { v4 as uuidv4 } from 'uuid';
import {
  NormalizedInput, IntelligenceResult, ProposalIntelligenceOutput,
  SpellCheckError, AiDetectionOutput
} from './types';
import { buildProposalIntelligencePrompt } from './prompts/proposalIntelligence';
import { buildSpellCheckPrompt, buildRewriteTextPrompt } from './prompts/spellCheck';
import { buildAiDetectionPrompt } from './prompts/aiDetection';
import { parseClaudeOutput, sanitizeSpellErrors } from './validators/output.validator';
import { storeProposalAnalysis, storeUsageEvent } from './storage/supabase.storage';

const MODEL = 'claude-sonnet-4-5';
const MAX_RETRIES = 2;

class MindorionIntelligenceService {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  /**
   * Call Claude with retry logic for JSON parse failures
   */
  private async callClaude(prompt: string, maxTokens = 4096): Promise<{
    content: string;
    tokensUsed: number;
    latencyMs: number;
  }> {
    const startTime = Date.now();
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await this.client.messages.create({
          model: MODEL,
          max_tokens: maxTokens,
          messages: [{ role: 'user', content: prompt }],
        });

        const latencyMs = Date.now() - startTime;
        const content = response.content[0].type === 'text' ? response.content[0].text : '';
        const tokensUsed = (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);

        return { content, tokensUsed, latencyMs };
      } catch (err: any) {
        lastError = err;
        if (err.status === 529 || err.status === 500) {
          // Retryable error
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }
        throw err;
      }
    }

    throw lastError || new Error('Max retries exceeded');
  }

  /**
   * Run proposal intelligence analysis
   */
  async runProposalIntelligence(
    text: string,
    documentId: string,
    userId?: string,
    orgId?: string | null,
    language: 'fr' | 'en' = 'en'
  ): Promise<ProposalIntelligenceOutput | null> {
    try {
      const prompt = buildProposalIntelligencePrompt(text, language);
      const { content, tokensUsed, latencyMs } = await this.callClaude(prompt, 4096);

      let output: ProposalIntelligenceOutput;
      let retries = 0;

      while (retries <= MAX_RETRIES) {
        try {
          output = parseClaudeOutput<ProposalIntelligenceOutput>(content, 'proposal_intelligence');
          break;
        } catch (parseErr) {
          if (retries === MAX_RETRIES) throw parseErr;
          retries++;
          // Retry with same prompt
          const retryResult = await this.callClaude(prompt, 4096);
          output = parseClaudeOutput<ProposalIntelligenceOutput>(retryResult.content, 'proposal_intelligence');
          break;
        }
      }

      // Store in Supabase
      const storageResult = await storeProposalAnalysis(
        documentId,
        userId || null,
        orgId || null,
        output!,
        { model_used: MODEL, tokens_used: tokensUsed, latency_ms: latencyMs }
      );

      console.log('Proposal intelligence stored:', storageResult.analysisId);
      return output!;
    } catch (err: any) {
      console.error('Proposal intelligence error:', err);
      return null;
    }
  }

  /**
   * Run spell check analysis
   */
  async runSpellCheck(text: string, documentId: string): Promise<SpellCheckError[]> {
    try {
      if (!text || text.trim().length < 50) return [];

      const prompt = buildSpellCheckPrompt(text);
      const { content, tokensUsed, latencyMs } = await this.callClaude(prompt, 2048);

      let result: any;
      try {
        result = parseClaudeOutput<any>(content, 'spell_check');
      } catch {
        // Retry once
        const retry = await this.callClaude(prompt, 2048);
        result = parseClaudeOutput<any>(retry.content, 'spell_check');
      }

      const rawErrors = result.errors || [];
      const sanitized = sanitizeSpellErrors(rawErrors);

      // Store usage
      await storeUsageEvent({
        module: 'qualion_for_all',
        analysisType: 'spell_check',
        modelUsed: MODEL,
        tokensUsed,
        latencyMs,
        status: 'success',
      });

      return sanitized;
    } catch (err: any) {
      console.error('Spell check error:', err);
      await storeUsageEvent({
        module: 'qualion_for_all',
        analysisType: 'spell_check',
        modelUsed: MODEL,
        tokensUsed: 0,
        latencyMs: 0,
        status: 'error',
        errorMessage: err.message,
      }).catch(() => {});
      return [];
    }
  }

  /**
   * Run AI content detection
   */
  async runAiDetection(text: string, documentId: string): Promise<AiDetectionOutput['ai_detection'] | null> {
    try {
      if (!text || text.trim().length < 100) return null;

      const prompt = buildAiDetectionPrompt(text);
      const { content, tokensUsed, latencyMs } = await this.callClaude(prompt, 2048);

      let result: AiDetectionOutput;
      try {
        result = parseClaudeOutput<AiDetectionOutput>(content, 'ai_detection');
      } catch {
        const retry = await this.callClaude(prompt, 2048);
        result = parseClaudeOutput<AiDetectionOutput>(retry.content, 'ai_detection');
      }

      await storeUsageEvent({
        module: 'qualion_for_all',
        analysisType: 'ai_detection',
        modelUsed: MODEL,
        tokensUsed,
        latencyMs,
        status: 'success',
      });

      return result.ai_detection;
    } catch (err: any) {
      console.error('AI detection error:', err);
      return null;
    }
  }

  /**
   * Rewrite text with specified tone
   */
  async rewriteText(text: string, tone: 'consulting' | 'formal' | 'friendly', documentId: string): Promise<string> {
    try {
      const prompt = buildRewriteTextPrompt(text, tone);
      const { content, tokensUsed, latencyMs } = await this.callClaude(prompt, 8192);

      await storeUsageEvent({
        module: 'qualion_proposal',
        analysisType: 'rewrite_text',
        modelUsed: MODEL,
        tokensUsed,
        latencyMs,
        status: 'success',
      });

      return content;
    } catch (err: any) {
      console.error('Rewrite error:', err);
      throw err;
    }
  }
}

// Singleton export
export const mindorionIntelligenceService = new MindorionIntelligenceService();
