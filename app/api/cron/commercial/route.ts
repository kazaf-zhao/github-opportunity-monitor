import { collectCommercialAnalyses } from '@/lib/commercial';
import { authorizeCron } from '@/lib/cron-auth';

export const maxDuration = 60;

export async function GET(request: Request) {
  const denied = authorizeCron(request);
  if (denied) return denied;
  try {
    return Response.json(await collectCommercialAnalyses(24));
  } catch (error) {
    console.error('commercial_cron_failed', error);
    return Response.json({ error: 'Commercial collector failed' }, { status: 500 });
  }
}
