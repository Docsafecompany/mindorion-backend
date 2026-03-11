export type SupportedFileType = 'docx' | 'pptx' | 'xlsx' | 'xls' | 'pdf';

// Local interface to avoid dependency on Express.Multer namespace
interface MulterFile {
    fieldname: string;
    originalname: string;
    encoding: string;
    mimetype: string;
    size: number;
    buffer: Buffer;
    destination?: string;
    filename?: string;
    path?: string;
}

const MIME_TO_TYPE: Record<string, SupportedFileType> = {
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/vnd.ms-excel': 'xls',
    'application/pdf': 'pdf',
};

const EXT_TO_TYPE: Record<string, SupportedFileType> = {
    'docx': 'docx',
    'docm': 'docx',
    'pptx': 'pptx',
    'pptm': 'pptx',
    'xlsx': 'xlsx',
    'xlsm': 'xlsx',
    'xlsb': 'xlsx',
    'xls': 'xls',
    'xltm': 'xlsx',
    'pdf': 'pdf',
};

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

export interface ValidationResult {
    valid: boolean;
    fileType?: SupportedFileType;
    error?: string;
}

export function validateFile(file: MulterFile): ValidationResult {
    if (!file) {
          return { valid: false, error: 'No file provided' };
    }

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
        return { valid: false, error: 'File too large. Maximum size is 100MB.' };
  }

  // Determine file type from MIME type first
  let fileType = MIME_TO_TYPE[file.mimetype];

  // Fallback to extension
  if (!fileType) {
        const ext = (file.originalname.split('.').pop() || '').toLowerCase();
        fileType = EXT_TO_TYPE[ext];
  }

  if (!fileType) {
        return {
                valid: false,
                error: 'Unsupported file type. Supported formats: DOCX, PPTX, XLSX, XLS, PDF',
        };
  }

  // Basic magic bytes check
  if (file.buffer && file.buffer.length > 4) {
        const magic = file.buffer.slice(0, 4);
        const isZip = magic[0] === 0x50 && magic[1] === 0x4B && magic[2] === 0x03 && magic[3] === 0x04;
        const isPdf = magic[0] === 0x25 && magic[1] === 0x50 && magic[2] === 0x44 && magic[3] === 0x46;
        const isOld = magic[0] === 0xD0 && magic[1] === 0xCF && magic[2] === 0x11 && magic[3] === 0xE0; // Old OLE format (xls, doc)

      if (fileType === 'pdf' && !isPdf) {
              return { valid: false, error: 'File content does not match PDF format' };
      }

      if (['docx', 'pptx', 'xlsx'].includes(fileType) && !isZip) {
              // Could be old format
          if (!isOld) {
                    return { valid: false, error: 'File content does not match Office format' };
          }
      }
  }

  return { valid: true, fileType };
}
