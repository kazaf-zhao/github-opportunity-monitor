import { snapshot } from '@/lib/collector';
import { authorizeCron } from '@/lib/cron-auth';

export async function GET(request: Request) {
  const denied = authorizeCron(request);
  if (denied) return denied;
  try {
    return Response.json(await snapshot());
  } catch (error) {
    console.error('snapshot_cron_failed', error);
    return Response.json({ error: 'Snapshot update failed' }, { status: 500 });
  }
}
