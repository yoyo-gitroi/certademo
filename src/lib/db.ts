import { supabase } from './supabase';

// ============================================================================
// Type definitions
// ============================================================================

export interface Vendor {
  id: string;
  name: string;
  entity_name: string | null;
  tax_id: string | null;
  total_submissions: number;
  last_submission_at: string | null;
  risk_history: RiskHistoryEntry[];
  created_at: string;
  updated_at: string;
}

export interface Submission {
  id: string;
  vendor_id: string;
  status: 'pending' | 'processing' | 'review' | 'approved' | 'rejected' | 'error';
  risk_score: 'LOW' | 'MEDIUM' | 'HIGH' | null;
  risk_flags: RiskFlag[];
  decision: string | null;
  decision_reason: string | null;
  decision_rule: string | null;
  decided_at: string | null;
  decided_by: string | null;
  created_at: string;
  updated_at: string;
  documents?: Document[];
  vendors?: Vendor;
}

export interface Document {
  id: string;
  submission_id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  raw_text: string | null;
  document_type: string | null;
  classification_confidence: number | null;
  extracted_data: Record<string, unknown> | null;
  extraction_status: 'pending' | 'processing' | 'completed' | 'failed';
  flags: RiskFlag[];
  created_at: string;
}

export interface AuditLogEntry {
  id?: string;
  submission_id: string;
  document_id?: string | null;
  step: string;
  severity?: 'info' | 'warn' | 'error' | 'critical';
  message: string;
  metadata?: Record<string, unknown>;
  created_at?: string;
}

export interface RiskFlag {
  code: string;
  label: string;
  severity: string;
  details?: string;
}

export interface RiskHistoryEntry {
  submission_id: string;
  risk_score: string;
  risk_flags: RiskFlag[];
  decided_at: string;
}

// ============================================================================
// Vendor functions
// ============================================================================

/**
 * Creates a new vendor or finds an existing one by name (case-insensitive).
 * If a vendor with the same name already exists, returns the existing vendor.
 */
export async function createVendor(name: string): Promise<Vendor> {
  // Check for existing vendor (case-insensitive)
  const { data: existing, error: findError } = await supabase
    .from('vendors')
    .select('*')
    .ilike('name', name)
    .limit(1)
    .maybeSingle();

  if (findError) {
    throw new Error(`Failed to search for vendor: ${findError.message}`);
  }

  if (existing) {
    return existing as Vendor;
  }

  // Create new vendor
  const { data, error } = await supabase
    .from('vendors')
    .insert({ name })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create vendor: ${error.message}`);
  }

  return data as Vendor;
}

/**
 * Gets a vendor by ID, including their recent submissions.
 */
export async function getVendor(id: string): Promise<Vendor & { submissions: Submission[] }> {
  const { data: vendor, error: vendorError } = await supabase
    .from('vendors')
    .select('*')
    .eq('id', id)
    .single();

  if (vendorError) {
    throw new Error(`Failed to get vendor: ${vendorError.message}`);
  }

  const { data: submissions, error: subError } = await supabase
    .from('submissions')
    .select('*')
    .eq('vendor_id', id)
    .order('created_at', { ascending: false })
    .limit(20);

  if (subError) {
    throw new Error(`Failed to get vendor submissions: ${subError.message}`);
  }

  return {
    ...(vendor as Vendor),
    submissions: (submissions || []) as Submission[],
  };
}

// ============================================================================
// Submission functions
// ============================================================================

/**
 * Creates a new submission for a vendor.
 * Also increments the vendor's total_submissions count and updates last_submission_at.
 */
export async function createSubmission(vendorId: string): Promise<Submission> {
  const { data, error } = await supabase
    .from('submissions')
    .insert({ vendor_id: vendorId })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create submission: ${error.message}`);
  }

  // Update vendor stats
  const { count } = await supabase
    .from('submissions')
    .select('id', { count: 'exact', head: true })
    .eq('vendor_id', vendorId);

  await supabase
    .from('vendors')
    .update({
      total_submissions: count || 1,
      last_submission_at: new Date().toISOString(),
    })
    .eq('id', vendorId);

  return data as Submission;
}

/**
 * Updates a submission with partial data.
 */
