import { NextRequest, NextResponse } from 'next/server';
import { assessSubmission } from '@/lib/risk-engine';

interface AssessRequestBody {
  submission_id?: string;
}

export async function POST(request: NextRequest) {
  try {
    let body: AssessRequestBody;
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

    const result = await assessSubmission(submission_id);

    return NextResponse.json({
      submission_id,
      risk_score: result.risk_score,
      risk_flags: result.risk_flags,
      flag_count: result.risk_flags.length,
    });
  } catch (error) {
    console.error('[assess] Unhandled error:', error);

    return NextResponse.json(
      {
        error: 'Internal server error during risk assessment.',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
