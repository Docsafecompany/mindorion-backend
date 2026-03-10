import { Router, Request, Response } from 'express';
import multer from 'multer';
import JSZip from 'jszip';
import { validateFile } from '../utils/fileValidation';
import { parseDocx } from '../parsers/docx.parser';
import { parsePptx } from '../parsers/pptx.parser';
import { parseXlsx } from '../parsers/xlsx.parser';
import { cleanDocx } from '../cleaners/docx.cleaner';
import { cleanPptx } from '../cleaners/pptx.cleaner';
import { cleanXlsx } from '../cleaners/xlsx.cleaner';
import { generateHtmlReport } from '../reports/htmlReport';
import { generateJsonReport } from '../reports/jsonReport';
import { mindorionIntelligenceService } from '../intelligence/service';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

router.post('/', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided' });

    const validation = validateFile(req.file);
    if (!validation.valid) return res.status(400).json({ error: validation.error });

    const fileType = validation.fileType!;
    
    if (fileType === 'pdf') {
      return res.status(400).json({ error: 'PDF cleaning is not supported. PDFs are read-only.' });
    }

    const options = {
      removeMetadata: req.body.removeMetadata === 'true',
      removeComments: req.body.removeComments === 'true',
      acceptTrackChanges: req.body.acceptTrackChanges === 'true',
      removeHiddenContent: req.body.removeHiddenContent === 'true',
      removeEmbeddedObjects: req.body.removeEmbeddedObjects === 'true',
      removeMacros: req.body.removeMacros === 'true',
      removeVisualObjects: req.body.removeVisualObjects === 'true',
      sensitiveDataToClean: req.body.sensitiveDataToClean ? JSON.parse(req.body.sensitiveDataToClean) : [],
      hiddenContentToClean: req.body.hiddenContentToClean ? JSON.parse(req.body.hiddenContentToClean) : [],
      selectedComments: req.body.selectedComments ? JSON.parse(req.body.selectedComments) : [],
      selectedMetadata: req.body.selectedMetadata ? JSON.parse(req.body.selectedMetadata) : [],
      correctSpelling: req.body.correctSpelling === 'true',
      approvedSpellingErrors: req.body.approvedSpellingErrors ? JSON.parse(req.body.approvedSpellingErrors) : [],
      aiRewritingEnabled: req.body.aiRewritingEnabled === 'true',
      aiRewritingTone: (req.body.aiRewritingTone || 'formal') as 'consulting' | 'formal' | 'friendly',
    };

    let cleanedBuffer: Buffer;
    let reportData: any;

    if (fileType === 'docx') {
      const parsed = await parseDocx(req.file.buffer);
      const result = await cleanDocx(req.file.buffer, parsed, options);
      cleanedBuffer = result.buffer;
      reportData = result.report;
    } else if (fileType === 'pptx') {
      const parsed = await parsePptx(req.file.buffer);
      const result = await cleanPptx(req.file.buffer, parsed, options);
      cleanedBuffer = result.buffer;
      reportData = result.report;
    } else if (fileType === 'xlsx' || fileType === 'xls') {
      const parsed = await parseXlsx(req.file.buffer);
      const result = await cleanXlsx(req.file.buffer, parsed, options);
      cleanedBuffer = result.buffer;
      reportData = result.report;
    } else {
      return res.status(400).json({ error: 'Unsupported file type for cleaning' });
    }

    // Apply AI rewriting if requested
    if (options.aiRewritingEnabled && reportData.originalText) {
      try {
        const rewritten = await mindorionIntelligenceService.rewriteText(
          reportData.originalText, options.aiRewritingTone, 'doc-clean'
        );
        reportData.rewrittenText = rewritten;
      } catch (e) {
        console.error('AI rewriting failed:', e);
      }
    }

    const htmlReport = generateHtmlReport(reportData, req.file.originalname);
    const jsonReport = generateJsonReport(reportData, req.file.originalname);

    // Build ZIP
    const zip = new JSZip();
    const ext = req.file.originalname.split('.').pop() || fileType;
    const cleanedName = req.file.originalname.replace(/\.[^.]+$/, '_cleaned.' + ext);
    
    zip.file(cleanedName, cleanedBuffer);
    zip.file('report.html', htmlReport);
    zip.file('report.json', JSON.stringify(jsonReport, null, 2));

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });

    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="cleaned_document.zip"',
      'Content-Length': zipBuffer.length.toString(),
    });
    res.send(zipBuffer);
  } catch (err: any) {
    console.error('Clean error:', err);
    res.status(500).json({ error: err.message || 'Cleaning failed' });
  }
});

export { router as cleanRouter };
