import {
  getSubmission,
  getDocumentsBySubmission,
  getVendorHistory,
  updateSubmission,
  createAuditLog,
  updateVendorRiskHistory,
  type RiskFlag,
  type Document,
  type Submission,
} from './db';

// ============================================================================
// Types
// ============================================================================

export interface RiskRule {
  id: string;
  name: string;
  condition: (documents: Document[], vendorHistory: VendorHistoryContext) => RiskFlag[];
  severity: 'critical' | 'high' | 'medium' | 'low';
  message_template: string;
}

interface VendorHistoryContext {
  pastSubmissions: Submission[];
  pastFlags: RiskFlag[];
}

export interface AssessmentResult {
  risk_score: 'LOW' | 'MEDIUM' | 'HIGH';
  risk_flags: RiskFlag[];
}

// ============================================================================
// Helper functions
// ============================================================================

function makeFlag(
  code: string,
  label: string,
  severity: string,
  details?: string
): RiskFlag {
  return { code, label, severity, details };
}

function getExtractedDocs(documents: Document[]): Document[] {
  return documents.filter(
    (d) => d.extraction_status === 'completed' && d.extracted_data
  );
}

function getDocsByType(documents: Document[], type: string): Document[] {
  return documents.filter((d) => d.document_type === type);
}

// ============================================================================
// Risk Rules
// ============================================================================

