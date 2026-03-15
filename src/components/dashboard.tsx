'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileText,
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Upload,
  RefreshCw,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { Submission, SubmissionStatus, RiskScore, Decision } from '@/types';

// ─── Helpers ────────────────────────────────────────────────────────────────

function statusBadge(status: SubmissionStatus) {
  const map: Record<SubmissionStatus, { label: string; variant: 'success' | 'warning' | 'destructive' | 'secondary' | 'default' }> = {
    pending: { label: 'Pending', variant: 'default' },
    processing: { label: 'Processing', variant: 'secondary' },
    classified: { label: 'Classified', variant: 'secondary' },
    extracted: { label: 'Extracted', variant: 'secondary' },
    assessed: { label: 'Assessed', variant: 'default' },
    auto_approved: { label: 'Auto-Approved', variant: 'success' },
    approved_with_conditions: { label: 'Conditions', variant: 'warning' },
    escalated_to_human: { label: 'Escalated', variant: 'destructive' },
    human_approved: { label: 'Approved', variant: 'success' },
    human_rejected: { label: 'Rejected', variant: 'destructive' },
    error: { label: 'Error', variant: 'destructive' },
  };
  const cfg = map[status] ?? { label: status, variant: 'secondary' as const };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

function riskBadge(score: RiskScore) {
  if (!score) return <span className="text-neutral-400">--</span>;
  const map: Record<string, 'success' | 'warning' | 'destructive'> = {
    LOW: 'success',
    MEDIUM: 'warning',
    HIGH: 'destructive',
  };
  return <Badge variant={map[score] ?? 'secondary'}>{score}</Badge>;
}

function decisionLabel(decision?: Decision) {
  if (!decision) return <span className="text-neutral-400">--</span>;
  const labels: Record<Decision, string> = {
    auto_approved: 'Auto-Approved',
    approved_with_conditions: 'Approved w/ Conditions',
    escalated: 'Escalated',
    rejected: 'Rejected',
  };
  return <span className="text-sm">{labels[decision] ?? decision}</span>;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Stats ──────────────────────────────────────────────────────────────────

interface Stats {
  total: number;
  autoApproved: number;
  escalated: number;
  processing: number;
}

function computeStats(submissions: Submission[]): Stats {
  return {
    total: submissions.length,
    autoApproved: submissions.filter(
      (s) => s.status === 'auto_approved' || s.status === 'human_approved'
    ).length,
    escalated: submissions.filter(
      (s) => s.status === 'escalated_to_human' || s.status === 'human_rejected'
    ).length,
    processing: submissions.filter((s) =>
      ['pending', 'processing', 'classified', 'extracted', 'assessed'].includes(s.status)
    ).length,
  };
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function Dashboard() {
  const router = useRouter();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Upload state
  const [vendorName, setVendorName] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Fetch submissions ─────────────────────────────────────────────────────

  const fetchSubmissions = useCallback(async () => {
    try {
      const res = await fetch('/api/submissions');
      if (!res.ok) throw new Error(`Failed to fetch submissions: ${res.status}`);
      const data = await res.json();
      setSubmissions(Array.isArray(data) ? data : data.submissions ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load submissions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubmissions();
    const interval = setInterval(fetchSubmissions, 5000);
    return () => clearInterval(interval);
  }, [fetchSubmissions]);

  // ── File handling ─────────────────────────────────────────────────────────

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const dropped = Array.from(e.dataTransfer.files).filter(
      (f) => f.type === 'application/pdf'
    );
    if (dropped.length) setFiles((prev) => [...prev, ...dropped]);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      const selected = Array.from(e.target.files).filter(
        (f) => f.type === 'application/pdf'
      );
      setFiles((prev) => [...prev, ...selected]);
    }
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  // ── Upload & process ──────────────────────────────────────────────────────

  async function handleUpload() {
    if (!vendorName.trim() || files.length === 0) return;

    setUploading(true);
    setUploadStatus('Uploading documents...');

    try {
      const formData = new FormData();
      formData.append('vendor_name', vendorName.trim());
      files.forEach((f) => formData.append('files', f));

      const ingestRes = await fetch('/api/pipeline/ingest', {
        method: 'POST',
        body: formData,
      });

      if (!ingestRes.ok) {
        const errBody = await ingestRes.json().catch(() => ({}));
        throw new Error(errBody.error ?? `Ingest failed: ${ingestRes.status}`);
      }

      const { submission_Id } = await ingestRes.json();

      setUploadStatus('Running compliance pipeline...');

      const runRes = await fetch('/api/pipeline/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submission_Id }),
      });

      if (!runRes.ok) {
        const errBody = await runRes.json().catch(() => ({}));
        throw new Error(errBody.error ?? `Pipeline run failed: ${runRes.status}`);
      }

      setUploadStatus('Submission created successfully!');
      setVendorName('');
      setFiles([]);
      fetchSubmissions();

      setTimeout(() => setUploadStatus(null), 3000);
    } catch (err) {
      setUploadStatus(
        `Error: ${err instanceof Error ? err.message : 'Upload failed'}`
      );
    } finally {
      setUploading(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const stats = computeStats(submissions);

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-6">
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-brand-600" />
            <div>
              <h1 className="text-2xl font-bold text-neutral-900">VendorGuard</h1>
              <p className="text-sm text-neutral-500">
                AI-Powered Vendor Compliance Pipeline
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8 space-y-8">
        {/* Stats cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Submissions</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <p className="text-3xl font-bold text-neutral-900">{stats.total}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Auto-Approved</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-success-600" />
                  <p className="text-3xl font-bold text-success-700">{stats.autoApproved}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Escalated</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-danger-600" />
                  <p className="text-3xl font-bold text-danger-700">{stats.escalated}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Processing</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-neutral-500" />
                  <p className="text-3xl font-bold text-neutral-700">{stats.processing}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Upload section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Submit Vendor Documents</CardTitle>
            <CardDescription>
              Upload PDF documents for automated compliance review
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Vendor name input */}
            <div>
              <label
                htmlFor="vendor-name"
                className="block text-sm font-medium text-neutral-700 mb-1"
              >
                Vendor Name
              </label>
              <input
                id="vendor-name"
                type="text"
                value={vendorName}
                onChange={(e) => setVendorName(e.target.value)}
                placeholder="Enter vendor or company name"
                className="w-full max-w-md rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                disabled={uploading}
              />
            </div>

            {/* Drag-and-drop area */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
                dragOver
                  ? 'border-brand-500 bg-brand-50'
                  : 'border-neutral-300 hover:border-neutral-400 hover:bg-neutral-50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="application/pdf"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Upload className="mx-auto h-10 w-10 text-neutral-400" />
              <p className="mt-2 text-sm font-medium text-neutral-700">
                Drag &amp; drop PDF files here, or click to browse
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                Supports NDA, W-9, Certificate of Insurance, SOC 2, Business License, and more
              </p>
            </div>

            {/* Selected files */}
            {files.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-neutral-700">
                  Selected files ({files.length})
                </p>
                <div className="space-y-1">
                  {files.map((f, i) => (
                    <div
                      key={`${f.name}-${i}`}
                      className="flex items-center justify-between rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2"
                    >
                      <div className="flex items-center gap-2 text-sm">
                        <FileText className="h-4 w-4 text-neutral-500" />
                        <span className="text-neutral-700">{f.name}</span>
                        <span className="text-neutral-400">
                          ({(f.size / 1024).toFixed(1)} KB)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFile(i);
                        }}
                        className="text-neutral-400 hover:text-danger-600"
                        disabled={uploading}
                      >
                        <XCircle className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Upload status */}
            {uploadStatus && (
              <Alert
                variant={
                  uploadStatus.startsWith('Error')
                    ? 'destructive'
                    : uploadStatus.includes('successfully')
                    ? 'success'
                    : 'default'
                }
              >
                <AlertDescription>{uploadStatus}</AlertDescription>
              </Alert>
            )}

            {/* Upload button */}
            <Button
              onClick={handleUpload}
              disabled={uploading || !vendorName.trim() || files.length === 0}
              className="gap-2"
            >
              {uploading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {uploading ? 'Processing...' : 'Upload & Process'}
            </Button>
          </CardContent>
        </Card>

        {/* Submissions table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Submissions</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchSubmissions}
                className="gap-1 text-neutral-500"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : submissions.length === 0 ? (
              <div className="py-12 text-center">
                <FileText className="mx-auto h-12 w-12 text-neutral-300" />
                <p className="mt-3 text-sm font-medium text-neutral-500">
                  No submissions yet
                </p>
                <p className="mt-1 text-xs text-neutral-400">
                  Upload vendor documents above to get started
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Documents</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Risk Score</TableHead>
                    <TableHead>Decision</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {submissions.map((sub) => (
                    <TableRow
                      key={sub.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/submissions/${sub.id}`)}
                    >
                      <TableCell className="font-medium">
                        {sub.vendor?.company_name ?? sub.vendor?.name ?? sub.vendor_id}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-neutral-600">
                          <FileText className="h-4 w-4" />
                          <span>{sub.documents?.length ?? 0}</span>
                        </div>
                      </TableCell>
                      <TableCell>{statusBadge(sub.status)}</TableCell>
                      <TableCell>{riskBadge(sub.risk_score)}</TableCell>
                      <TableCell>{decisionLabel(sub.decision)}</TableCell>
                      <TableCell className="text-neutral-500 text-sm">
                        {formatDate(sub.submitted_at ?? sub.created_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
