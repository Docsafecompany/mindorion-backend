# Mindorion Backend

Document Intelligence Engine for Mindorion — Node.js/Express/TypeScript API.

## Overview

This backend powers two products:
- **Qualion For All**: Technical document hygiene scanner (rules-based + AI spell check + AI content detection)
- **Qualion Proposal**: Executive Send Gate for business proposals (all hygiene + business intelligence via Claude)

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express + TypeScript
- **AI**: Anthropic Claude SDK (claude-sonnet-4-5)
- **Database**: Supabase (PostgreSQL)
- **Deployment**: Render.com

## Supported File Formats

| Format | Extension | Parsing | Cleaning |
|--------|-----------|---------|---------|
| Word | .docx, .docm | Full | Yes |
| PowerPoint | .pptx, .pptm | Full | Yes |
| Excel | .xlsx, .xlsm, .xls | Full | Yes |
| PDF | .pdf | Text + Metadata | Read-only |

## API Endpoints

### GET /health
Health check endpoint.

### POST /analyze
Analyze a document for issues.

**Request**: multipart/form-data
- `file`: Document file
- `analysis_mode`: "basic" | "proposal" (default: "proposal")
- Query: `?fast=true` to skip AI checks

**Response**: JSON with detections and risk score

### POST /clean
Clean a document and generate a sanitization report.

**Request**: multipart/form-data
- `file`: Document file
- Various cleaning options as form fields

**Response**: ZIP file containing cleaned document + HTML + JSON reports

## Detection Categories

1. **Metadata Exposure** - Author, company, revision history
2. **Comments & Annotations** - All comment types
3. **Track Changes** - Insertions, deletions, modifications
4. **Hidden Content** - Vanished text, hidden slides/sheets
5. **Sensitive Data** - PII, financial data, internal paths (regex)
6. **Document Hygiene** - Placeholders, garbled text
7. **Spelling & Grammar** - AI-powered via Claude
8. **Speaker Notes** - PPTX speaker notes
9. **Embedded Objects** - OLE objects, external references
10. **Macros** - VBA project detection
11. **Document Fields** - Dynamic fields (DOCX)
12. **Sensitive Formulas** - External workbook references (XLSX)
13. **Broken Links** - Intranet URLs, file:// paths
14. **AI Content Detection** - Estimates likelihood of AI generation

## Environment Variables

```env
ANTHROPIC_API_KEY=sk-ant-...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
PORT=3000
NODE_ENV=production
CORS_ORIGINS=https://your-app.lovable.app,http://localhost:5173
```

## Development

```bash
npm install
cp .env.example .env
# Fill in your environment variables
npm run dev
```

## Build & Deploy

```bash
npm run build
npm start
```

Deployment is automated via Render.com using `render.yaml`.

## Supabase Tables

- `document_analyses` - Analysis results
- `proposal_signals` - Risk findings
- `proposal_dimension_scores` - Dimension scores
- `proposal_strength_signals` - Positive signals
- `usage_events` - API usage tracking

## Architecture

The intelligence service (`src/intelligence/service.ts`) is the ONLY module that calls Claude. All AI-powered features (spell check, AI detection, proposal intelligence, text rewriting) are routed through this central service.
