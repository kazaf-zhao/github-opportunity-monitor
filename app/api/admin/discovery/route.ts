import { getRepositoryOpportunities } from '@/lib/repository-data';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return Response.json(
      await getRepositoryOpportunities({
        limit: 500,
        includeSpark: false,
        applyCategoryLimit: false,
      }),
      { headers: { 'Cache-Control': 'private, max-age=0, must-revalidate' } },
    );
  } catch (error) {
    console.error('discovery_debug_failed', error);
    return Response.json(
      { error: 'Discovery 调试数据读取失败' },
      { status: 503 },
    );
  }
}