const RULES: RiskRule[] = [
  // R-001: Missing required document
  {
    id: 'R-001',
    name: 'Missing required document',
    severity: 'critical',
    message_template: 'Required document missing: {doc_type}',
    condition: (documents: Document[]): RiskFlag[] => {
      const flags: RiskFlag[] = [];
      const docTypes = new Set(documents.map((d) => d.document_type));
      const required = ['nda', 'w9', 'certificate_of_insurance'] as const;

      for (const reqType of required) {
        if (!docTypes.has(reqType)) {
          flags.push(
            makeFlag(
              'R-001',
              'Missing required document',
              'critical',
              `Required document missing: ${reqType}`
            )
          );
        }
      }

      return flags;
    },
  },

  // R-002: Insurance expiring soon (within 30 days)
  {
    id: 'R-002',
    name: 'Insurance expiring soon',
    severity: 'medium',
    message_template: 'Certificate of Insurance expires within 30 days: {expiration_date}',
    condition: (documents: Document[]): RiskFlag[] => {
      const flags: RiskFlag[] = [];
      const coiDocs = getDocsByType(getExtractedDocs(documents), 'certificate_of_insurance');

      for (const doc of coiDocs) {
        const data = doc.extracted_data as Record<string, unknown> | null;
        if (!data?.expiration_date) continue;

        const expDate = new Date(data.expiration_date as string);
        const now = new Date();
        const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

        if (expDate > now && expDate <= thirtyDaysFromNow) {
          flags.push(
            makeFlag(
              'R-002',
              'Insurance expiring soon',
              'warning',
              `Certificate of Insurance expires within 30 days: ${data.expiration_date}`
            )
          );
        }
      }

      return flags;
    },
  },

  // R-003: Insurance expired
  {
    id: 'R-003',
    name: 'Insurance expired',
    severity: 'critical',
    message_template: 'Certificate of Insurance has expired: {expiration_date}',
    condition: (documents: Document[]): RiskFlag[] => {
      const flags: RiskFlag[] = [];
      const coiDocs = getDocsByType(getExtractedDocs(documents), 'certificate_of_insurance');

      for (const doc of coiDocs) {
        const data = doc.extracted_data as Record<string, unknown> | null;
        if (!data?.expiration_date) continue;

        const expDate = new Date(data.expiration_date as string);
        const now = new Date();

        if (expDate <= now) {
          flags.push(
            makeFlag(
              'R-003',
              'Insurance expired',
              'critical',
              `Certificate of Insurance has expired: ${data.expiration_date}`
            )
          );
        }
      }

      return flags;
    },
  },

  // R-004: Entity name mismatch (W-9 entity_name vs NDA parties)
  {
    id: 'R-004',
    name: 'Entity name mismatch',
    severity: 'high',
    message_template: 'W-9 entity name does not match NDA parties',
    condition: (documents: Document[]): RiskFlag[] => {
      const flags: RiskFlag[] = [];
      const extracted = getExtractedDocs(documents);
      const w9Docs = getDocsByType(extracted, 'w9');
      const ndaDocs = getDocsByType(extracted, 'nda');

      if (w9Docs.length === 0 || ndaDocs.length === 0) return flags;

      for (const w9 of w9Docs) {
        const w9Data = w9.extracted_data as Record<string, unknown> | null;
        if (!w9Data) continue;

        // Use business_name if present, otherwise fall back to name
        const entityName = ((w9Data.business_name as string) || (w9Data.name as string) || '').toLowerCase().trim();
        if (!entityName) continue;

        for (const nda of ndaDocs) {
          const ndaData = nda.extracted_data as Record<string, unknown> | null;
          if (!ndaData?.parties) continue;

          const parties = ndaData.parties as string[];
          const match = parties.some((party) =>
            party.toLowerCase().trim().includes(entityName) ||
            entityName.includes(party.toLowerCase().trim())
          );

          if (!match) {
            flags.push(
              makeFlag(
                'R-004',
                'Entity name mismatch',
                'error',
                `W-9 entity name "${entityName}" not found in NDA parties: ${parties.join(', ')}`
              )
            );
          }
        }
      }

      return flags;
    },
  },

  // R-005: Missing signature (NDA or W-9)
  {
    id: 'R-005',
    name: 'Missing signature',
    severity: 'high',
    message_template: 'Document is missing required signature: {doc_type}',
    condition: (documents: Document[]): RiskFlag[] => {
      const flags: RiskFlag[] = [];
      const extracted = getExtractedDocs(documents);

      // Check NDA for signature_present
      for (const doc of getDocsByType(extracted, 'nda')) {
        const data = doc.extracted_data as Record<string, unknown> | null;
        if (data && data.signature_present === false) {
          flags.push(
            makeFlag(
              'R-005',
              'Missing signature',
              'error',
              `NDA document "${doc.file_name}" is missing required signature`
            )
          );
        }
      }

      // Check W-9 for certification_signed
      for (const doc of getDocsByType(extracted, 'w9')) {
        const data = doc.extracted_data as Record<string, unknown> | null;
        if (data && data.certification_signed === false) {
          flags.push(
            makeFlag(
              'R-005',
              'Missing signature',
              'error',
              `W-9 document "${doc.file_name}" is missing required signature`
            )
          );
        }
      }

      return flags;
    },
  },

  // R-006: SOC 2 report stale (audit_period_end > 12 months ago)
  {
    id: 'R-006',
    name: 'SOC 2 report stale',
    severity: 'medium',
    message_template: 'SOC 2 report audit period ended more than 12 months ago: {audit_period_end}',
    condition: (documents: Document[]): RiskFlag[] => {
      const flags: RiskFlag[] = [];
      const soc2Docs = getDocsByType(getExtractedDocs(documents), 'soc2_report');

      for (const doc of soc2Docs) {
        const data = doc.extracted_data as Record<string, unknown> | null;
        if (!data?.audit_period_end) continue;

        const auditEnd = new Date(data.audit_period_end as string);
        const twelveMonthsAgo = new Date();
        twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

        if (auditEnd < twelveMonthsAgo) {
          flags.push(
            makeFlag(
              'R-006',
              'SOC 2 report stale',
              'warning',
              `SOC 2 report audit period ended more than 12 months ago: ${data.audit_period_end}`
            )
          );
        }
      }

      return flags;
    },
  },

  // R-007: SOC 2 qualified opinion
  {
    id: 'R-007',
    name: 'SOC 2 qualified opinion',
    severity: 'high',
    message_template: 'SOC 2 report has a qualified opinion: {opinion}',
    condition: (documents: Document[]): RiskFlag[] => {
      const flags: RiskFlag[] = [];
      const soc2Docs = getDocsByType(getExtractedDocs(documents), 'soc2_report');

      for (const doc of soc2Docs) {
        const data = doc.extracted_data as Record<string, unknown> | null;
        if (!data?.opinion) continue;

        const opinion = (data.opinion as string).toLowerCase();
        if (opinion !== 'unqualified') {
          flags.push(
            makeFlag(
              'R-007',
              'SOC 2 qualified opinion',
              'error',
              `SOC 2 report has a non-unqualified opinion: ${data.opinion}`
            )
          );
        }
      }

      return flags;
    },
  },

  // R-008: Business license expired
  {
    id: 'R-008',
    name: 'Business license expired',
    severity: 'critical',
    message_template: 'Business license has expired: {expiration_date}',
    condition: (documents: Document[]): RiskFlag[] => {
      const flags: RiskFlag[] = [];
      const blDocs = getDocsByType(getExtractedDocs(documents), 'business_license');

      for (const doc of blDocs) {
        const data = doc.extracted_data as Record<string, unknown> | null;
        if (!data) continue;

        // Check by status field
        if (data.status === 'expired') {
          flags.push(
            makeFlag(
              'R-008',
              'Business license expired',
              'critical',
              `Business license has expired (status: expired)`
            )
          );
          continue;
        }

        // Check by expiration_date
        if (data.expiration_date) {
          const expDate = new Date(data.expiration_date as string);
          const now = new Date();
          if (expDate <= now) {
            flags.push(
              makeFlag(
                'R-008',
                'Business license expired',
                'critical',
                `Business license has expired: ${data.expiration_date}`
              )
            );
          }
        }
      }

      return flags;
    },
  },

  // R-009: Low insurance coverage (general_liability_limit < 1,000,000)
  {
    id: 'R-009',
    name: 'Low insurance coverage',
    severity: 'medium',
    message_template: 'General liability coverage is below $1,000,000: {general_liability_limit}',
    condition: (documents: Document[]): RiskFlag[] => {
      const flags: RiskFlag[] = [];
      const coiDocs = getDocsByType(getExtractedDocs(documents), 'certificate_of_insurance');

      for (const doc of coiDocs) {
        const data = doc.extracted_data as Record<string, unknown> | null;
        if (!data || data.general_liability_limit === undefined || data.general_liability_limit === null) continue;

        const limit = Number(data.general_liability_limit);
        if (!isNaN(limit) && limit < 1_000_000) {
          flags.push(
            makeFlag(
              'R-009',
              'Low insurance coverage',
              'warning',
              `General liability coverage is below $1,000,000: $${limit.toLocaleString()}`
            )
          );
        }
      }

      return flags;
    },
  },

  // R-010: Repeat offender (same flag in past 2 vendor submissions)
  {
    id: 'R-010',
    name: 'Repeat offender',
    severity: 'high',
    message_template: 'Vendor has had the same risk flag in previous submissions: {flag_code}',
    condition: (_documents: Document[], vendorHistory: VendorHistoryContext): RiskFlag[] => {
      const flags: RiskFlag[] = [];
      if (!vendorHistory.pastSubmissions || vendorHistory.pastSubmissions.length < 2) {
        return flags;
      }

      // Get last 2 submissions' flags
      const recentSubmissions = vendorHistory.pastSubmissions.slice(0, 2);
      const recentFlagCodes = new Set<string>();

      for (const sub of recentSubmissions) {
        if (sub.risk_flags) {
          for (const flag of sub.risk_flags) {
            recentFlagCodes.add(flag.code);
          }
        }
      }

      // Check current document flags against past flags
      for (const pastFlag of vendorHistory.pastFlags) {
        if (recentFlagCodes.has(pastFlag.code)) {
          // Only add each code once
          if (!flags.some((f) => f.details?.includes(pastFlag.code))) {
            flags.push(
              makeFlag(
                'R-010',
                'Repeat offender',
                'error',
                `Vendor has had the same risk flag "${pastFlag.code}" in previous submissions`
              )
            );
          }
        }
      }

      return flags;
    },
  },
];

