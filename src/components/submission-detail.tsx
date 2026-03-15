'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  FileText,
  Shield,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  ArrowLeft,
  RefreshCw,
  ChevronRight,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RiskFlag {
  code: string;
  label: string;
  severity: string;
  details?: string;
}

interface SubmissionDocument {
  id: string;
  file_name: string;
  document_type: string | null;
  classification_confidence: number | null;
  extracted_data: Record<string, any> | null;
  extraction_status: string;
  flags: RiskFlag[];
}

interface AuditLog {
  id: string;
  step: string;
  severity: string;
  message: string;
  created_at: string;
  metadata?: Record<string, any>;
}

interface Submission {
  id: string;
  vendor_id: string;
  status: string;
  risk_score: 'LOW' | 'MEDIUM' | 'HIGH' | null;
  risk_flags: RiskFlag[];
  decision: string | null;
  decision_reason: string | null;
  decision_rule: string | null;
  decided_at: string | null;
  decided_by: string | null;
  created_at: string;
  documents: SubmissionDocument[];
  vendors?: { id: string; name: string; entity_name?: string };
  audit_logs?: AuditLog[];
}

interface SubmissionDetailProps {
  submissionId: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatSnakeCase(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;

  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function isDateString(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  return /^\d{4}-\d{2}-\d{2}/.test(value) && !isNaN(Date.parse(value));
}

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  error: 1,
  medium: 2,
  warning: 2,
  low: 3,
};

function severityRank(severity: string): number {
  return SEVERITY_ORDER[severity.toLowerCase()] ?? 4;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  let variant: 'success' | 'warning' | 'destructive' | 'secondary' | 'default' = 'secondary';
  if (['approved', 'auto_approved', 'conditionally_approved', 'human_approved'].includes(s)) {
    variant = 'success';
  } else if (['conditions', 'approved_with_conditions'].includes(s)) {
    variant = 'warning';
  } else if (['escalated', 'escalated_to_human', 'rejected', 'human_rejected', 'error', 'failed'].includes(s)) {
    variant = 'destructive';
  } else if (['pending', 'submitted'].includes(s)) {
    variant = 'default';
  }
  // processing stays secondary (gray)

  return <Badge variant={variant}>{status.replace(/_/g, ' ').toUpperCase()}</Badge>;
}

function RiskScoreBadge({ score }: { score: 'LOW' | 'MEDIUM' | 'HIGH' }) {
  const map: Record<string, 'success' | 'warning' | 'destructive'> = {
    LOW: 'success',
    MEDIUM: 'warning',
    HIGH: 'destructive',
  };
  return (
    <Badge variant={map[score]}>
      <Shield className="mr-1 h-3 w-3" />
      {score} RISK
    </Badge>
  );
}

function SeverityIcon({ severity }: { severity: string }) {
  const s = severity.toLowerCase();
  if (s === 'critical' || s === 'high' || s === 'error') {
    return <AlertTriangle className="h-4 w-4 flex-shrink-0 text-red-600" />;
  }
  if (s === 'medium' || s === 'warning') {
    return <AlertCircle className="h-4 w-4 flex-shrink-0 text-yellow-600" />;
  }
  return <AlertCircle className="h-4 w-4 flex-shrink-0 text-neutral-400" />;
}

function flagBorderColor(severity: string): string {
  const s = severity.toLowerCase();
  if (s === 'critical') return 'border-l-red-600';
  if (s === 'high' || s === 'error') return 'border-l-orange-500';
  if (s === 'medium' || s === 'warning') return 'border-l-yellow-400';
  return 'border-l-neutral-300';
}

function auditSeverityClasses(severity: string): string {
  const s = severity.toLowerCase();
  if (s === 'critical') return 'text-red-700 font-bold';
  if (s === 'error') return 'text-red-600';
  if (s === 'warn' || s === 'warning') return 'text-yellow-600';
  return 'text-blue-600';
}

function auditSeverityDot(severity: string): string {
  const s = severity.toLowerCase();
  if (s === 'critical' || s === 'error') return 'bg-red-500';
  if (s === 'warn' || s === 'warning') return 'bg-yellow-400';
  return 'bg-blue-400';
}

// ---------------------------------------------------------------------------
// Extracted-data value renderer
// ---------------------------------------------------------------------------

function ExtractedValue({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return <span className="text-neutral-400 italic">Not found</span>;
  }
  if (typeof value === 'boolean') {
    return value ? (
      <span className="font-medium text-green-700">Yes</span>
    ) : (
      <span className="font-medium text-red-600">No</span>
    );
  }
  if (Array.isArray(value)) {
    return <span>{value.join(', ')}</span>;
  }
  if (isDateString(value)) {
    return <span>{formatDate(value as string)}</span>;
  }
  if (typeof value === 'object') {
    return (
      <pre className="text-xs whitespace-pre-wrap font-mono bg-neutral-50 rounded px-2 py-1">
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  }
  return <span>{String(value)}</span>;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function SubmissionDetail({ submissionId }: SubmissionDetailProps) {
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

  // Human review state
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject' | null>(null);
  const [rejectNotes, setRejectNotes] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // --------------------------------------------------
  // Fetch
  // --------------------------------------------------

  const fetchSubmission = useCallback(async () => {
    try {
      const res = await fetch(`/api/submissions/${submissionId}`);
      if (!res.ok) throw new Error(`Failed to load submission (${res.status})`);
      const data: Submission = await res.json();
      setSubmission(data);
      setError(null);

      // Auto-select first document if none selected
      if (data.documents?.length && !selectedDocId) {
        setSelectedDocId(data.documents[0].id);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [submissionId, selectedDocId]);

  useEffect(() => {
    fetchSubmission();
  }, [fetchSubmission]);

  // Poll while processing
  useEffect(() => {
    if (submission?.status === 'processing') {
      intervalRef.current = setInterval(fetchSubmission, 5000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [submission?.status, fetchSubmission]);

  // --------------------------------------------------
  // Review handler
  // --------------------------------------------------

  async function handleReviewSubmit(action: 'approve' | 'reject') {
    if (action === 'reject' && !rejectNotes.trim()) return;
    setSubmittingReview(true);
    try {
      const res = await fetch(`/api/submissions/${submissionId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          notes: action === 'reject' ? rejectNotes : undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Review submission failed');
      }
      setReviewAction(null);
      setRejectNotes('');
      await fetchSubmission();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Review failed';
      setError(message);
    } finally {
      setSubmittingReview(false);
    }
  }

  // --------------------------------------------------
  // Derived data
  // --------------------------------------------------

  const selectedDoc =
    submission?.documents?.find((d) => d.id === selectedDocId) ?? null;

  const sortedFlags = submission?.risk_flags
    ? [...submission.risk_flags].sort(
        (a, b) => severityRank(a.severity) - severityRank(b.severity),
      )
    : [];

  // --------------------------------------------------
  // Loading state
  // --------------------------------------------------

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <RefreshCw className="h-6 w-6 animate-spin text-neutral-400" />
        <span className="ml-3 text-neutral-500">Loading submission&hellip;</span>
      </div>
    );
  }

  // --------------------------------------------------
  // Error state (no data)
  // --------------------------------------------------

  if (error && !submission) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center text-red-700">
          <XCircle className="mx-auto mb-2 h-8 w-8" />
          <p className="font-medium">{error}</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={fetchSubmission}>
            Retry
          </Button>
        </div>
        <Link
          href="/"
          className="mt-6 inline-flex items-center text-sm text-neutral-500 hover:text-neutral-900 transition-colors"
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Back to Dashboard
        </Link>
      </div>
    );
  }

  if (!submission) return null;

  const showHumanReview =
    submission.status === 'review' && submission.decision === 'escalated';

  // --------------------------------------------------
  // Main render
  // --------------------------------------------------

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      {/* ------------------------------------------------------------------ */}
      {/* Back link                                                          */}
      {/* ------------------------------------------------------------------ */}
      <Link
        href="/"
        className="mb-6 inline-flex items-center text-sm font-medium text-neutral-500 hover:text-neutral-900 transition-colors"
      >
        <ArrowLeft className="mr-1.5 h-4 w-4" />
        Back to Dashboard
      </Link>

      {/* ------------------------------------------------------------------ */}
      {/* Header                                                             */}
      {/* ------------------------------------------------------------------ */}
      <section className="mb-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900 sm:text-3xl">
              {submission.vendors?.name ??
                submission.vendors?.entity_name ??
                'Unknown Vendor'}
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              Submitted {formatDate(submission.created_at)}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={submission.status} />
            {submission.risk_score && (
              <RiskScoreBadge score={submission.risk_score} />
            )}
          </div>
        </div>

        {/* Decision info */}
        {submission.decision && (
          <div className="mt-4 rounded-md border border-neutral-200 bg-neutral-50 px-4 py-3">
            <p className="text-sm text-neutral-700">
              <span className="font-semibold">Decision:</span>{' '}
              {submission.decision.replace(/_/g, ' ')}
              {submission.decision_reason && (
                <span className="text-neutral-500">
                  {' '}&mdash; {submission.decision_reason}
                </span>
              )}
            </p>
            {submission.decided_by && (
              <p className="mt-1 text-xs text-neutral-500">
                Decided by{' '}
                <span className="font-medium">{submission.decided_by}</span>
                {submission.decided_at && (
                  <> on {formatDate(submission.decided_at)}</>
                )}
              </p>
            )}
          </div>
        )}

        {/* Processing indicator */}
        {submission.status === 'processing' && (
          <div className="mt-4 flex items-center gap-2 text-sm text-neutral-500">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Processing &mdash; auto-refreshing every 5 seconds
          </div>
        )}
      </section>

      {/* Inline error banner (non-fatal) */}
      {error && submission && (
        <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Human Review Controls                                              */}
      {/* ------------------------------------------------------------------ */}
      {showHumanReview && (
        <Card className="mb-8 border-yellow-300 bg-yellow-50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg text-yellow-800">
              <AlertTriangle className="h-5 w-5" />
              Human Review Required
            </CardTitle>
          </CardHeader>
          <CardContent>
            {reviewAction !== 'reject' ? (
              <div className="flex gap-3">
                <Button
                  variant="success"
                  onClick={() => handleReviewSubmit('approve')}
                  disabled={submittingReview}
                >
                  {submittingReview ? (
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="mr-2 h-4 w-4" />
                  )}
                  Approve
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setReviewAction('reject')}
                  disabled={submittingReview}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Reject
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <label className="block text-sm font-medium text-neutral-700">
                  Rejection notes <span className="text-red-500">*</span>
                </label>
                <textarea
                  className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-neutral-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  rows={3}
                  placeholder="Provide the reason for rejection..."
                  value={rejectNotes}
                  onChange={(e) => setRejectNotes(e.target.value)}
                />
                <div className="flex gap-3">
                  <Button
                    variant="destructive"
                    disabled={!rejectNotes.trim() || submittingReview}
                    onClick={() => handleReviewSubmit('reject')}
                  >
                    {submittingReview && (
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Confirm Rejection
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setReviewAction(null);
                      setRejectNotes('');
                    }}
                    disabled={submittingReview}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Risk Flags                                                         */}
      {/* ------------------------------------------------------------------ */}
      {sortedFlags.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-4 text-lg font-semibold text-neutral-900">
            Risk Flags
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {sortedFlags.map((flag) => (
              <Card
                key={flag.code}
                className={`border-l-4 ${flagBorderColor(flag.severity)}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <SeverityIcon severity={flag.severity} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-neutral-500">
                          {flag.code}
                        </span>
                        <span className="text-sm font-medium text-neutral-900">
                          {flag.label}
                        </span>
                      </div>
                      {flag.details && (
                        <p className="mt-1 text-sm text-neutral-600">
                          {flag.details}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Documents                                                          */}
      {/* ------------------------------------------------------------------ */}
      {submission.documents?.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-4 text-lg font-semibold text-neutral-900">
            Documents
          </h2>
          <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
            {/* Sidebar list */}
            <div className="space-y-1 rounded-lg border border-neutral-200 bg-white p-2">
              {submission.documents.map((doc) => (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => setSelectedDocId(doc.id)}
                  className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors ${
                    selectedDocId === doc.id
                      ? 'bg-blue-50 text-blue-800 font-medium'
                      : 'text-neutral-700 hover:bg-neutral-50'
                  }`}
                >
                  <FileText className="h-4 w-4 flex-shrink-0 text-neutral-400" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate">{doc.file_name}</p>
                    {doc.classification_confidence != null && (
                      <p className="mt-0.5 text-xs text-neutral-400">
                        {(doc.classification_confidence * 100).toFixed(0)}%
                        confidence
                      </p>
                    )}
                  </div>
                  {selectedDocId === doc.id && (
                    <ChevronRight className="h-4 w-4 flex-shrink-0 text-blue-500" />
                  )}
                </button>
              ))}
            </div>

            {/* Detail panel */}
            {selectedDoc ? (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">
                    {selectedDoc.file_name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Classification */}
                  <div>
                    <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                      Classification
                    </h4>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-neutral-900">
                        {selectedDoc.document_type
                          ? formatSnakeCase(selectedDoc.document_type)
                          : 'Unclassified'}
                      </span>
                      {selectedDoc.classification_confidence != null && (
                        <Badge variant="secondary">
                          {(
                            selectedDoc.classification_confidence * 100
                          ).toFixed(0)}
                          %
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Extracted Data */}
                  {selectedDoc.extracted_data &&
                    Object.keys(selectedDoc.extracted_data).length > 0 && (
                      <div>
                        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                          Extracted Data
                        </h4>
                        <div className="rounded-lg border border-neutral-200 divide-y divide-neutral-100">
                          {Object.entries(selectedDoc.extracted_data).map(
                            ([key, value]) => (
                              <div
                                key={key}
                                className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:gap-4"
                              >
                                <span className="w-48 flex-shrink-0 text-sm font-medium text-neutral-500">
                                  {formatSnakeCase(key)}
                                </span>
                                <span className="text-sm text-neutral-900">
                                  <ExtractedValue value={value} />
                                </span>
                              </div>
                            ),
                          )}
                        </div>
                      </div>
                    )}

                  {/* Document-level flags */}
                  {selectedDoc.flags?.length > 0 && (
                    <div>
                      <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                        Document Flags
                      </h4>
                      <div className="space-y-2">
                        {selectedDoc.flags.map((flag) => (
                          <div
                            key={flag.code}
                            className={`flex items-start gap-2 rounded-md border-l-4 bg-neutral-50 px-3 py-2 ${flagBorderColor(flag.severity)}`}
                          >
                            <SeverityIcon severity={flag.severity} />
                            <div>
                              <span className="text-sm font-medium">
                                {flag.code} &mdash; {flag.label}
                              </span>
                              {flag.details && (
                                <p className="text-xs text-neutral-500">
                                  {flag.details}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="flex items-center justify-center py-12 text-neutral-400">
                  Select a document to view details
                </CardContent>
              </Card>
            )}
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Audit Trail                                                        */}
      {/* ------------------------------------------------------------------ */}
      {submission.audit_logs && submission.audit_logs.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-4 text-lg font-semibold text-neutral-900">
            Audit Trail
          </h2>
          <Card>
            <CardContent className="p-0">
              <div className="divide-y divide-neutral-100">
                {submission.audit_logs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start gap-3 px-5 py-3"
                  >
                    {/* Severity dot */}
                    <span
                      className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${auditSeverityDot(log.severity)}`}
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant="secondary"
                          className="px-1.5 py-0 text-[10px]"
                        >
                          {log.step}
                        </Badge>
                        <span
                          className={`text-sm ${auditSeverityClasses(log.severity)}`}
                        >
                          {log.message}
                        </span>
                      </div>
                    </div>

                    <span className="flex-shrink-0 whitespace-nowrap text-xs text-neutral-400">
                      {relativeTime(log.created_at)}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}
