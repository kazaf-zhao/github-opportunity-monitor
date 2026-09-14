import { getCommercialOpportunities } from '@/lib/commercial';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const sortBy =
      url.searchParams.get('sort') === 'commercial' ? 'commercial' : 'money';
    const result = await getCommercialOpportunities(
      Number(url.searchParams.get('limit') ?? 100),
      sortBy,
    );
    return Response.json(result, {
      headers: { 'Cache-Control': 'private, max-age=0, must-revalidate' },
    });
  } catch (error) {
    console.error('commercial_opportunities_api_failed', error);
    return Response.json(
      { error: '无法读取商业机会分析，请确认数据库迁移和采集任务已完成。' },
      { status: 503 },
    );
  }
}
