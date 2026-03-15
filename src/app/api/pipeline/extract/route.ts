import { NextRequest, NextResponse } from 'next/server';
import {
  getDocumentsBySubmission,
  updateDocument,
  createAuditLog,
} from '@/lib/db';
import { supabase } from '@/lib/supabase';
import { extractDocument } from '@/lib/extractor';

interface ExtractRequestBody {
  submission_id?: string;
  document_id?: string;
}

export async function POST(request: NextRequest) {
  try {
    let body: ExtractRequestBody;
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

    // Collect documents to extract
    let documentsToExtract: Array<{
      id: string;
      submission_id: string;
      raw_text: string | null;
      file_name: string;
      document_type: string | null;
      extraction_status: string;
    }> = [];

    if (submission_id) {
      const allDocs = await getDocumentsBySubmission(submission_id);
      // Extract documents that have been classified (extraction_status = 'completed' means classified)
      documentsToExtract = allDocs.filter(
        (doc) => doc.raw_text && doc.document_type && doc.extraction_status === 'completed'
      );

      if (documentsToExtract.length === 0) {
        return NextResponse.json(
          {
            error: 'No classified documents found for extraction in this submission.',
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

      if (!doc.document_type) {
        return NextResponse.json(
          { error: 'Document has not been classified. Run classification first.' },
          { status: 400 }
        );
      }

      documentsToExtract = [doc];
    }

    // Extract data from each document
    const extractedDocuments = [];

    for (const doc of documentsToExtract) {
      const startTime = Date.now();

      try {
        const extractedData = await extractDocument(doc.raw_text!, doc.document_type!);
        const durationMs = Date.now() - startTime;

        const updatedDoc = await updateDocument(doc.id, {
          extracted_data: extractedData,
          extraction_status: 'completed',
        });

        const fieldCount = extractedData ? Object.keys(extractedData).length : 0;

        await createAuditLog({
          submission_id: doc.submission_id,
          document_id: doc.id,
          step: 'extract',
          severity: 'info',
          message: `Extracted ${fieldCount} field(s) from "${doc.file_name}" (type: ${doc.document_type}).`,
          metadata: {
            document_type: doc.document_type,
            field_count: fieldCount,
            extracted_fields: extractedData ? Object.keys(extractedData) : [],
            duration_ms: durationMs,
          },
        });

        extractedDocuments.push(updatedDoc);
      } catch (extractError) {
        const durationMs = Date.now() - startTime;

        await createAuditLog({
          submission_id: doc.submission_id,
          document_id: doc.id,
          step: 'extract',
          severity: 'error',
          message: `Extraction failed for "${doc.file_name}": ${extractError instanceof Error ? extractError.message : 'Unknown error'}`,
          metadata: {
            document_type: doc.document_type,
            error: extractError instanceof Error ? extractError.message : String(extractError),
            duration_ms: durationMs,
          },
        });

        const failedDoc = await updateDocument(doc.id, {
          extraction_status: 'failed',
        });

        extractedDocuments.push(failedDoc);
      }
    }

    return NextResponse.json({
      extracted_count: extractedDocuments.filter(
        (d) => d.extraction_status === 'completed'
      ).length,
      failed_count: extractedDocuments.filter(
        (d) => d.extraction_status === 'failed'
      ).length,
      documents: extractedDocuments.map((doc) => ({
        id: doc.id,
        submission_id: doc.submission_id,
        file_name: doc.file_name,
        document_type: doc.document_type,
        extraction_status: doc.extraction_status,
        extracted_data: doc.extracted_data,
      })),
    });
  } catch (error) {
    console.error('[extract] Unhandled error:', error);

    return NextResponse.json(
      {
        error: 'Internal server error during extraction.',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
