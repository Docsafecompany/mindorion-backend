export interface JsonReportData {
  reportVersion: string;
  generatedAt: string;
  fileName: string;
  operations: string[];
  removedItems: number;
  summary: {
    metadataCleaned: boolean;
    commentsCleaned: boolean;
    trackChangesAccepted: boolean;
    hiddenContentRemoved: boolean;
    spellingCorrected: boolean;
    sensitiveDataRedacted: boolean;
    totalOperations: number;
  };
}

export function generateJsonReport(report: any, fileName: string): JsonReportData {
  const operations: string[] = report.operations || [];
  
  return {
    reportVersion: '1.0.0',
    generatedAt: new Date().toISOString(),
    fileName,
    operations,
    removedItems: report.removedItems || 0,
    summary: {
      metadataCleaned: operations.some(op => op.toLowerCase().includes('metadata')),
      commentsCleaned: operations.some(op => op.toLowerCase().includes('comment')),
      trackChangesAccepted: operations.some(op => op.toLowerCase().includes('track change')),
      hiddenContentRemoved: operations.some(op => op.toLowerCase().includes('hidden')),
      spellingCorrected: operations.some(op => op.toLowerCase().includes('spelling')),
      sensitiveDataRedacted: operations.some(op => op.toLowerCase().includes('sensitive') || op.toLowerCase().includes('redact')),
      totalOperations: operations.length,
    },
  };
}
