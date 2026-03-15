# VendorGuard — AI-Powered Vendor Compliance Intake & Adjudication Pipeline — PRD

**Status:** Draft
**Author:** Yash
**Last Updated:** 2026-03-15
**Scope:** End-to-end AI pipeline that ingests vendor onboarding documents, classifies them, extracts structured data, assesses compliance risk, auto-adjudicates low-risk submissions, escalates high-risk ones for human review, logs all actions to an audit trail, and maintains vendor memory across submissions. This PRD does NOT cover production Gmail OAuth integration (simulated inbox is used), real payment processing, or multi-tenant access control.

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1 | 2026-03-15 | Yash | Initial draft — full pipeline spec |

---

## Assumptions & Inferences

> **Assumed:** The pipeline processes PDF documents uploaded via a web UI (simulating email attachments). **Basis:** Take-home scope uses sample data; real Gmail integration adds OAuth complexity beyond scope. **Override if:** Evaluator requires live Gmail integration.

> **Assumed:** Claude 3.5 Sonnet (or equivalent) is used for document classification and extraction via the Anthropic API. **Basis:** Free-tier API credits are available; Claude excels at structured extraction from documents. **Override if:** Budget requires open-source models only (switch to Llama 3 via Ollama).

> **Assumed:** Supabase is used for database (vendor records, audit log, memory). **Basis:** Free tier, instant setup, Postgres underneath, real-time subscriptions for dashboard updates. **Override if:** Evaluator prefers SQLite or Google Sheets only.

> **Assumed:** 5-10 sample documents are pre-created as PDFs covering NDAs, W-9s, Certificates of Insurance, SOC 2 reports, and Business Licenses. **Basis:** Take-home instructions require sample data with variety. **Override if:** Real documents are provided.

> **Assumed:** Risk scoring uses a deterministic rule engine (not ML). **Basis:** Rules are auditable, explainable, and match how Certa's adjudication works — policy-driven, not black-box. **Override if:** ML-based scoring is explicitly requested.

> **Assumed:** "Human review" means flagging in the dashboard with email notification (simulated). No actual approval workflow with auth roles. **Basis:** Take-home scope. **Override if:** Multi-role auth is required.

---

## Problem Statement

Enterprise procurement teams receive vendor onboarding document packages via email — typically 3-7 documents per vendor (NDAs, tax forms, insurance certificates, compliance reports, business licenses). Today, a compliance analyst manually:

1. Opens each attachment and identifies what type of document it is
2. Reads through to extract key fields (expiration dates, coverage amounts, entity names, tax IDs)
3. Cross-references fields across documents (does the entity name on the W-9 match the NDA?)
4. Checks for red flags (expired certificates, missing required clauses, incomplete forms)
5. Decides whether to approve, request more info, or escalate to a senior reviewer
6. Emails the vendor and/or internal stakeholders with the decision
7. Logs the outcome in a spreadsheet

This takes 2-3 hours per vendor, is wildly inconsistent between analysts, produces no structured audit trail, and creates zero institutional memory (the same vendor can submit expired insurance 3 times without anyone noticing the pattern).

VendorGuard eliminates steps 1-7 for low-risk submissions and reduces steps 1-6 to a 2-minute review for high-risk ones.

---

## System Context

### Systems Involved

```
Document Upload (Web UI)
    → Document Classifier (Claude API)
    → Data Extractor (Claude API + Schema Enforcement)
    → Risk Engine (Deterministic Rules)
    → Adjudicator (Decision Router)
    → Notification Service (Simulated Email / Console)
    → Audit Logger (Supabase)
    → Vendor Memory Store (Supabase)
    → Dashboard (Next.js Frontend)
```

### Tech Stack

| Component | Technology | Why |
|-----------|-----------|-----|
| Frontend | Next.js 14 (App Router) + Tailwind CSS + shadcn/ui | Modern, fast, great DX for Claude Code |
| Backend/API | Next.js API Routes (Route Handlers) | Co-located with frontend, serverless-ready |
| Database | Supabase (Postgres) | Free tier, real-time, instant setup |
| AI/LLM | Anthropic Claude API (claude-sonnet-4-20250514) | Best at structured extraction from documents |
| PDF Processing | pdf-parse (npm) | Extract text from PDF uploads |
| File Storage | Supabase Storage (or local /uploads in dev) | Store original documents |
| Audit Log | Supabase table + optional Google Sheets export | Structured, queryable audit trail |

### Auth & Access

- **Anthropic API:** API key stored in `.env.local` as `ANTHROPIC_API_KEY`
- **Supabase:** Project URL + anon key in `.env.local` as `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **No user auth for MVP** — single-user demo. Dashboard is open.

### Data Flow

```
[User uploads PDFs via UI]
    ↓
