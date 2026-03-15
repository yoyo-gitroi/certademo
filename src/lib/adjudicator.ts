import {
  getSubmission,
  updateSubmission,
  createAuditLog,
  type Submission,
  type RiskFlag,
} from './db';

// ============================================================================
// Types
// ============================================================================

export interface AdjudicationResult {
  submission: Submission;
  decision: string;
  decision_reason: string;
}

// ============================================================================
// Decision Reason Templates
// ============================================================================

function buildAutoApprovedReason(): string {
  return 'All documents present and compliant. No risk flags detected. Vendor approved for onboarding.';
}

function buildApprovedWithConditionsReason(flags: RiskFlag[]): string {
  const mediumFlags = flags.filter(
    (f) => f.severity === 'warning' || f.severity === 'medium'
  );
  const flagList = mediumFlags
    .map((f) => `- [${f.code}] ${f.label}: ${f.details || 'No details'}`)
    .join('\n');

  return `Submission approved with conditions. The following issues require attention:\n${flagList}`;
}

function buildEscalatedReason(flags: RiskFlag[]): string {
  const criticalHighFlags = flags.filter(
    (f) =>
      f.severity === 'critical' ||
      f.severity === 'error' ||
      f.severity === 'high'
  );
  const flagList = criticalHighFlags
    .map((f) => `- [${f.code}] ${f.label}: ${f.details || 'No details'}`)
    .join('\n');

  return `Submission escalated for human review. Critical issues detected:\n${flagList}`;
}

// ============================================================================
// Decision Routing
// ============================================================================

function routeDecision(
  riskScore: string,
  flags: RiskFlag[]
): { decision: string; status: Submission['status']; decision_reason: string; decision_rule: string } {
  switch (riskScore) {
    case 'LOW':
      return {
        decision: 'auto_approved',
        status: 'approved',
        decision_reason: buildAutoApprovedReason(),
        decision_rule: 'LOW_RISK_AUTO_APPROVE',
      };

    case 'MEDIUM':
      return {
        decision: 'approved_with_conditions',
        status: 'approved',
        decision_reason: buildApprovedWithConditionsReason(flags),
        decision_rule: 'MEDIUM_RISK_CONDITIONAL',
      };

    case 'HIGH':
      return {
        decision: 'escalated',
        status: 'review',
        decision_reason: buildEscalatedReason(flags),
        decision_rule: 'HIGH_RISK_ESCALATE',
      };

    default:
      return {
        decision: 'escalated',
        status: 'review',
        decision_reason: `Unknown risk score "${riskScore}". Escalated for manual review.`,
        decision_rule: 'UNKNOWN_RISK_ESCALATE',
      };
  }
}

// ============================================================================
// Main Adjudication Function
// ============================================================================

export async function adjudicateSubmission(
  submissionId: string
): Promise<AdjudicationResult> {
  const startTime = Date.now();

  // Log adjudication start
  await createAuditLog({
    submission_id: submissionId,
    step: 'adjudicate',
    severity: 'info',
    message: 'Adjudication started',
  });

  // Get submission with current risk data
  const submission = await getSubmission(submissionId);

  if (!submission.risk_score) {
    throw new Error(
      `Submission ${submissionId} has not been assessed. Run risk assessment first.`
    );
  }

  const riskFlags = submission.risk_flags || [];
  const { decision, status, decision_reason, decision_rule } = routeDecision(
    submission.risk_score,
    riskFlags
  );

  const now = new Date().toISOString();

  // Update submission with decision
  const updatedSubmission = await updateSubmission(submissionId, {
    decision,
    decision_reason,
    decision_rule,
    decided_at: now,
    decided_by: 'system',
    status,
  });

  const durationMs = Date.now() - startTime;

  // Log adjudication completion
  await createAuditLog({
    submission_id: submissionId,
    step: 'adjudicate',
    severity: 'info',
    message: `Adjudication completed: decision=${decision}, risk_score=${submission.risk_score}`,
    metadata: {
      decision,
      decision_rule,
      risk_score: submission.risk_score,
      flag_count: riskFlags.length,
      duration_ms: durationMs,
    },
  });

  return {
    submission: updatedSubmission,
    decision,
    decision_reason,
  };
}
