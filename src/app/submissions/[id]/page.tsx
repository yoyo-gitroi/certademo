import SubmissionDetail from '@/components/submission-detail';

export default function SubmissionPage({ params }: { params: { id: string } }) {
  return <SubmissionDetail submissionId={params.id} />;
}
