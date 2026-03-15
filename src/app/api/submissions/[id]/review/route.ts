import { NextRequest, NextResponse } from 'next/server';
import { getSubmission, updateSubmission, createAuditLog } from '@/lib/db';

interface ReviewRequestBody {
  decision?: 'approved' | 'rejected';
  note?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    let body: ReviewRequestBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON request body.' },
        { status: 400 }
      );
    }

    const { decision, note } = body;

    // Validate decision
    if (!decision || !['approved', 'rejected'].includes(decision)) {
      return NextResponse.json(
        { error: 'decision is required and must be "approved" or "rejected".' },
        { status: 400 }
      );
    }

    // Validate note is required for rejection
    if (decision === 'rejected' && (!note || note.trim().length === 0)) {
      return NextResponse.json(
        { error: 'A note is required when rejecting a submission.' },
        { status: 400 }
      );
    }

    // Get the submission and validate its current status
    const submission = await getSubmission(id);

    // Only allow review of escalated submissions
    if (submission.status !== 'review' && submission.decision !== 'escalated') {
      return NextResponse.json(
        {
          error: `Submission is not in escalated status. Current status: ${submission.status}, decision: ${submission.decision}`,
          submission_id: id,
        },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const humanDecision = decision === 'approved' ? 'human_approved' : 'human_rejected';
    const newStatus = decision === 'approved' ? 'approved' : 'rejected';

    // Build decision reason including reviewer note
    let decisionReason = submission.decision_reason || '';
    if (note && note.trim().length > 0) {
      decisionReason += `\n\nReviewer note: ${note.trim()}`;
    }
    decisionReason = decisionReason.trim();

    // Update the submission
    const updatedSubmission = await updateSubmission(id, {
      status: newStatus,
      decision: humanDecision,
      decision_reason: decisionReason,
      decided_by: 'reviewer',
      decided_at: now,
    });

    // Create audit log entry
    await createAuditLog({
      submission_id: id,
      step: 'human_review',
      severity: 'info',
      message: `Human review completed: ${humanDecision}${note ? `. Note: ${note.trim()}` : ''}`,
      metadata: {
        decision: humanDecision,
        reviewer_note: note || null,
        previous_decision: submission.decision,
        previous_status: submission.status,
      },
    });

    return NextResponse.json({
      submission_id: id,
      decision: humanDecision,
      status: newStatus,
      decision_reason: decisionReason,
      submission: updatedSubmission,
    });
  } catch (error) {
    console.error('[review] Unhandled error:', error);

    return NextResponse.json(
      {
        error: 'Internal server error during human review.',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
