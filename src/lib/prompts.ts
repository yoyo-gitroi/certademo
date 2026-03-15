// ============================================================================
// Classification Prompts
// ============================================================================

export const CLASSIFICATION_SYSTEM_PROMPT =
  'You are a document classification specialist for a vendor compliance system. ' +
  'Your job is to identify what type of business document you are reading based on its content. ' +
  'You must classify documents into EXACTLY ONE of these types: ' +
  'nda, w9, certificate_of_insurance, soc2_report, business_license, financial_statement, other. ' +
  'Respond with ONLY a JSON object. No explanation, no markdown, no backticks.';

/**
 * Returns the user prompt for document classification.
 * Includes the raw text (or a truncated portion) to classify.
 */
export function classificationUserPrompt(rawText: string): string {
  return (
    'Classify the following document. Respond with a JSON object containing:\n' +
    '- "document_type": one of nda, w9, certificate_of_insurance, soc2_report, business_license, financial_statement, other\n' +
    '- "confidence": a number from 0 to 1 indicating your confidence\n' +
    '- "reason": a brief explanation of why you chose this classification\n\n' +
    'Document text:\n' +
    '"""\n' +
    rawText +
    '\n"""'
  );
}

// ============================================================================
// Extraction Prompts
// ============================================================================

export const EXTRACTION_SYSTEM_PROMPT =
  'You are a document data extraction specialist for a vendor compliance system. ' +
  'Your job is to read business documents and extract specific structured information. ' +
  'Rules: ' +
  '1. Extract ONLY the fields specified in the schema. ' +
  '2. If a field cannot be found, set it to null. NEVER omit a field. ' +
  '3. Dates in ISO 8601 (YYYY-MM-DD). ' +
  '4. Currency amounts as numbers. ' +
  '5. Boolean: true/false/null. ' +
  '6. String arrays: [] not null. ' +
  '7. Be precise, do not infer. ' +
  'Respond with ONLY a JSON object. No explanation, no markdown, no backticks.';

export const NDA_EXTRACTION_PROMPT =
  'Extract the following fields from this NDA (Non-Disclosure Agreement) document:\n\n' +
  '{\n' +
  '  "parties": ["Party A name", "Party B name"],\n' +
  '  "effective_date": "YYYY-MM-DD or null",\n' +
  '  "expiration_date": "YYYY-MM-DD or null",\n' +
  '  "term_years": number or null,\n' +
  '  "is_mutual": true/false/null,\n' +
  '  "governing_law": "state/jurisdiction or null",\n' +
  '  "confidentiality_scope": "description of what is considered confidential or null",\n' +
  '  "exclusions": ["list of exclusions from confidentiality"],\n' +
  '  "non_solicitation_clause": true/false/null,\n' +
  '  "non_compete_clause": true/false/null,\n' +
  '  "remedies": "description of remedies for breach or null",\n' +
  '  "return_of_materials": true/false/null,\n' +
  '  "signatory_names": ["name of each signatory"],\n' +
  '  "signatory_titles": ["title of each signatory"]\n' +
  '}\n\n' +
  'Document text:\n"""\n{raw_text}\n"""';

export const W9_EXTRACTION_PROMPT =
  'Extract the following fields from this W-9 (Request for Taxpayer Identification Number) form:\n\n' +
  '{\n' +
  '  "legal_name": "name as shown on tax return or null",\n' +
  '  "business_name": "business name/disregarded entity name or null",\n' +
  '  "tax_classification": "individual, c_corporation, s_corporation, partnership, trust_estate, llc, or other",\n' +
  '  "llc_tax_classification": "C, S, P, or null (only if LLC)",\n' +
  '  "exempt_payee_code": "code or null",\n' +
  '  "fatca_exemption_code": "code or null",\n' +
  '  "address": "street address or null",\n' +
  '  "city": "city or null",\n' +
  '  "state": "state or null",\n' +
  '  "zip_code": "zip code or null",\n' +
  '  "account_numbers": "account numbers or null",\n' +
  '  "tin_type": "ssn or ein",\n' +
  '  "tin_last_four": "last 4 digits of TIN or null",\n' +
  '  "signature_date": "YYYY-MM-DD or null",\n' +
  '  "is_signed": true/false/null\n' +
  '}\n\n' +
  'Document text:\n"""\n{raw_text}\n"""';

