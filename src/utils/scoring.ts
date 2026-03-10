export interface ScoreResult {
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  cleanlinessScore: number;
  totalIssues: number;
  criticalIssues: number;
  recommendations: string[];
}

interface SeverityWeight {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

const WEIGHTS: SeverityWeight = {
  critical: 25,
  high: 15,
  medium: 8,
  low: 3,
};

const CATEGORY_WEIGHTS: Record<string, number> = {
  metadata: 1.0,
  comments: 1.5,
  trackChanges: 2.0,
  hiddenContent: 1.5,
  sensitiveData: 3.0,
  spellingErrors: 0.5,
  speakerNotes: 2.0,
  embeddedObjects: 1.0,
  macros: 2.5,
  sensitiveFormulas: 2.0,
  brokenLinks: 1.5,
  docFields: 1.0,
  aiDetection: 0.3,
};

function countBySeverity(items: any[]): SeverityWeight {
  const counts: SeverityWeight = { critical: 0, high: 0, medium: 0, low: 0 };
  if (!Array.isArray(items)) return counts;
  items.forEach(item => {
    const sev = item?.severity as keyof SeverityWeight;
    if (sev && counts[sev] !== undefined) counts[sev]++;
  });
  return counts;
}

export function calculateRiskScore(detections: Record<string, any>): ScoreResult {
  let totalScore = 0;
  let totalIssues = 0;
  let criticalIssues = 0;
  const recommendations: string[] = [];

  for (const [category, items] of Object.entries(detections)) {
    if (!items) continue;
    
    const categoryWeight = CATEGORY_WEIGHTS[category] || 1.0;
    const itemsArray = Array.isArray(items) ? items : (items && typeof items === 'object' ? [items] : []);
    
    if (itemsArray.length === 0) continue;
    
    const counts = countBySeverity(itemsArray);
    totalIssues += itemsArray.length;
    criticalIssues += counts.critical;
    
    const categoryScore = (
      counts.critical * WEIGHTS.critical +
      counts.high * WEIGHTS.high +
      counts.medium * WEIGHTS.medium +
      counts.low * WEIGHTS.low
    ) * categoryWeight;
    
    totalScore += categoryScore;
    
    // Generate recommendations
    if (counts.critical > 0 || counts.high > 0) {
      const recs: Record<string, string> = {
        metadata: 'Remove personally identifiable metadata before sending the document',
        comments: 'Delete all comments and annotations',
        trackChanges: 'Accept or reject all track changes',
        hiddenContent: 'Remove or reveal all hidden content',
        sensitiveData: 'Redact sensitive personal and financial information',
        speakerNotes: 'Clear all speaker notes from slides',
        macros: 'Remove macros or save as macro-free format',
        sensitiveFormulas: 'Remove or replace formulas referencing external files',
        brokenLinks: 'Remove or replace internal/network links',
      };
      
      if (recs[category] && !recommendations.includes(recs[category])) {
        recommendations.push(recs[category]);
      }
    }
  }

  // Normalize score to 0-100
  const riskScore = Math.min(100, Math.round(totalScore));
  
  let riskLevel: 'low' | 'medium' | 'high' | 'critical';
  if (riskScore >= 70 || criticalIssues > 0) {
    riskLevel = 'critical';
  } else if (riskScore >= 40) {
    riskLevel = 'high';
  } else if (riskScore >= 20) {
    riskLevel = 'medium';
  } else {
    riskLevel = 'low';
  }

  const cleanlinessScore = Math.max(0, 100 - riskScore);

  return {
    riskScore,
    riskLevel,
    cleanlinessScore,
    totalIssues,
    criticalIssues,
    recommendations: recommendations.slice(0, 5),
  };
}
