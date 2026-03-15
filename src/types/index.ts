// ─── Enums & Union Types ─────────────────────────────────────────────────────

export type DocumentType =
  | "nda"
  | "w9"
  | "certificate_of_insurance"
  | "soc2_report"
  | "business_license"
  | "financial_statement"
  | "other";

export type SubmissionStatus =
  | "pending"
  | "processing"
  | "classified"
  | "extracted"
  | "assessed"
  | "auto_approved"
  | "approved_with_conditions"
  | "escalated_to_human"
  | "human_approved"
  | "human_rejected"
  | "error";

export type RiskScore = "LOW" | "MEDIUM" | "HIGH" | null;

export type ExtractionStatus = "pending" | "classified" | "extracted" | "error";

export type Severity = "info" | "warning" | "error" | "fatal";

export type PipelineStep =
  | "ingest"
  | "classify"
  | "extract"
  | "assess"
  | "adjudicate"
  | "human_review"
  | "notify";

export type Decision =
  | "auto_approved"
  | "approved_with_conditions"
  | "escalated"
  | "rejected";

// ─── Core Interfaces ─────────────────────────────────────────────────────────

export interface Vendor {
  id: string;
  name: string;
  email: string;
  company_name: string;
  phone?: string;
  address?: string;
  created_at: string;
  updated_at: string;
}

export interface Submission {
  id: string;
  vendor_id: string;
  status: SubmissionStatus;
  risk_score: RiskScore;
  decision?: Decision;
  decision_reasoning?: string;
  conditions?: string[];
  submitted_at: string;
  processed_at?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
  updated_at: string;
  documents?: Document[];
  vendor?: Vendor;
  audit_log?: AuditLogEntry[];
}

export interface Document {
  id: string;
  submission_id: string;
  file_name: string;
  file_url: string;
  file_size: number;
  mime_type: string;
  document_type?: DocumentType;
  extraction_status: ExtractionStatus;
  classification_confidence?: number;
  extracted_data?: Record<string, unknown>;
  risk_flags?: RiskFlag[];
  created_at: string;
  updated_at: string;
}

export interface AuditLogEntry {
  id: string;
  submission_id: string;
  step: PipelineStep;
  status: "started" | "completed" | "failed";
  message: string;
  metadata?: Record<string, unknown>;
  duration_ms?: number;
  created_at: string;
}

export interface RiskFlag {
  id: string;
  document_id: string;
  field: string;
  severity: Severity;
  message: string;
  expected_value?: string;
  actual_value?: string;
  created_at: string;
}

// ─── Extraction Schemas ──────────────────────────────────────────────────────

export interface NDAExtraction {
  parties: string[];
  effective_date?: string;
  expiration_date?: string;
  governing_law?: string;
  confidentiality_period_years?: number;
  mutual: boolean;
  non_compete_clause: boolean;
  non_solicitation_clause: boolean;
  permitted_disclosures?: string[];
}

export interface W9Extraction {
  name: string;
  business_name?: string;
  federal_tax_classification:
    | "individual"
    | "c_corporation"
    | "s_corporation"
    | "partnership"
    | "trust_estate"
    | "llc"
    | "other";
  llc_tax_classification?: string;
  exempt_payee_code?: string;
  fatca_exemption_code?: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  tin_type: "ssn" | "ein";
  tin_last_four: string;
  signature_date?: string;
  certification_signed: boolean;
}

export interface COIExtraction {
  insured_name: string;
  insurer_name: string;
  policy_number: string;
  effective_date: string;
  expiration_date: string;
  general_liability_limit?: number;
  auto_liability_limit?: number;
  umbrella_liability_limit?: number;
  workers_comp_limit?: number;
  professional_liability_limit?: number;
  certificate_holder?: string;
  additional_insured: boolean;
  waiver_of_subrogation: boolean;
  blanket_additional_insured: boolean;
}

export interface SOC2Extraction {
  auditor_name: string;
  audit_period_start: string;
  audit_period_end: string;
  report_date: string;
  report_type: "Type I" | "Type II";
  trust_service_criteria: (
    | "Security"
    | "Availability"
    | "Processing Integrity"
    | "Confidentiality"
    | "Privacy"
  )[];
  opinion: "unqualified" | "qualified" | "adverse" | "disclaimer";
  exceptions_noted: boolean;
  number_of_exceptions?: number;
  management_response_included: boolean;
  subservice_organizations?: string[];
}

export interface BusinessLicenseExtraction {
  license_number: string;
  business_name: string;
  license_type: string;
  issuing_authority: string;
  issuing_state?: string;
  issue_date: string;
  expiration_date: string;
  status: "active" | "expired" | "suspended" | "revoked";
  licensed_activities?: string[];
}

export interface GenericExtraction {
  document_title?: string;
  issuing_entity?: string;
  date?: string;
  summary?: string;
  key_terms?: Record<string, string>;
  notable_clauses?: string[];
}

// ─── Extraction Union Type ───────────────────────────────────────────────────

export type ExtractionData =
  | NDAExtraction
  | W9Extraction
  | COIExtraction
  | SOC2Extraction
  | BusinessLicenseExtraction
  | GenericExtraction;

// ─── Mapping: DocumentType -> Extraction Schema ──────────────────────────────

export type ExtractionByDocumentType = {
  nda: NDAExtraction;
  w9: W9Extraction;
  certificate_of_insurance: COIExtraction;
  soc2_report: SOC2Extraction;
  business_license: BusinessLicenseExtraction;
  financial_statement: GenericExtraction;
  other: GenericExtraction;
};
