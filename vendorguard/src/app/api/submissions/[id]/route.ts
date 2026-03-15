import { NextRequest, NextResponse } from 'next/server';
import { getSubmission, getAuditLogs } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get submission with documents and vendor info
    const submission = await getSubmission(id);

    // Get audit logs
    const auditLogs = await getAuditLogs(id);

    return NextResponse.json({
      ...submission,
      audit_log: auditLogs,
    });
  } catch (error) {
    console.error('[submission detail] Unhandled error:', error);

    // Check if it's a "not found" type error
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.includes('not found') || message.includes('no rows')) {
      return NextResponse.json(
        { error: 'Submission not found.' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        error: 'Internal server error fetching submission.',
        details: message,
      },
      { status: 500 }
    );
  }
}
