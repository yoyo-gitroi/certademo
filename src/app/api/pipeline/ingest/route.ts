import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { PDFParse } from 'pdf-parse';
import {
  createVendor,
  createSubmission,
  updateSubmission,
  createDocument,
  updateDocument,
  createAuditLog,
} from '@/lib/db';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 10;
const MIN_TEXT_LENGTH = 50;

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Parse multipart form data
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        { error: 'Invalid request. Expected multipart/form-data.' },
        { status: 400 }
      );
    }

    // Validate vendor_name
    const vendorName = formData.get('vendor_name');
    if (!vendorName || typeof vendorName !== 'string' || vendorName.trim().length === 0) {
      return NextResponse.json(
        { error: 'vendor_name is required and must be a non-empty string.' },
        { status: 400 }
      );
    }

    // Collect files from the form data
    const files: File[] = [];
    const allEntries = formData.getAll('files');
    for (const entry of allEntries) {
      if (entry instanceof File) {
        files.push(entry);
      }
    }

    // Also check for singular 'file' key
    const singleFileEntries = formData.getAll('file');
    for (const entry of singleFileEntries) {
      if (entry instanceof File) {
        files.push(entry);
      }
    }

    // Validate: at least 1 file
    if (files.length === 0) {
      return NextResponse.json(
        { error: 'At least one PDF file is required.' },
        { status: 400 }
      );
    }

    // Validate: max 10 files
    if (files.length > MAX_FILES) {
      return NextResponse.json(
        { error: `Maximum ${MAX_FILES} files allowed per submission. Received ${files.length}.` },
        { status: 400 }
      );
    }

    // Validate each file
    for (const file of files) {
      // Check file type is PDF
      const fileName = file.name.toLowerCase();
      if (!fileName.endsWith('.pdf')) {
        return NextResponse.json(
          { error: `Invalid file type for "${file.name}". Only PDF files (.pdf) are accepted.` },
          { status: 400 }
        );
      }

      // Check file size
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          {
            error: `File "${file.name}" exceeds the maximum size of 10MB (${(file.size / (1024 * 1024)).toFixed(1)}MB).`,
          },
          { status: 413 }
        );
      }
    }

    // Create or find vendor
    const vendor = await createVendor(vendorName.trim());

    // Create submission
    const submission = await createSubmission(vendor.id);

    // Update submission status to processing
    await updateSubmission(submission.id, { status: 'processing' });

    // Create upload directory
    const uploadDir = path.join('/tmp', 'uploads', submission.id);
    await fs.mkdir(uploadDir, { recursive: true });

    // Log ingest start
    await createAuditLog({
      submission_id: submission.id,
      step: 'ingest',
      severity: 'info',
      message: `Ingestion started for vendor "${vendor.name}" with ${files.length} file(s).`,
      metadata: {
        vendor_id: vendor.id,
        vendor_name: vendor.name,
        file_count: files.length,
        file_names: files.map((f) => f.name),
      },
    });

    // Process each file
    const documents = [];

    for (const file of files) {
      const fileStartTime = Date.now();

      try {
        // Read file buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Save file to disk
        const filePath = path.join(uploadDir, file.name);
        await fs.writeFile(filePath, buffer);

        // Create document record
        const document = await createDocument(
          submission.id,
          file.name,
          filePath,
          file.size
        );

        // Extract text from PDF
        try {
          const parser = new PDFParse({ data: buffer });
          const textResult = await parser.getText();
          await parser.destroy();
          const rawText = textResult.text?.trim() || '';

          if (rawText.length < MIN_TEXT_LENGTH) {
            // Text too short - likely a scanned image
            const updatedDoc = await updateDocument(document.id, {
              raw_text: rawText || null,
              extraction_status: 'failed',
            });

            await createAuditLog({
              submission_id: submission.id,
              document_id: document.id,
              step: 'ingest',
              severity: 'warn',
              message: `Text extraction for "${file.name}" yielded insufficient text (${rawText.length} chars). The PDF may be a scanned image without OCR.`,
              metadata: {
                file_name: file.name,
                extracted_length: rawText.length,
                duration_ms: Date.now() - fileStartTime,
              },
            });

            documents.push(updatedDoc);
          } else {
            // Successful extraction
            const updatedDoc = await updateDocument(document.id, {
              raw_text: rawText,
              extraction_status: 'pending',
            });

            await createAuditLog({
              submission_id: submission.id,
              document_id: document.id,
              step: 'ingest',
              severity: 'info',
              message: `Text extracted from "${file.name}" (${rawText.length} chars).`,
              metadata: {
                file_name: file.name,
                extracted_length: rawText.length,
                duration_ms: Date.now() - fileStartTime,
              },
            });

            documents.push(updatedDoc);
          }
        } catch (pdfError) {
          // PDF parsing failed
          const updatedDoc = await updateDocument(document.id, {
            extraction_status: 'failed',
          });

          await createAuditLog({
            submission_id: submission.id,
            document_id: document.id,
            step: 'ingest',
            severity: 'error',
            message: `Failed to extract text from "${file.name}": ${pdfError instanceof Error ? pdfError.message : 'Unknown error'}`,
            metadata: {
              file_name: file.name,
              error: pdfError instanceof Error ? pdfError.message : String(pdfError),
              duration_ms: Date.now() - fileStartTime,
            },
          });

          documents.push(updatedDoc);
          // Continue processing other files
        }
      } catch (fileError) {
        // File processing failed entirely (e.g., write error)
        await createAuditLog({
          submission_id: submission.id,
          step: 'ingest',
          severity: 'error',
          message: `Failed to process file "${file.name}": ${fileError instanceof Error ? fileError.message : 'Unknown error'}`,
          metadata: {
            file_name: file.name,
            error: fileError instanceof Error ? fileError.message : String(fileError),
            duration_ms: Date.now() - fileStartTime,
          },
        });
        // Continue processing other files
      }
    }

    // Log ingest completion
    await createAuditLog({
      submission_id: submission.id,
      step: 'ingest',
      severity: 'info',
      message: `Ingestion completed. ${documents.length}/${files.length} file(s) processed.`,
      metadata: {
        total_files: files.length,
        processed_files: documents.length,
        duration_ms: Date.now() - startTime,
      },
    });

    return NextResponse.json({
      submission_id: submission.id,
      vendor_id: vendor.id,
      documents: documents.map((doc) => ({
        id: doc.id,
        file_name: doc.file_name,
        file_size: doc.file_size,
        extraction_status: doc.extraction_status,
        raw_text_length: doc.raw_text?.length || 0,
      })),
    });
  } catch (error) {
    console.error('[ingest] Unhandled error:', error);

    return NextResponse.json(
      {
        error: 'Internal server error during ingestion.',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
