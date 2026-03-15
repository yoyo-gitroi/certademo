import { NextResponse } from 'next/server';
import { getSubmissions } from '@/lib/db';

export async function GET() {
  try {
    const submissions = await getSubmissions();

    return NextResponse.json({
      submissions,
      count: submissions.length,
    });
  } catch (error) {
    console.error('[submissions] Unhandled error:', error);

    return NextResponse.json(
      {
        error: 'Internal server error fetching submissions.',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
