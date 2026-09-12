import { getRepositoryOpportunities } from '@/lib/repository-data';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  try {
    const result = await getRepositoryOpportunities({
      limit: Number(url.searchParams.get('limit') ?? 100),
      offset: Number(url.searchParams.get('offset') ?? 0),
      owner: url.searchParams.get('owner') ?? undefined,
      repo: url.searchParams.get('repo') ?? undefined,
    });
    return Response.json(result, {
      headers: { 'Cache-Control': 'private, max-age=0, must-revalidate' },
    });
  } catch (error) {
    console.error('repositories_api_failed', error);
    return Response.json(
      { error: '无法读取真实仓库数据，请检查 Supabase 服务端配置。' },
      { status: 503 },
    );
  }
}
