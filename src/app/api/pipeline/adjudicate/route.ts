import { NextRequest, NextResponse } from 'next/server';
import { getSubmission } from '@/lib/db';
import { adjudicateSubmission } from '@/lib/adjudicator';

interface AdjudicateRequestBody {
  submission_id?: string;
}

export async function POST(request: NextRequest) {
  try {
    let body: AdjudicateRequestBody;
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

    // Validate submission has been assessed
    const submission = await getSubmission(submission_id);

    if (!submission.risk_score) {
      return NextResponse.json(
        {
          error: 'Submission has not been assessed yet. Run risk assessment first.',
          submission_id,
        },
        { status: 400 }
      );
    }

    const result = await adjudicateSubmission(submission_id);

    return NextResponse.json({
      submission_id,
      decision: result.decision,
      decision_reason: result.decision_reason,
      submission: result.submission,
    });
  } catch (error) {
    console.error('[adjudicate] Unhandled error:', error);

    return NextResponse.json(
      {
        error: 'Internal server error during adjudication.',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
