export interface BrokenLinkItem {
  url: string;
  location: string;
  type: 'intranet' | 'file_protocol' | 'broken_bookmark' | 'suspicious';
  reason: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

const INTRANET_PATTERNS = [
  /https?:\/\/(?:intranet|sharepoint|confluence|jira|wiki|internal|corp|local)\./gi,
  /https?:\/\/(?:10|172\.(?:1[6-9]|2[0-9]|3[01])|192\.168)\.[\d.]+/gi,
  /https?:\/\/localhost/gi,
  /https?:\/\/[\w-]+\/(?:sites|teams|pages)\//gi,
];

const FILE_PATH_URL = /file:\/\/\//gi;

export async function detectBrokenLinks(text: string): Promise<BrokenLinkItem[]> {
  const items: BrokenLinkItem[] = [];
  const seen = new Set<string>();

  // Detect intranet/internal URLs
  const urlRegex = /https?:\/\/[^\s<>"']+/gi;
  let match;
  
  while ((match = urlRegex.exec(text)) !== null) {
    const url = match[0].replace(/[.,;:!?\)]$/, ''); // Remove trailing punctuation
    
    if (seen.has(url)) continue;
    
    for (const pattern of INTRANET_PATTERNS) {
      const testPattern = new RegExp(pattern.source, 'gi');
      if (testPattern.test(url)) {
        seen.add(url);
        items.push({
          url,
          location: text.substring(Math.max(0, match.index - 20), match.index + 60).replace(/\s+/g, ' '),
          type: 'intranet',
          reason: 'URL appears to be an internal/intranet address not accessible externally',
          severity: 'high',
        });
        break;
      }
    }
  }

  // Detect file:// protocol links
  const fileUrlRegex = /file:\/\/\/[^\s<>"']+/gi;
  while ((match = fileUrlRegex.exec(text)) !== null) {
    const url = match[0];
    if (!seen.has(url)) {
      seen.add(url);
      items.push({
        url,
        location: text.substring(Math.max(0, match.index - 20), match.index + 60).replace(/\s+/g, ' '),
        type: 'file_protocol',
        reason: 'Direct file system link - not accessible on other systems',
        severity: 'critical',
      });
    }
  }

  // Detect UNC paths in text
  const uncRegex = /\\\\[\w\-]+\\[^\s<>"'\\]+/g;
  while ((match = uncRegex.exec(text)) !== null) {
    const url = match[0];
    if (!seen.has(url)) {
      seen.add(url);
      items.push({
        url,
        location: text.substring(Math.max(0, match.index - 20), match.index + 60).replace(/\s+/g, ' '),
        type: 'file_protocol',
        reason: 'UNC network path - exposes internal network structure',
        severity: 'critical',
      });
    }
  }

  return items;
}