export async function updateSubmission(
  id: string,
  data: Partial<Omit<Submission, 'id' | 'created_at'>>
): Promise<Submission> {
  const { data: updated, error } = await supabase
    .from('submissions')
    .update(data)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update submission: ${error.message}`);
  }

  return updated as Submission;
}

/**
 * Gets a single submission by ID, including all its documents.
 */
export async function getSubmission(id: string): Promise<Submission & { documents: Document[] }> {
  const { data: submission, error: subError } = await supabase
    .from('submissions')
    .select('*, vendors(*)')
    .eq('id', id)
    .single();

  if (subError) {
    throw new Error(`Failed to get submission: ${subError.message}`);
  }

  const { data: documents, error: docError } = await supabase
    .from('documents')
    .select('*')
    .eq('submission_id', id)
    .order('created_at', { ascending: true });

  if (docError) {
    throw new Error(`Failed to get submission documents: ${docError.message}`);
  }

  return {
    ...(submission as Submission),
    documents: (documents || []) as Document[],
  };
}

/**
 * Gets all submissions with vendor info, ordered by creation date descending.
 */
export async function getSubmissions(): Promise<Submission[]> {
  const { data, error } = await supabase
    .from('submissions')
    .select('*, vendors(id, name, entity_name)')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to get submissions: ${error.message}`);
  }

  return (data || []) as Submission[];
}

// ============================================================================
// Document functions
// ============================================================================

/**
 * Creates a new document record for a submission.
 */
export async function createDocument(
  submissionId: string,
  fileName: string,
  filePath: string,
  fileSize: number
): Promise<Document> {
  const { data, error } = await supabase
    .from('documents')
    .insert({
      submission_id: submissionId,
      file_name: fileName,
      file_path: filePath,
      file_size: fileSize,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create document: ${error.message}`);
  }

  return data as Document;
}

/**
 * Updates a document with partial data.
 */
export async function updateDocument(
  id: string,
  data: Partial<Omit<Document, 'id' | 'submission_id' | 'created_at'>>
): Promise<Document> {
  const { data: updated, error } = await supabase
    .from('documents')
    .update(data)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update document: ${error.message}`);
  }

  return updated as Document;
}

/**
 * Gets all documents for a given submission.
 */
export async function getDocumentsBySubmission(submissionId: string): Promise<Document[]> {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('submission_id', submissionId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to get documents: ${error.message}`);
  }

  return (data || []) as Document[];
}

// ============================================================================
// Audit log functions
// ============================================================================

/**
 * Creates a new audit log entry.
 */
export async function createAuditLog(entry: AuditLogEntry): Promise<AuditLogEntry> {
  const { data, error } = await supabase
    .from('audit_log')
    .insert({
      submission_id: entry.submission_id,
      document_id: entry.document_id || null,
      step: entry.step,
      severity: entry.severity || 'info',
      message: entry.message,
      metadata: entry.metadata || {},
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create audit log: ${error.message}`);
  }

  return data as AuditLogEntry;
}

/**
 * Gets all audit log entries for a submission, ordered by creation date.
 */
export async function getAuditLogs(submissionId: string): Promise<AuditLogEntry[]> {
  const { data, error } = await supabase
    .from('audit_log')
    .select('*')
    .eq('submission_id', submissionId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to get audit logs: ${error.message}`);
  }

  return (data || []) as AuditLogEntry[];
}

// ============================================================================
// Vendor history functions
// ============================================================================

/**
 * Gets past submissions and associated flags for a vendor.
 */
export async function getVendorHistory(
  vendorId: string
): Promise<{ vendor: Vendor; submissions: Submission[] }> {
  const { data: vendor, error: vendorError } = await supabase
    .from('vendors')
    .select('*')
    .eq('id', vendorId)
    .single();

  if (vendorError) {
    throw new Error(`Failed to get vendor: ${vendorError.message}`);
  }

  const { data: submissions, error: subError } = await supabase
    .from('submissions')
    .select('*, documents(id, file_name, document_type, flags)')
    .eq('vendor_id', vendorId)
    .order('created_at', { ascending: false });

  if (subError) {
    throw new Error(`Failed to get vendor history: ${subError.message}`);
  }

  return {
    vendor: vendor as Vendor,
    submissions: (submissions || []) as Submission[],
  };
}

/**
 * Updates the risk_history JSONB array on a vendor record.
 * Appends a new risk entry to the existing array.
 */
export async function updateVendorRiskHistory(
  vendorId: string,
  riskData: {
    submission_id: string;
    risk_score: string;
    risk_flags: RiskFlag[];
    decided_at: string;
  }
): Promise<Vendor> {
  // First get the current risk_history
  const { data: vendor, error: getError } = await supabase
    .from('vendors')
    .select('risk_history')
    .eq('id', vendorId)
    .single();

  if (getError) {
    throw new Error(`Failed to get vendor for risk history update: ${getError.message}`);
  }

  const currentHistory: RiskHistoryEntry[] = (vendor?.risk_history as RiskHistoryEntry[]) || [];
  const updatedHistory = [...currentHistory, riskData];

  const { data: updated, error: updateError } = await supabase
    .from('vendors')
    .update({ risk_history: updatedHistory })
    .eq('id', vendorId)
    .select()
    .single();

  if (updateError) {
    throw new Error(`Failed to update vendor risk history: ${updateError.message}`);
  }

  return updated as Vendor;
}