export const COI_EXTRACTION_PROMPT =
  'Extract the following fields from this Certificate of Insurance (COI) document:\n\n' +
  '{\n' +
  '  "insured_name": "name of the insured party or null",\n' +
  '  "insured_address": "address of the insured or null",\n' +
  '  "insurance_company": "name of insurance company or null",\n' +
  '  "policy_number": "policy number or null",\n' +
  '  "effective_date": "YYYY-MM-DD or null",\n' +
  '  "expiration_date": "YYYY-MM-DD or null",\n' +
  '  "general_liability_limit": number or null,\n' +
  '  "auto_liability_limit": number or null,\n' +
  '  "umbrella_liability_limit": number or null,\n' +
  '  "workers_comp_limit": number or null,\n' +
  '  "professional_liability_limit": number or null,\n' +
  '  "aggregate_limit": number or null,\n' +
  '  "additional_insured": ["names of additional insured parties"],\n' +
  '  "certificate_holder": "name of certificate holder or null",\n' +
  '  "description_of_operations": "description or null",\n' +
  '  "is_claims_made": true/false/null,\n' +
  '  "is_occurrence": true/false/null,\n' +
  '  "cancellation_notice_days": number or null\n' +
  '}\n\n' +
  'Document text:\n"""\n{raw_text}\n"""';

export const SOC2_EXTRACTION_PROMPT =
  'Extract the following fields from this SOC 2 report:\n\n' +
  '{\n' +
  '  "report_type": "Type I or Type II or null",\n' +
  '  "service_organization": "name of the service organization or null",\n' +
  '  "auditor": "name of the auditing firm or null",\n' +
  '  "audit_period_start": "YYYY-MM-DD or null",\n' +
  '  "audit_period_end": "YYYY-MM-DD or null",\n' +
  '  "report_date": "YYYY-MM-DD or null",\n' +
  '  "trust_service_criteria": ["Security", "Availability", "Processing Integrity", "Confidentiality", "Privacy"],\n' +
  '  "opinion_type": "unqualified, qualified, adverse, disclaimer, or null",\n' +
  '  "exceptions_noted": true/false/null,\n' +
  '  "number_of_exceptions": number or null,\n' +
  '  "exception_descriptions": ["description of each exception"],\n' +
  '  "subservice_organizations": ["names of subservice organizations"],\n' +
  '  "complementary_user_entity_controls": true/false/null,\n' +
  '  "description_of_system": "brief description of the system or null"\n' +
  '}\n\n' +
  'Document text:\n"""\n{raw_text}\n"""';

export const BUSINESS_LICENSE_EXTRACTION_PROMPT =
  'Extract the following fields from this business license document:\n\n' +
  '{\n' +
  '  "license_type": "type of license or null",\n' +
  '  "license_number": "license number or null",\n' +
  '  "business_name": "name of the business or null",\n' +
  '  "dba_name": "doing business as name or null",\n' +
  '  "owner_name": "owner/principal name or null",\n' +
  '  "business_address": "address or null",\n' +
  '  "issue_date": "YYYY-MM-DD or null",\n' +
  '  "expiration_date": "YYYY-MM-DD or null",\n' +
  '  "issuing_authority": "government body that issued the license or null",\n' +
  '  "jurisdiction": "city/county/state or null",\n' +
  '  "business_type": "corporation, llc, sole_proprietorship, partnership, or null",\n' +
  '  "naics_code": "NAICS code or null",\n' +
  '  "sic_code": "SIC code or null",\n' +
  '  "status": "active, expired, suspended, revoked, or null",\n' +
  '  "conditions": ["any conditions or restrictions on the license"]\n' +
  '}\n\n' +
  'Document text:\n"""\n{raw_text}\n"""';

export const GENERIC_EXTRACTION_PROMPT =
  'Extract any relevant structured information from this document. Identify and extract:\n\n' +
  '{\n' +
  '  "document_title": "title of the document or null",\n' +
  '  "document_date": "YYYY-MM-DD or null",\n' +
  '  "parties": ["names of parties involved"],\n' +
  '  "effective_date": "YYYY-MM-DD or null",\n' +
  '  "expiration_date": "YYYY-MM-DD or null",\n' +
  '  "key_terms": ["list of key terms or provisions"],\n' +
  '  "monetary_amounts": ["list of monetary amounts mentioned"],\n' +
  '  "signatures": ["names of signatories"],\n' +
  '  "summary": "brief summary of the document content or null"\n' +
  '}\n\n' +
  'Document text:\n"""\n{raw_text}\n"""';

