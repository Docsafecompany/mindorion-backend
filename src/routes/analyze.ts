import { Router, Request, Response } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { validateFile } from '../utils/fileValidation';
import { parseDocx } from '../parsers/docx.parser';
import { parsePptx } from '../parsers/pptx.parser';
import { parseXlsx } from '../parsers/xlsx.parser';
import { parsePdf } from '../parsers/pdf.parser';
import { detectMetadata } from '../detectors/metadata.detector';
import { detectComments } from '../detectors/comments.detector';
import { detectTrackChanges } from '../detectors/trackChanges.detector';
import { detectHiddenContent } from '../detectors/hiddenContent.detector';
import { detectSensitiveData } from '../detectors/sensitiveData.detector';
import { detectHygiene } from '../detectors/hygiene.detector';
import { detectSpeakerNotes } from '../detectors/speakerNotes.detector';
import { detectEmbeddedObjects } from '../detectors/embeddedObjects.detector';
import { detectMacros } from '../detectors/macros.detector';
import { detectFormulas } from '../detectors/formulas.detector';
import { detectDocFields } from '../detectors/docFields.detector';
import { detectBrokenLinks } from '../detectors/brokenLinks.detector';
import { calculateRiskScore } from '../utils/scoring';
import { mindorionIntelligenceService } from '../intelligence/service';

const router = Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 100 * 1024 * 1024 },
});

router.post('/', upload.single('file'), async (req: Request, res: Response) => {
    try {
          if (!req.file) return res.status(400).json({ error: 'No file provided' });

      const validation = validateFile(req.file);
          if (!validation.valid) return res.status(400).json({ error: validation.error });

      const fast = req.query.fast === 'true';
          const analysisMode = (req.body.analysis_mode || 'proposal') as 'basic' | 'proposal';
          const documentId = uuidv4();
          const fileType = validation.fileType!;

      // Parse document
      let parsedDoc: any = null;
          if (fileType === 'docx') parsedDoc = await parseDocx(req.file.buffer);
          else if (fileType === 'pptx') parsedDoc = await parsePptx(req.file.buffer);
          else if (fileType === 'xlsx' || fileType === 'xls') parsedDoc = await parseXlsx(req.file.buffer);
          else if (fileType === 'pdf') parsedDoc = await parsePdf(req.file.buffer);

      if (!parsedDoc) return res.status(400).json({ error: 'Failed to parse document' });

      // Run all rule-based detectors in parallel
      const [
              metadata,
              comments,
              trackChanges,
              hiddenContent,
              sensitiveData,
              hygiene,
              speakerNotes,
              embeddedObjects,
              macros,
              formulas,
              docFields,
              brokenLinks,
            ] = await Promise.all([
              detectMetadata(parsedDoc, fileType),
              detectComments(parsedDoc, fileType),
              detectTrackChanges(parsedDoc, fileType),
              detectHiddenContent(parsedDoc, fileType),
              detectSensitiveData(parsedDoc.fullText || ''),
              detectHygiene(parsedDoc.fullText || ''),
              detectSpeakerNotes(parsedDoc, fileType),
              detectEmbeddedObjects(parsedDoc, fileType),
              detectMacros(parsedDoc, fileType, req.file.originalname),
              detectFormulas(parsedDoc, fileType),
              detectDocFields(parsedDoc, fileType),
              detectBrokenLinks(parsedDoc.fullText || ''),
            ]);

      // AI-powered detections (skip if fast mode)
      let spellingErrors: any[] = [];
          let aiDetection: any = null;

      if (!fast && parsedDoc.fullText && parsedDoc.fullText.trim().length > 50) {
              const [spellResult, aiResult] = await Promise.all([
                        mindorionIntelligenceService.runSpellCheck(parsedDoc.fullText, documentId),
                        mindorionIntelligenceService.runAiDetection(parsedDoc.fullText, documentId),
                      ]);
              spellingErrors = spellResult || [];
              aiDetection = aiResult || null;
      }

      const detections: any = {
              metadata,
              comments,
              trackChanges,
              hiddenContent: hiddenContent.general || [],
              sensitiveData,
              spellingErrors,
              speakerNotes,
              embeddedObjects,
              macros,
              visualObjects: [],
              hiddenSheets: hiddenContent.sheets || [],
              hiddenColumns: hiddenContent.columns || [],
              hiddenRows: hiddenContent.rows || [],
              hiddenRowsColumns: hiddenContent.rowsColumns || [],
              sensitiveFormulas: formulas,
              brokenLinks,
              docFields,
              docxFields: docFields,
              embeddedExcel: embeddedObjects.filter((o: any) => o.type === 'embedded_excel'),
              aiDetection,
              tableOfContents: parsedDoc.tableOfContents || [],
              sheetNames: parsedDoc.sheetNames || [],
              slideNames: parsedDoc.slideNames || [],
      };

      const { riskScore, riskLevel, cleanlinessScore, totalIssues, criticalIssues, recommendations } =
              calculateRiskScore(detections);

      // For proposal mode, run business intelligence
      let proposalIntelligence = null;
          if (analysisMode === 'proposal' && !fast && parsedDoc.fullText && parsedDoc.fullText.trim().length > 100) {
                  proposalIntelligence = await mindorionIntelligenceService.runProposalIntelligence(
                            parsedDoc.fullText,
                            documentId,
                            req.body.user_id,
                            req.body.org_id
                          );
          }

      const result = {
              documentId,
              fileName: req.file.originalname,
              fileType,
              documentStats: {
                        pages: parsedDoc.pages || null,
                        slides: parsedDoc.slides || null,
                        sheets: parsedDoc.sheets || null,
                        tables: parsedDoc.tables || null,
              },
              detections,
              summary: {
                        totalIssues,
                        criticalIssues,
                        riskScore,
                        riskLevel,
                        cleanlinessScore,
                        recommendations,
              },
              ...(proposalIntelligence ? { proposalIntelligence } : {}),
      };

      res.json(result);
    } catch (err: any) {
    console.error('Analyze error:', err);
          res.status(500).json({ error: err.message || 'Analysis failed' });
    }
});

export { router as analyzeRouter };