// ============================================================================
// Risk Score Calculation
// ============================================================================

function calculateRiskScore(flags: RiskFlag[]): 'LOW' | 'MEDIUM' | 'HIGH' {
  const severities = new Set(flags.map((f) => f.severity));

  if (severities.has('critical') || severities.has('error')) {
    return 'HIGH';
  }

  if (severities.has('warning')) {
    return 'MEDIUM';
  }

  return 'LOW';
}

// ============================================================================
// Main Assessment Function
// ============================================================================

export async function assessSubmission(
  submissionId: string
): Promise<AssessmentResult> {
  const startTime = Date.now();

  // Log assessment start
  await createAuditLog({
    submission_id: submissionId,
    step: 'assess',
    severity: 'info',
    message: 'Risk assessment started',
  });

  // Get submission and documents
  const submission = await getSubmission(submissionId);
  const documents = await getDocumentsBySubmission(submissionId);

  // Separate extracted docs from failed ones
  const extractedDocs = documents.filter(
    (d) => d.extraction_status === 'completed' && d.extracted_data
  );
  const failedDocs = documents.filter(
    (d) => d.extraction_status === 'failed'
  );

  const allFlags: RiskFlag[] = [];

  // Add warning flags for documents with extraction errors
  for (const doc of failedDocs) {
    allFlags.push(
      makeFlag(
        'EXTRACT-ERR',
        'Extraction failed',
        'warning',
        `Document "${doc.file_name}" could not be extracted and was skipped during assessment`
      )
    );
  }

  // Get vendor history for repeat offender checks
  let vendorHistoryContext: VendorHistoryContext = {
    pastSubmissions: [],
    pastFlags: [],
  };

  try {
    const history = await getVendorHistory(submission.vendor_id);
    // Exclude the current submission from history
    const pastSubmissions = history.submissions.filter(
      (s) => s.id !== submissionId
    );

    const pastFlags: RiskFlag[] = [];
    for (const sub of pastSubmissions) {
      if (sub.risk_flags) {
        pastFlags.push(...sub.risk_flags);
      }
    }

    vendorHistoryContext = { pastSubmissions, pastFlags };
  } catch (error) {
    console.warn('Could not retrieve vendor history for R-010 check:', error);
  }

  // Run all rules
  for (const rule of RULES) {
    try {
      const ruleFlags = rule.condition(documents, vendorHistoryContext);
      allFlags.push(...ruleFlags);
    } catch (error) {
      console.error(`Rule ${rule.id} failed:`, error);
      allFlags.push(
        makeFlag(
          rule.id,
          rule.name,
          'warning',
          `Rule evaluation failed: ${error instanceof Error ? error.message : String(error)}`
        )
      );
    }
  }

  // Calculate risk score
  const riskScore = calculateRiskScore(allFlags);

  // Update submission
  await updateSubmission(submissionId, {
    risk_score: riskScore,
    risk_flags: allFlags,
    status: 'review',
  });

  // Update vendor risk history
  try {
    await updateVendorRiskHistory(submission.vendor_id, {
      submission_id: submissionId,
      risk_score: riskScore,
      risk_flags: allFlags,
      decided_at: new Date().toISOString(),
    });
  } catch (error) {
    console.warn('Failed to update vendor risk history:', error);
  }

  const durationMs = Date.now() - startTime;

  // Log assessment completion
  await createAuditLog({
    submission_id: submissionId,
    step: 'assess',
    severity: 'info',
    message: `Risk assessment completed: score=${riskScore}, flags=${allFlags.length}`,
    metadata: {
      risk_score: riskScore,
      flag_count: allFlags.length,
      flag_codes: allFlags.map((f) => f.code),
      duration_ms: durationMs,
    },
  });

  return { risk_score: riskScore, risk_flags: allFlags };
}