/**
 * Map of document types to their extraction prompt templates.
 * Each prompt contains a {raw_text} placeholder to be replaced with actual document text.
 */
export const EXTRACTION_PROMPTS: Record<string, string> = {
  nda: NDA_EXTRACTION_PROMPT,
  w9: W9_EXTRACTION_PROMPT,
  certificate_of_insurance: COI_EXTRACTION_PROMPT,
  soc2_report: SOC2_EXTRACTION_PROMPT,
  business_license: BUSINESS_LICENSE_EXTRACTION_PROMPT,
  financial_statement: GENERIC_EXTRACTION_PROMPT,
  other: GENERIC_EXTRACTION_PROMPT,
};

// ============================================================================
// Risk Summary Prompts
// ============================================================================

export const RISK_SUMMARY_SYSTEM_PROMPT =
  'You are a vendor risk assessment specialist. Your job is to analyze extracted document data ' +
  'and produce a risk summary highlighting potential concerns, missing information, and overall ' +
  'risk level. Respond with ONLY a JSON object. No explanation, no markdown, no backticks.';

/**
 * Returns the user prompt for risk summary generation.
 * @param extractedData - The structured data extracted from the document
 * @param docType - The classified document type
 */
export function riskSummaryUserPrompt(
  extractedData: Record<string, unknown>,
  docType: string
): string {
  return (
    `Analyze the following extracted data from a "${docType}" document and produce a risk summary.\n\n` +
    'Respond with a JSON object containing:\n' +
    '- "risk_level": "low", "medium", "high", or "critical"\n' +
    '- "risk_score": a number from 0 to 100\n' +
    '- "flags": [{"field": "field_name", "issue": "description", "severity": "low|medium|high|critical"}]\n' +
    '- "missing_fields": ["list of fields that are null or missing"]\n' +
    '- "summary": "brief narrative summary of risk assessment"\n' +
    '- "recommendations": ["list of recommended actions"]\n\n' +
    'Extracted data:\n' +
    '"""\n' +
    JSON.stringify(extractedData, null, 2) +
    '\n"""'
  );
}

// ============================================================================
// Adjudication Prompts
// ============================================================================

export const ADJUDICATION_SYSTEM_PROMPT =
  'You are a vendor compliance adjudication specialist. Your job is to review all documents ' +
  'submitted by a vendor and make a final compliance determination. Consider the completeness ' +
  'of the submission, the risk levels of individual documents, and any cross-document inconsistencies. ' +
  'Respond with ONLY a JSON object. No explanation, no markdown, no backticks.';

/**
 * Returns the user prompt for adjudication.
 * @param documents - Array of document summaries including type, extracted data, and risk assessment
 * @param vendorName - Name of the vendor being assessed
 */
export function adjudicationUserPrompt(
  documents: Array<{
    docType: string;
    extractedData: Record<string, unknown>;
    riskSummary: Record<string, unknown>;
  }>,
  vendorName: string
): string {
  return (
    `Review the following documents submitted by vendor "${vendorName}" and provide a final compliance adjudication.\n\n` +
    'Respond with a JSON object containing:\n' +
    '- "decision": "approved", "conditionally_approved", "rejected", or "needs_review"\n' +
    '- "confidence": a number from 0 to 1\n' +
    '- "overall_risk_level": "low", "medium", "high", or "critical"\n' +
    '- "findings": [{"category": "string", "finding": "string", "severity": "low|medium|high|critical"}]\n' +
    '- "missing_documents": ["list of expected but missing document types"]\n' +
    '- "cross_document_issues": ["list of inconsistencies found across documents"]\n' +
    '- "conditions": ["list of conditions if conditionally approved"]\n' +
    '- "summary": "brief narrative summary of the adjudication decision"\n\n' +
    'Documents:\n' +
    '"""\n' +
    JSON.stringify(documents, null, 2) +
    '\n"""'
  );
}
