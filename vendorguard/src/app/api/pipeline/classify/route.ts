import { NextRequest, NextResponse } from 'next/server';
import {
  getDocumentsBySubmission,
  updateDocument,
  createAuditLog,
} from '@/lib/db';
import { supabase } from '@/lib/supabase';
import { classifyDocument } from '@/lib/classifier';

interface ClassifyRequestBody {
  submission_id?: string;
  document_id?: string;
}

export async function POST(request: NextRequest) {
  try {
    let body: ClassifyRequestBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON request body.' },
        { status: 400 }
      );
    }

    const { submission_id, document_id } = body;

    if (!submission_id && !document_id) {
      return NextResponse.json(
        { error: 'Either submission_id or document_id is required.' },
        { status: 400 }
      );
    }

    // Collect the documents to classify
    let documentsToClassify: Array<{
      id: string;
      submission_id: string;
      raw_text: string | null;
      file_name: string;
      extraction_status: string;
    }> = [];

    if (submission_id) {
      const allDocs = await getDocumentsBySubmission(submission_id);
      // Classify documents that have raw_text and are in pending status
      documentsToClassify = allDocs.filter(
        (doc) => doc.raw_text && doc.extraction_status === 'pending'
      );

      if (documentsToClassify.length === 0) {
        return NextResponse.json(
          {
            error: 'No documents pending classification found for this submission.',
            submission_id,
          },
          { status: 404 }
        );
      }
    } else if (document_id) {
      const { data: doc, error } = await supabase
        .from('documents')
        .select('*')
        .eq('id', document_id)
        .single();

      if (error || !doc) {
        return NextResponse.json(
          { error: `Document not found: ${document_id}` },
          { status: 404 }
        );
      }

      if (!doc.raw_text) {
        return NextResponse.json(
          { error: 'Document has no extracted text. Run ingestion first.' },
          { status: 400 }
        );
      }

      documentsToClassify = [doc];
    }

    // Classify each document
    const classifiedDocuments = [];

    for (const doc of documentsToClassify) {
      const startTime = Date.now();

      try {
        const classification = await classifyDocument(doc.raw_text!);
        const durationMs = Date.now() - startTime;

        const updatedDoc = await updateDocument(doc.id, {
          document_type: classification.document_type,
          classification_confidence: classification.confidence,
          extraction_status: 'completed', // marked as classified via completed
        });

        // Log classification result
        const severity = classification.confidence < 0.6 ? 'warn' : 'info';
        const warningNote =
          classification.confidence < 0.6
            ? ` (LOW CONFIDENCE - below 0.6 threshold)`
            : '';

        await createAuditLog({
          submission_id: doc.submission_id,
          document_id: doc.id,
          step: 'classify',
          severity,
          message: `Classified "${doc.file_name}" as "${classification.document_type}" with confidence ${classification.confidence.toFixed(3)}${warningNote}.`,
          metadata: {
            document_type: classification.document_type,
            confidence: classification.confidence,
            low_confidence: classification.confidence < 0.6,
            duration_ms: durationMs,
          },
        });

        classifiedDocuments.push(updatedDoc);
      } catch (classifyError) {
        const durationMs = Date.now() - startTime;

        await createAuditLog({
          submission_id: doc.submission_id,
          document_id: doc.id,
          step: 'classify',
          severity: 'error',
          message: `Classification failed for "${doc.file_name}": ${classifyError instanceof Error ? classifyError.message : 'Unknown error'}`,
          metadata: {
            error: classifyError instanceof Error ? classifyError.message : String(classifyError),
            duration_ms: durationMs,
          },
        });

        // Update extraction_status to failed
        const failedDoc = await updateDocument(doc.id, {
          extraction_status: 'failed',
        });

        classifiedDocuments.push(failedDoc);
      }
    }

    return NextResponse.json({
      classified_count: classifiedDocuments.filter(
        (d) => d.extraction_status === 'completed'
      ).length,
      failed_count: classifiedDocuments.filter(
        (d) => d.extraction_status === 'failed'
      ).length,
      documents: classifiedDocuments.map((doc) => ({
        id: doc.id,
        submission_id: doc.submission_id,
        file_name: doc.file_name,
        document_type: doc.document_type,
        classification_confidence: doc.classification_confidence,
        extraction_status: doc.extraction_status,
      })),
    });
  } catch (error) {
    console.error('[classify] Unhandled error:', error);

    return NextResponse.json(
      {
        error: 'Internal server error during classification.',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
