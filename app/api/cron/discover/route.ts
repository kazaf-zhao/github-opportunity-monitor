import { discover } from '@/lib/collector';
import { authorizeCron } from '@/lib/cron-auth';

export async function GET(request: Request) {
  const denied = authorizeCron(request);
  if (denied) return denied;
  try {
    return Response.json(await discover());
  } catch (error) {
    console.error('discover_cron_failed', error);
    return Response.json({ error: 'Collector failed' }, { status: 500 });
  }
}
