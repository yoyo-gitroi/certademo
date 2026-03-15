# VendorGuard

AI-powered vendor compliance intake and adjudication pipeline. Upload vendor onboarding documents (NDAs, W-9s, Certificates of Insurance, SOC 2 reports, Business Licenses), and the system automatically classifies them, extracts structured data, assesses compliance risk, and makes adjudication decisions.

## Tech Stack

- **Frontend**: Next.js 14 (App Router) + Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: Supabase (Postgres)
- **AI/LLM**: Anthropic Claude API (claude-sonnet-4-20250514)
- **PDF Processing**: pdf-parse

## Setup

### Prerequisites

- Node.js 18+
- A Supabase project (free tier works)
- An Anthropic API key

### 1. Install Dependencies

```bash
cd vendorguard
npm install
```

### 2. Configure Environment Variables

```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your credentials:

```
ANTHROPIC_API_KEY=sk-ant-...
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

### 3. Set Up Database

Run the SQL schema in your Supabase SQL editor:

```bash
cat supabase/schema.sql
```

Copy and paste the contents into the Supabase SQL Editor and execute.

### 4. Generate Sample Documents

```bash
node scripts/generate-samples.js
```

This creates 5 sample PDFs in `sample-documents/`:
- `nda_acme_corp.pdf` — Mutual NDA
- `w9_acme_corp.pdf` — W-9 Tax Form (entity name slightly different for testing)
- `coi_acme_corp.pdf` — Certificate of Insurance (expired, triggers risk flags)
- `soc2_acme_corp.pdf` — SOC 2 Type II Report (>12 months old)
- `business_license_acme.pdf` — Active Business License

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Demo Walkthrough

1. **Upload Documents**: Enter a vendor name (e.g., "Acme Corporation") and drag/drop the sample PDFs
2. **Watch Processing**: The pipeline automatically runs classification → extraction → assessment → adjudication
3. **Review Results**: Click on the submission to see:
   - Classified document types with confidence scores
   - Extracted structured data per document
   - Risk flags (expired insurance, entity name mismatch, stale SOC 2)
   - Adjudication decision (likely HIGH risk → escalated for human review)
4. **Human Review**: For escalated submissions, approve or reject with a note

## Pipeline Architecture

```
Upload PDFs → Ingest & Extract Text → Classify (Claude AI) → Extract Data (Claude AI)
    → Risk Assessment (Rule Engine) → Adjudicate (Decision Router) → Dashboard
```

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/pipeline/ingest` | POST | Upload PDFs, create submission |
| `/api/pipeline/classify` | POST | Classify documents via LLM |
| `/api/pipeline/extract` | POST | Extract structured data via LLM |
| `/api/pipeline/assess` | POST | Run risk assessment rules |
| `/api/pipeline/adjudicate` | POST | Route decision based on risk |
| `/api/pipeline/run` | POST | Run full pipeline end-to-end |
| `/api/submissions` | GET | List all submissions |
| `/api/submissions/[id]` | GET | Get submission details |
| `/api/submissions/[id]/review` | POST | Human review action |

### Risk Rules

| Rule | Description | Severity |
|------|-------------|----------|
| R-001 | Missing required document (NDA, W-9, COI) | Critical |
| R-002 | Insurance expiring within 30 days | Medium |
| R-003 | Insurance expired | Critical |
| R-004 | Entity name mismatch (W-9 vs NDA) | High |
| R-005 | Missing signature on NDA or W-9 | High |
| R-006 | SOC 2 report older than 12 months | Medium |
| R-007 | SOC 2 non-unqualified opinion | High |
| R-008 | Business license expired | Critical |
| R-009 | General liability coverage below $1M | Medium |
| R-010 | Repeat offender (same flag in past submissions) | High |

## Database Schema

Four tables: `vendors`, `submissions`, `documents`, `audit_log`. See `supabase/schema.sql` for full schema.

## Project Structure

```
vendorguard/
├── src/
│   ├── app/
│   │   ├── api/pipeline/     # Pipeline API routes
│   │   ├── api/submissions/  # Submission API routes
│   │   ├── submissions/[id]/ # Submission detail page
│   │   ├── page.tsx          # Dashboard
│   │   ├── layout.tsx        # Root layout
│   │   └── globals.css       # Global styles
│   ├── components/
│   │   ├── ui/               # Reusable UI components
│   │   ├── dashboard.tsx     # Main dashboard
│   │   └── submission-detail.tsx
│   ├── lib/
│   │   ├── adjudicator.ts    # Decision routing
│   │   ├── anthropic.ts      # Anthropic client
│   │   ├── classifier.ts     # Document classification
│   │   ├── db.ts             # Database helpers
│   │   ├── extractor.ts      # Data extraction
│   │   ├── prompts.ts        # LLM prompts
│   │   ├── risk-engine.ts    # Risk assessment rules
│   │   ├── supabase.ts       # Supabase client
│   │   └── utils.ts          # Utilities
│   └── types/
│       └── index.ts          # TypeScript types
├── sample-documents/         # Sample PDFs for testing
├── supabase/
│   └── schema.sql            # Database schema
├── scripts/
│   └── generate-samples.js   # PDF generator
└── package.json
```
