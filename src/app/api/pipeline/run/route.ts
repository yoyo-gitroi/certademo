import { NextRequest, NextResponse } from 'next/server';
import {
  getSubmission,
  getDocumentsBySubmission,
  updateSubmission,
  createAuditLog,
} from '@/lib/db';
import { classifyDocument } from '@/lib/classifier';
import { extractDocument } from '@/lib/extractor';
import { assessSubmission } from '@/lib/risk-engine';
import { adjudicateSubmission } from '@/lib/adjudicator';
import { updateDocument } from '@/lib/db';

interface RunRequestBody {
  submission_id?: string;
}

export async function POST(request: NextRequest) {
  const pipelineStartTime = Date.now();

  try {
    let body: RunRequestBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON request body.' },
        { status: 400 }
      );
    }

    const { submission_id } = body;

    if (!submission_id) {
      return NextResponse.json(
        { error: 'submission_id is required.' },
        { status: 400 }
      );
    }

    // Verify submission exists
    let submission = await getSubmission(submission_id);

    await createAuditLog({
      submission_id,
      step: 'classify',
      severity: 'info',
      message: 'Full pipeline run started',
      metadata: { pipeline: 'full' },
    });

    // Update status to processing
    await updateSubmission(submission_id, { status: 'processing' });

    // ── Step 1: Classify ──────────────────────────────────────────────────
    const documents = await getDocumentsBySubmission(submission_id);
    const docsToClassify = documents.filter(
      (doc) => doc.raw_text && doc.extraction_status === 'pending'
    );

    let classifySuccessCount = 0;
    let classifyFailCount = 0;

    for (const doc of docsToClassify) {
      const startTime = Date.now();
      try {
        const classification = await classifyDocument(doc.raw_text!);
        const durationMs = Date.now() - startTime;

        await updateDocument(doc.id, {
          document_type: classification.document_type,
          classification_confidence: classification.confidence,
          extraction_status: 'completed',
        });

        await createAuditLog({
          submission_id,
          document_id: doc.id,
          step: 'classify',
          severity: classification.confidence < 0.6 ? 'warn' : 'info',
          message: `Classified "${doc.file_name}" as "${classification.document_type}" with confidence ${classification.confidence.toFixed(3)}.`,
          metadata: {
            document_type: classification.document_type,
            confidence: classification.confidence,
            duration_ms: durationMs,
          },
        });

        classifySuccessCount++;
      } catch (error) {
        const durationMs = Date.now() - startTime;

        await updateDocument(doc.id, { extraction_status: 'failed' });

        await createAuditLog({
          submission_id,
          document_id: doc.id,
          step: 'classify',
          severity: 'error',
          message: `Classification failed for "${doc.file_name}": ${error instanceof Error ? error.message : 'Unknown error'}`,
          metadata: {
            error: error instanceof Error ? error.message : String(error),
            duration_ms: durationMs,
          },
        });

        classifyFailCount++;
      }
    }

    // ── Step 2: Extract ───────────────────────────────────────────────────
    // Re-fetch documents to get updated classification data
    const classifiedDocs = await getDocumentsBySubmission(submission_id);
    const docsToExtract = classifiedDocs.filter(
      (doc) =>
        doc.raw_text &&
        doc.document_type &&
        doc.extraction_status === 'completed' &&
        !doc.extracted_data
    );

    let extractSuccessCount = 0;
    let extractFailCount = 0;

    for (const doc of docsToExtract) {
      const startTime = Date.now();
      try {
        const extractedData = await extractDocument(
          doc.raw_text!,
          doc.document_type!
        );
        const durationMs = Date.now() - startTime;

        await updateDocument(doc.id, {
          extracted_data: extractedData,
          extraction_status: 'completed',
        });

        const fieldCount = extractedData ? Object.keys(extractedData).length : 0;

        await createAuditLog({
          submission_id,
          document_id: doc.id,
          step: 'extract',
          severity: 'info',
          message: `Extracted ${fieldCount} field(s) from "${doc.file_name}" (type: ${doc.document_type}).`,
          metadata: {
            document_type: doc.document_type,
            field_count: fieldCount,
            duration_ms: durationMs,
          },
        });

        extractSuccessCount++;
      } catch (error) {
        const durationMs = Date.now() - startTime;

        await updateDocument(doc.id, { extraction_status: 'failed' });

        await createAuditLog({
          submission_id,
          document_id: doc.id,
          step: 'extract',
          severity: 'error',
          message: `Extraction failed for "${doc.file_name}": ${error instanceof Error ? error.message : 'Unknown error'}`,
          metadata: {
            document_type: doc.document_type,
            error: error instanceof Error ? error.message : String(error),
            duration_ms: durationMs,
          },
        });

        extractFailCount++;
      }
    }

    // Check if all documents failed text extraction
    const finalDocs = await getDocumentsBySubmission(submission_id);
    const successfullyExtracted = finalDocs.filter(
      (d) => d.extraction_status === 'completed' && d.extracted_data
    );

    if (successfullyExtracted.length === 0 && finalDocs.length > 0) {
      await updateSubmission(submission_id, { status: 'error' });

      await createAuditLog({
        submission_id,
        step: 'extract',
        severity: 'error',
        message:
          'Pipeline halted: all documents failed text extraction. No documents available for assessment.',
        metadata: {
          total_documents: finalDocs.length,
          duration_ms: Date.now() - pipelineStartTime,
        },
      });

      return NextResponse.json(
        {
          error:
            'Pipeline failed: all documents failed text extraction. No documents available for assessment.',
          submission_id,
          classify_results: {
            success: classifySuccessCount,
            failed: classifyFailCount,
          },
          extract_results: {
            success: extractSuccessCount,
            failed: extractFailCount,
          },
        },
        { status: 422 }
      );
    }

    // ── Step 3: Assess ────────────────────────────────────────────────────
    const assessmentResult = await assessSubmission(submission_id);

    // ── Step 4: Adjudicate ────────────────────────────────────────────────
    const adjudicationResult = await adjudicateSubmission(submission_id);

    const totalDurationMs = Date.now() - pipelineStartTime;

    await createAuditLog({
      submission_id,
      step: 'adjudicate',
      severity: 'info',
      message: `Full pipeline completed in ${totalDurationMs}ms. Decision: ${adjudicationResult.decision}`,
      metadata: {
        pipeline: 'full',
        total_duration_ms: totalDurationMs,
        classify: { success: classifySuccessCount, failed: classifyFailCount },
        extract: { success: extractSuccessCount, failed: extractFailCount },
        risk_score: assessmentResult.risk_score,
        flag_count: assessmentResult.risk_flags.length,
        decision: adjudicationResult.decision,
      },
    });

    // Get final submission state
    submission = await getSubmission(submission_id);

    return NextResponse.json({
      submission_id,
      status: submission.status,
      risk_score: assessmentResult.risk_score,
      risk_flags: assessmentResult.risk_flags,
      decision: adjudicationResult.decision,
      decision_reason: adjudicationResult.decision_reason,
      pipeline_duration_ms: totalDurationMs,
      classify_results: {
        success: classifySuccessCount,
        failed: classifyFailCount,
      },
      extract_results: {
        success: extractSuccessCount,
        failed: extractFailCount,
      },
      submission,
    });
  } catch (error) {
    console.error('[pipeline/run] Unhandled error:', error);

    return NextResponse.json(
      {
        error: 'Internal server error during pipeline execution.',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
