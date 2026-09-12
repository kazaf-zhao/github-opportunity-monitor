import { getRepositoryOpportunities } from '@/lib/repository-data';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return Response.json(
      await getRepositoryOpportunities({ limit: 500, includeSpark: false }),
      { headers: { 'Cache-Control': 'private, max-age=0, must-revalidate' } },
    );
  } catch (error) {
    console.error('candidate_debug_failed', error);
    return Response.json({ error: '候选召回失败' }, { status: 503 });
  }
}