[API Route: /api/pipeline/ingest]
    → Saves files to Supabase Storage
    → Creates vendor_submission record (status: processing)
    ↓
[API Route: /api/pipeline/classify]
    → Sends PDF text to Claude with classification prompt
    → Returns document_type + confidence
    → Updates document record
    ↓
[API Route: /api/pipeline/extract]
    → Sends PDF text + document_type to Claude with extraction schema
    → Returns structured JSON per document type
    → Validates against schema
    → Updates document record with extracted_data
    ↓
[API Route: /api/pipeline/assess]
    → Runs deterministic rules against extracted data
    → Generates risk_flags[] and risk_score (LOW/MEDIUM/HIGH)
    → Cross-references across documents in same submission
    → Checks vendor memory for historical patterns
    → Updates submission record
    ↓
[API Route: /api/pipeline/adjudicate]
    → Routes based on risk_score:
      LOW → auto_approved
      MEDIUM → approved_with_conditions
      HIGH → escalated_to_human
    → Creates audit_log entry
    → Triggers notification (simulated)
    → Updates submission status
    ↓
[Dashboard reflects real-time status]
```

---

## Design Goals

1. **Pipeline-as-Stages:** Each pipeline step is an independent API route that can be called, retried, and debugged in isolation. A failure in extraction does not prevent classification results from being visible.

2. **Explainability over automation:** Every risk flag includes a human-readable reason. Every adjudication decision includes the rule that triggered it and the data that matched. No black-box decisions.

3. **Resilience to document variety:** The system handles PDFs it has never seen before by falling back to a generic extraction mode rather than crashing. Unknown document types get classified as "other" with a confidence score, not rejected.

4. **Vendor memory is first-class:** Historical submission data (flags, decisions, patterns) is queryable and informs current assessments. A vendor who submits expired insurance repeatedly should see that pattern reflected in their risk score.

5. **Demo-ready UI:** The dashboard should feel like a real product, not a prototype. Clean typography, proper loading states, clear information hierarchy. Someone should look at this and think "I'd use this."

6. **Auditability:** Every action (classification, extraction, flag, decision) is logged with timestamp, input hash, and output. The audit trail is the product's backbone.

### Error & Logging Convention

**Default severity levels:**
- `fatal` — pipeline cannot continue for this submission, requires manual restart
- `error` — step failed for one document, other documents continue processing
- `warning` — unexpected input handled with fallback (e.g., unknown doc type classified as "other")
- `info` — normal operation milestone (e.g., "classified NDA with 95% confidence")

**Required fields in every log entry:**
- `timestamp` (ISO 8601)
- `severity` (fatal | error | warning | info)
- `step` (classify | extract | assess | adjudicate)
- `submission_id` (UUID)
- `document_id` (UUID, if applicable)
- `message` (human-readable)
- `metadata` (JSON — any additional context)

---

## Data Model

### Table: vendors

| Field | Type | Required | Source | Notes |
|-------|------|----------|--------|-------|
| id | uuid | yes | Auto-generated | Primary key |
| name | string | yes | Extracted from documents or user input | Vendor/company name |
| entity_name | string | no | Extracted from W-9 or NDA | Legal entity name for cross-referencing |
| tax_id | string | no | Extracted from W-9 | EIN/SSN (masked in UI) |
| total_submissions | integer | yes | Computed | Count of submissions |
| last_submission_at | timestamp | no | Computed | Most recent submission date |
| risk_history | jsonb | yes | Computed | Array of past risk scores and flags |
| created_at | timestamp | yes | Auto-generated | |
| updated_at | timestamp | yes | Auto-generated | |

### Table: submissions

| Field | Type | Required | Source | Notes |
|-------|------|----------|--------|-------|
| id | uuid | yes | Auto-generated | Primary key |
| vendor_id | uuid | yes | FK to vendors | |
| status | enum | yes | Pipeline | Values: `pending`, `processing`, `classified`, `extracted`, `assessed`, `auto_approved`, `approved_with_conditions`, `escalated_to_human`, `human_approved`, `human_rejected`, `error` |
| risk_score | enum | no | Risk Engine | Values: `LOW`, `MEDIUM`, `HIGH`, null (before assessment) |
| risk_flags | jsonb | no | Risk Engine | Array of {flag_code, severity, message, document_id} |
| decision | enum | no | Adjudicator | Values: `auto_approved`, `approved_with_conditions`, `escalated`, `rejected` |
| decision_reason | string | no | Adjudicator | Human-readable explanation |
| decision_rule | string | no | Adjudicator | Rule ID that triggered the decision |
| decided_at | timestamp | no | Adjudicator | |
| decided_by | string | no | Adjudicator | "system" or reviewer name |
| created_at | timestamp | yes | Auto-generated | |
| updated_at | timestamp | yes | Auto-generated | |

### Table: documents

| Field | Type | Required | Source | Notes |
|-------|------|----------|--------|-------|
| id | uuid | yes | Auto-generated | Primary key |
| submission_id | uuid | yes | FK to submissions | |
| file_name | string | yes | Upload | Original filename |
| file_path | string | yes | Storage | Path in Supabase Storage |
| file_size | integer | yes | Upload | Bytes |
| raw_text | text | no | pdf-parse | Extracted text content |
| document_type | enum | no | Classifier | Values: `nda`, `w9`, `certificate_of_insurance`, `soc2_report`, `business_license`, `financial_statement`, `other` |
| classification_confidence | float | no | Classifier | 0.0 to 1.0 |
| extracted_data | jsonb | no | Extractor | Structured data per document type schema |
| extraction_status | enum | yes | Pipeline | Values: `pending`, `classified`, `extracted`, `error` |
| flags | jsonb | no | Risk Engine | Document-level flags |
| created_at | timestamp | yes | Auto-generated | |

### Table: audit_log

| Field | Type | Required | Source | Notes |
|-------|------|----------|--------|-------|
| id | uuid | yes | Auto-generated | Primary key |
| submission_id | uuid | yes | FK to submissions | |
| document_id | uuid | no | FK to documents | Null for submission-level events |
| step | enum | yes | Pipeline | Values: `ingest`, `classify`, `extract`, `assess`, `adjudicate`, `human_review`, `notify` |
| severity | enum | yes | Pipeline | Values: `info`, `warning`, `error`, `fatal` |
| message | string | yes | Pipeline | Human-readable log message |
| metadata | jsonb | no | Pipeline | Additional context (LLM response, rule matched, etc.) |
| created_at | timestamp | yes | Auto-generated | |

### Extraction Schemas (per document type)

**NDA:**
```json
{
  "parties": ["string"],
  "effective_date": "date | null",
  "expiration_date": "date | null",
  "governing_law": "string | null",
  "confidentiality_period": "string | null",
  "has_non_compete": "boolean",
  "has_non_solicitation": "boolean",
  "signature_present": "boolean",
  "key_clauses": ["string"]
}
```

**W-9 Tax Form:**
```json
{
  "entity_name": "string",
  "business_name": "string | null",
  "tax_classification": "string",
  "tax_id_type": "EIN | SSN",
  "tax_id_last4": "string",
  "address": "string",
  "signature_present": "boolean",
  "date_signed": "date | null"
}
```

**Certificate of Insurance:**
```json
{
  "insured_name": "string",
  "insurer_name": "string",
  "policy_number": "string",
  "effective_date": "date",
  "expiration_date": "date",
  "general_liability_limit": "number | null",
  "auto_liability_limit": "number | null",
  "umbrella_limit": "number | null",
  "workers_comp": "boolean",
  "certificate_holder": "string | null"
}
```

**SOC 2 Report:**
```json
{
  "report_type": "Type I | Type II",
  "auditor": "string",
  "audit_period_start": "date",
  "audit_period_end": "date",
  "trust_service_criteria": ["Security", "Availability", "Processing Integrity", "Confidentiality", "Privacy"],
  "opinion": "unqualified | qualified | adverse | disclaimer",
  "exceptions_noted": "boolean",
  "exception_summary": "string | null"
}
```

**Business License:**
```json
{
  "license_type": "string",
  "entity_name": "string",
  "issuing_authority": "string",
  "license_number": "string",
  "issue_date": "date",
  "expiration_date": "date | null",
  "status": "active | expired | suspended | unknown"
}
```

---

## Out of Scope

- Real Gmail OAuth integration (simulated email intake via file upload)
- Multi-tenant auth / RBAC (single-user demo)
- Production deployment (runs locally via `npm run dev`)
- Real notification delivery (logged to console + audit trail)
- Payment or billing integration
- Document editing or annotation
- Integration with external data providers (D&B, Moody's, etc.)
- Batch processing of 100+ documents (designed for 5-10 per submission)

---

## Phases & Epics

### Phase 1: Foundation & Document Intelligence

This phase delivers the core AI pipeline — document ingestion, classification, and extraction — with a functional dashboard. The goal is a working demo where you upload vendor documents and see structured results appear in real-time.

**Epics:**
- Epic 1: Project Setup & Database Schema
- Epic 2: Document Upload & Text Extraction
- Epic 3: AI Document Classification
- Epic 4: AI Structured Data Extraction
- Epic 5: Dashboard — Submission List & Document Detail Views

### Phase 2: Risk Assessment & Adjudication

This phase adds the decision-making layer — risk scoring, auto-adjudication, escalation routing, and audit logging. The pipeline becomes end-to-end: upload documents, get a decision.

**Epics:**
- Epic 6: Risk Assessment Engine
- Epic 7: Adjudication & Decision Routing
- Epic 8: Audit Trail & Logging
- Epic 9: Dashboard — Risk Flags, Decisions, Human Review Interface

### Phase 3: Memory, Notifications & Polish

This phase adds vendor memory (historical context), notification simulation, and UI polish. The system becomes "smart" — it knows about past submissions and flags patterns.

**Epics:**
- Epic 10: Vendor Memory & Historical Context
- Epic 11: Notification Service (Simulated)
- Epic 12: Dashboard Polish — Stats, Filters, Export

---

## User Stories

---

### Epic 1: Project Setup & Database Schema

#### US-1.1 — Initialize Next.js project with dependencies

**As a** developer setting up the project
**I want to** scaffold a Next.js 14 App Router project with Tailwind CSS, shadcn/ui, and Supabase client
**So that** all subsequent development has a consistent foundation

**Priority:** Must Have
**Depends on:** None
**Constraints:** Use `npx create-next-app@latest` with TypeScript. Install: `@supabase/supabase-js`, `pdf-parse`, `@anthropic-ai/sdk`, `lucide-react`. Initialize shadcn/ui with default theme.

### Acceptance Criteria

✅ **Positive:** `npm run dev` starts without errors on `localhost:3000`.
✅ **Positive:** `.env.local.example` file exists with all required env vars documented.
✅ **Positive:** Tailwind and shadcn/ui components render correctly.

❌ **Negative:** Missing env vars produce a clear error message at startup, not a cryptic runtime crash.

---

#### US-1.2 — Create Supabase schema and migrations

**As a** developer
**I want to** create all database tables (vendors, submissions, documents, audit_log) with proper types, constraints, and indexes
**So that** the pipeline has a structured data store from day one

**Priority:** Must Have
**Depends on:** US-1.1
**Constraints:** Use Supabase SQL editor or migration files. All UUID PKs use `gen_random_uuid()`. All tables have `created_at` defaulting to `now()`. Index on `submissions.status` and `submissions.vendor_id`. Index on `documents.submission_id`.

### Input
SQL migration file(s).

### Output
Tables created in Supabase with correct schema matching the Data Model section.

### Acceptance Criteria

✅ **Positive:** All four tables exist with correct columns, types, and constraints.
✅ **Positive:** Foreign key relationships enforce referential integrity.
✅ **Positive:** Inserting a submission with a non-existent vendor_id fails with FK violation.

❌ **Negative:** Attempting to insert a document with extraction_status value not in the enum fails.

---

### Epic 2: Document Upload & Text Extraction

#### US-2.1 — File upload API endpoint

**As a** user uploading vendor documents
**I want to** drag and drop one or more PDF files and have them stored with a new submission record
**So that** the pipeline can process them

**Priority:** Must Have
**Depends on:** US-1.2
**Constraints:** Max file size: 10MB per file. Max files per upload: 10. Only `.pdf` accepted. Files stored in Supabase Storage bucket `vendor-documents`. If Supabase Storage is unavailable, fall back to local `/tmp/uploads/` directory.

### Input
```
POST /api/pipeline/ingest
Content-Type: multipart/form-data
Body: { vendor_name: string, files: File[] }
```

### Output
```json
{
  "submission_id": "uuid",
  "vendor_id": "uuid",
  "documents": [
    {
      "document_id": "uuid",
      "file_name": "nda_acme.pdf",
      "file_size": 245000,
      "status": "pending"
    }
  ]
}
```

### Acceptance Criteria

✅ **Positive:** Uploading 3 PDFs creates 1 submission record and 3 document records, all linked.
✅ **Positive:** If vendor_name matches an existing vendor, the submission is linked to the existing vendor (case-insensitive match on name).
✅ **Positive:** If vendor_name is new, a new vendor record is created.

❌ **Negative:** Uploading a `.docx` file returns 400 with message "Only PDF files are accepted."
❌ **Negative:** Uploading a file >10MB returns 413 with message "File exceeds 10MB limit."
❌ **Negative:** Uploading 0 files returns 400 with message "At least one document is required."

⚠️ **Non-functional:** Upload + record creation completes in <3s for 5 files totaling 5MB.

---

#### US-2.2 — PDF text extraction

**As a** the pipeline
**I want to** extract raw text from each uploaded PDF
**So that** downstream classification and extraction have text to work with

**Priority:** Must Have
**Depends on:** US-2.1
**Constraints:** Use `pdf-parse` npm package. Store extracted text in `documents.raw_text`. If text extraction fails (scanned image PDF, corrupted file), set `extraction_status` to `error` and log the error. Do not halt processing of other documents in the same submission.

### Input
Document record with `file_path` pointing to stored PDF.

### Output
Document record updated with `raw_text` (string, may be very long) and `extraction_status: "pending"` (ready for classification).

### Acceptance Criteria

✅ **Positive:** A standard text-based PDF yields raw_text with >50 characters.
✅ **Positive:** A multi-page PDF has all pages' text concatenated.

❌ **Negative:** A scanned-image PDF (no selectable text) sets `extraction_status: "error"` with log message "No text content extracted — possible scanned image."
❌ **Negative:** A corrupted PDF (invalid bytes) sets `extraction_status: "error"` with log message "PDF parsing failed: [error details]."

---

### Epic 3: AI Document Classification

#### US-3.1 — Classify document type via LLM

**As a** the pipeline
**I want to** send each document's raw text to Claude and receive a document type classification with confidence score
**So that** the extractor knows which schema to apply

**Priority:** Must Have
**Depends on:** US-2.2
**Constraints:** Single Claude API call per document. Max input: first 4000 characters of raw_text (to control token usage). Response must be valid JSON. If Claude returns an unrecognized type, map to "other". If API call fails, retry once after 2s; if still failing, set `extraction_status: "error"`.

### Input
```
POST /api/pipeline/classify
Body: { document_id: "uuid" }
```

Raw text from `documents.raw_text` (truncated to 4000 chars).

### Output
Document record updated:
```json
{
  "document_type": "nda",
  "classification_confidence": 0.95,
  "extraction_status": "classified"
}
```

Audit log entry created with step: "classify", severity: "info".

### Acceptance Criteria

✅ **Positive:** An NDA document is classified as "nda" with confidence > 0.8.
✅ **Positive:** A W-9 form is classified as "w9" with confidence > 0.8.
✅ **Positive:** All 7 document types (nda, w9, certificate_of_insurance, soc2_report, business_license, financial_statement, other) are handled.

❌ **Negative:** If Claude returns `"type": "contract"` (not in our enum), it is mapped to "other" with a warning log.
❌ **Negative:** If Claude API returns 429 (rate limited), retry after 2s. If 429 again, set error status.
❌ **Negative:** If Claude returns malformed JSON, log the raw response, set error status.

⚠️ **Non-functional:** Classification completes in <5s per document (single API call).

---

### Epic 4: AI Structured Data Extraction

#### US-4.1 — Extract structured data per document type

**As a** the pipeline
**I want to** send each classified document's text to Claude with the appropriate extraction schema and receive structured JSON
**So that** the risk engine has clean, typed data to evaluate

**Priority:** Must Have
**Depends on:** US-3.1
**Constraints:** Extraction prompt includes the target schema (from Data Model section) as a JSON template. Claude must return data conforming to the schema. If a field cannot be extracted, it should be null, not omitted. Validate returned JSON against expected schema — log warnings for unexpected fields, errors for missing required fields.

### Input
```
POST /api/pipeline/extract
Body: { document_id: "uuid" }
```

Document's `raw_text` + `document_type` used to select the extraction prompt.

### Output
Document record updated:
```json
{
  "extracted_data": { /* schema-conforming JSON */ },
  "extraction_status": "extracted"
}
```

### Acceptance Criteria

✅ **Positive:** An NDA document produces extracted_data with all fields from the NDA schema.
✅ **Positive:** A Certificate of Insurance with clearly stated limits returns numeric values for liability limits.
✅ **Positive:** A document with a missing expiration date returns `"expiration_date": null` (not omitted).

❌ **Negative:** If Claude returns a field not in the schema (e.g., "additional_notes"), it is stored but a warning is logged.
❌ **Negative:** If Claude fails to return valid JSON, raw response is logged as error, `extraction_status` set to "error".
❌ **Negative:** For document_type "other", a generic extraction is performed: `{"summary": "string", "key_dates": [], "key_entities": [], "key_amounts": []}`.

---

### Epic 5: Dashboard — Submission List & Document Detail

#### US-5.1 — Submission list view (main dashboard)

**As a** compliance analyst
**I want to** see all vendor submissions in a table with status, vendor name, document count, risk score, and date
**So that** I can quickly triage which submissions need attention

**Priority:** Must Have
**Depends on:** US-2.1
**Constraints:** Table uses shadcn/ui DataTable. Sortable by date, status, risk score. Filterable by status. Real-time updates via Supabase subscription or polling (every 5s). Paginated — 20 per page. Status shown as colored badge: green (approved), yellow (conditions), red (escalated), gray (processing), blue (pending).

### Acceptance Criteria

✅ **Positive:** After uploading documents, the submission appears in the table within 5s.
✅ **Positive:** Clicking a row navigates to the submission detail view.
✅ **Positive:** Filtering by "escalated_to_human" shows only escalated submissions.

❌ **Negative:** If Supabase is unreachable, show a "Connection error — retrying..." banner, not a blank page.

---

#### US-5.2 — Submission detail view

**As a** compliance analyst
**I want to** see all documents in a submission with their classification, extracted data, risk flags, and the overall decision
**So that** I can review the AI's work and make informed decisions

**Priority:** Must Have
**Depends on:** US-3.1, US-4.1
**Constraints:** Left panel: document list with type icons and status. Right panel: selected document's details. Extracted data rendered as a clean key-value card (not raw JSON). Risk flags shown as alert banners (red for high, yellow for medium). Overall submission risk score and decision shown in a header card.

### Acceptance Criteria

✅ **Positive:** Clicking a document in the left panel shows its extracted data in the right panel.
✅ **Positive:** Risk flags are displayed with severity icon, flag code, and human-readable message.
✅ **Positive:** If extraction is still in progress, a loading skeleton is shown for that document.

❌ **Negative:** If a document has extraction_status "error", show the error message from the audit log, not a generic "Something went wrong."

---

### Epic 6: Risk Assessment Engine

#### US-6.1 — Run deterministic risk rules against extracted data

**As a** the pipeline
**I want to** evaluate extracted data from all documents in a submission against a set of business rules and generate risk flags
**So that** the adjudicator has a structured risk profile to act on

**Priority:** Must Have
**Depends on:** US-4.1
**Constraints:** Rules are defined as a JSON config (not hardcoded logic). Each rule has: `id`, `name`, `condition` (function), `severity` (critical/high/medium/low), `message_template`. Rules run in priority order. All matching rules generate flags — not just the first match.

### Input
```
POST /api/pipeline/assess
Body: { submission_id: "uuid" }
```

All documents in the submission with `extraction_status: "extracted"`.

### Output
Submission updated with `risk_flags` array and `risk_score`:
```json
{
  "risk_flags": [
    {
      "flag_code": "INSURANCE_EXPIRED",
      "severity": "critical",
      "message": "Certificate of Insurance expired on 2025-12-01 (104 days ago)",
      "document_id": "uuid",
      "rule_id": "R-003"
    }
  ],
  "risk_score": "HIGH"
}
```

### Risk Rules (initial set)

| Rule ID | Name | Condition | Severity | Message Template |
|---------|------|-----------|----------|-----------------|
| R-001 | Missing required document | Required doc types (NDA, W-9, COI) not all present | critical | "Missing required document: {doc_type}" |
| R-002 | Insurance expiring soon | COI expiration_date within 30 days of today | medium | "Insurance expires in {days} days ({date})" |
| R-003 | Insurance expired | COI expiration_date is in the past | critical | "Insurance expired on {date} ({days} days ago)" |
| R-004 | Entity name mismatch | entity_name on W-9 does not fuzzy-match parties on NDA | high | "Entity name mismatch: W-9 says '{w9_name}', NDA says '{nda_name}'" |
| R-005 | Missing signature | NDA or W-9 has signature_present: false | high | "Missing signature on {doc_type}" |
| R-006 | SOC 2 report stale | SOC 2 audit_period_end > 12 months ago | medium | "SOC 2 report is {months} months old" |
| R-007 | SOC 2 qualified opinion | SOC 2 opinion is not "unqualified" | high | "SOC 2 has {opinion} opinion" |
| R-008 | Business license expired | Business license expiration_date in the past | critical | "Business license expired on {date}" |
| R-009 | Low insurance coverage | General liability limit < $1,000,000 | medium | "General liability coverage is ${amount} (below $1M minimum)" |
| R-010 | Repeat offender | Vendor memory shows same flag in past 2 submissions | high | "Recurring issue: {flag_code} flagged {count} times previously" |

### Risk Score Calculation

```
If any flag with severity "critical" → risk_score = "HIGH"
Else if any flag with severity "high" → risk_score = "HIGH"
Else if count of "medium" flags >= 2 → risk_score = "MEDIUM"
Else if count of "medium" flags == 1 → risk_score = "MEDIUM"
Else → risk_score = "LOW"
```

### Acceptance Criteria

✅ **Positive:** A submission with all required docs, valid dates, matching entity names → risk_score "LOW", empty flags.
✅ **Positive:** A submission with expired insurance → flag R-003, risk_score "HIGH".
✅ **Positive:** A submission missing a W-9 → flag R-001, risk_score "HIGH".
✅ **Positive:** Multiple flags from different rules all appear in the flags array.

❌ **Negative:** If a document has extraction_status "error", its rules are skipped but a warning flag is added: "Could not assess {doc_type} — extraction failed."
❌ **Negative:** If extracted_data is null for a document, rules for that document type are skipped gracefully.

---

### Epic 7: Adjudication & Decision Routing

#### US-7.1 — Auto-adjudicate based on risk score

**As a** the pipeline
**I want to** automatically approve low-risk submissions, conditionally approve medium-risk ones, and escalate high-risk ones
**So that** only submissions requiring human judgment reach a reviewer

**Priority:** Must Have
**Depends on:** US-6.1

### Input
```
POST /api/pipeline/adjudicate
Body: { submission_id: "uuid" }
```

### Output
Submission updated:
```json
{
  "status": "auto_approved | approved_with_conditions | escalated_to_human",
  "decision": "auto_approved | approved_with_conditions | escalated",
  "decision_reason": "All documents present and compliant. No risk flags detected.",
  "decision_rule": "ADJ-LOW-AUTO",
  "decided_at": "2026-03-15T10:30:00Z",
  "decided_by": "system"
}
```

### Adjudication Rules

| Risk Score | Decision | Status | Action |
|-----------|----------|--------|--------|
| LOW | auto_approved | auto_approved | Log approval, notify vendor (simulated) |
| MEDIUM | approved_with_conditions | approved_with_conditions | Log conditional approval with flag details, notify vendor with conditions, notify internal reviewer |
| HIGH | escalated | escalated_to_human | Log escalation, notify compliance manager with full risk summary |

### Acceptance Criteria

✅ **Positive:** LOW risk submission → auto_approved within 1s of assessment completing.
✅ **Positive:** MEDIUM risk → approved_with_conditions, decision_reason lists the specific conditions.
✅ **Positive:** HIGH risk → escalated_to_human, decision_reason includes all critical/high flags.

❌ **Negative:** If risk assessment hasn't completed (status not "assessed"), return 400 "Submission not yet assessed."

---

#### US-7.2 — Human review action

**As a** compliance analyst
**I want to** approve or reject an escalated submission from the dashboard with a note
**So that** the submission is resolved and the audit trail is complete

**Priority:** Must Have
**Depends on:** US-7.1, US-5.2

### Input
```
POST /api/submissions/{id}/review
Body: { decision: "approved" | "rejected", note: "string" }
```

### Output
Submission updated with `status: "human_approved" | "human_rejected"`, `decided_by: "reviewer"`, `decision_reason` includes the note.

### Acceptance Criteria

✅ **Positive:** Approving an escalated submission updates status and creates an audit log entry.
✅ **Positive:** The note appears in the decision_reason field.

❌ **Negative:** Attempting to review a submission that is not in "escalated_to_human" status returns 400.
❌ **Negative:** Empty note with rejection returns 400 — "A note is required when rejecting."

---

### Epic 8: Audit Trail & Logging

#### US-8.1 — Comprehensive audit logging

**As a** the pipeline
**I want to** log every pipeline step, decision, and error to the audit_log table
**So that** there is a complete, queryable history of what happened to every submission

**Priority:** Must Have
**Depends on:** US-1.2
**Constraints:** Audit log entries are immutable — no updates or deletes. Every API route in the pipeline creates at least one audit log entry. Error entries include the full error message and stack trace in metadata.

### Acceptance Criteria

✅ **Positive:** Processing a 3-document submission from upload to decision creates 8+ audit log entries (ingest, 3x classify, 3x extract, assess, adjudicate).
✅ **Positive:** Each entry has all required fields per the logging convention.

---

### Epic 9: Dashboard — Risk & Review Interface

#### US-9.1 — Risk flag visualization

**As a** compliance analyst viewing a submission
**I want to** see all risk flags organized by severity with clear visual hierarchy
**So that** I can quickly understand what's wrong and prioritize

**Priority:** Must Have
**Depends on:** US-6.1, US-5.2

### Acceptance Criteria

✅ **Positive:** Critical flags appear as red alert cards at the top.
✅ **Positive:** Each flag links to the specific document that triggered it.
✅ **Positive:** Cross-reference flags (entity mismatch) show both document names.

---

#### US-9.2 — Human review controls

**As a** compliance analyst
**I want to** approve or reject an escalated submission directly from the detail view with a note
**So that** I don't need to switch between screens to take action

**Priority:** Must Have
**Depends on:** US-7.2

### Acceptance Criteria

✅ **Positive:** Approve/Reject buttons visible only for "escalated_to_human" submissions.
✅ **Positive:** Clicking Reject opens a required note field before submitting.
✅ **Positive:** After action, the page updates to show the new status without full reload.

---

### Epic 10: Vendor Memory & Historical Context

#### US-10.1 — Store and query vendor history

**As a** the risk engine
**I want to** check a vendor's historical submissions and flags before scoring the current one
**So that** repeat issues are surfaced and risk scores reflect patterns, not just point-in-time data

**Priority:** Should Have
**Depends on:** US-6.1
**Constraints:** Query vendor's past submissions (last 5) and aggregate flags. Use `vendors.risk_history` JSONB field to cache commonly accessed data. Update risk_history after each submission is adjudicated.

### Acceptance Criteria

✅ **Positive:** A vendor submitting expired insurance for the 3rd time gets flag R-010 with count: 3.
✅ **Positive:** A vendor's first submission has no historical flags.
✅ **Positive:** Vendor detail page shows a timeline of past submissions with outcomes.

---

### Epic 11: Notification Service

#### US-11.1 — Simulated email notifications

**As a** the adjudicator
**I want to** generate notification messages for each decision type and log them
**So that** the pipeline demonstrates the full workflow including stakeholder communication

**Priority:** Should Have
**Depends on:** US-7.1

### Acceptance Criteria

✅ **Positive:** Auto-approved generates a "vendor approved" notification logged to audit trail.
✅ **Positive:** Escalated generates a "review required" notification with risk summary.
✅ **Positive:** All notifications visible in a "Notifications" tab on the dashboard.

---

### Epic 12: Dashboard Polish & Stats

#### US-12.1 — Dashboard statistics header

**As a** a compliance manager
**I want to** see aggregate stats at the top of the dashboard: total submissions, auto-approved %, escalated count, average processing time
**So that** I can monitor pipeline health at a glance

**Priority:** Could Have
**Depends on:** US-7.1

### Acceptance Criteria

✅ **Positive:** Stats update in real-time as submissions are processed.
✅ **Positive:** Stats cards use large, readable typography with trend indicators.

---

#### US-12.2 — Pipeline orchestrator — one-click full processing

**As a** a user who just uploaded documents
**I want to** click "Process" and have the entire pipeline (classify → extract → assess → adjudicate) run automatically
**So that** I don't need to trigger each step manually

**Priority:** Must Have
**Depends on:** US-3.1, US-4.1, US-6.1, US-7.1

### Input
```
POST /api/pipeline/run
Body: { submission_id: "uuid" }
```

### Output
Submission processed through all stages. Status updates at each stage (visible on dashboard via polling/subscription).

### Acceptance Criteria

✅ **Positive:** Uploading 5 documents and clicking Process runs the full pipeline, updating status at each stage.
✅ **Positive:** If one document fails extraction, others continue processing and risk assessment runs on available data.

❌ **Negative:** If all documents fail text extraction, pipeline stops at "error" with message "No documents could be processed."

---

## Known Gaps & Risks

| Gap | Description | Severity | Resolution Path |
|-----|-------------|----------|-----------------|
| G-001 | Scanned/image PDFs cannot be text-extracted without OCR | Medium | Add Tesseract.js OCR as a fallback in US-2.2. Not in MVP scope. |
| G-002 | Entity name matching (R-004) uses simple string comparison | Medium | Implement Levenshtein distance or LLM-based fuzzy matching. Simple `toLowerCase().includes()` for MVP. |
| G-003 | Claude API rate limits may throttle batch processing | Low | Pipeline processes documents sequentially with 1s delay between API calls. Sufficient for 10-doc submissions. |
| G-004 | No real email integration | Low | Simulated via file upload. Gmail OAuth can be added post-MVP. |
| G-005 | Extraction accuracy depends on PDF text quality | Medium | Classification confidence threshold (< 0.6 triggers warning). Extraction validated against schema. |

---

## Definition of Done

### Story-Level DoD

```
- [ ] All acceptance criteria pass (positive, negative, non-functional)
- [ ] Error paths return structured log output per the logging convention
- [ ] Input/output contracts match the data model
- [ ] API routes handle Claude API unavailability (timeout, 500) with retry + error status
- [ ] UI components have proper loading and error states
```

### PRD-Level DoD

```
- [ ] All Must Have stories pass their story-level DoD
- [ ] End-to-end test: upload 5 sample documents → full pipeline → correct adjudication decision
- [ ] Dashboard displays all stages of processing in real-time
- [ ] Audit log contains complete history for every test submission
- [ ] Sample documents (10 PDFs) included in /sample-documents/ directory
- [ ] README.md with setup instructions, env vars, and demo walkthrough
```
