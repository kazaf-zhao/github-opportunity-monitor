type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'HEAD';
function config() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase is not configured');
  return { url, key };
}

export async function supabaseFetch(
  path: string,
  method: Method = 'GET',
  body?: unknown,
  prefer = 'return=representation',
) {
  const { url, key } = config();
  const headers: Record<string, string> = {
    apikey: key,
    'Content-Type': 'application/json',
    Prefer: prefer,
  };
  if (!key.startsWith('sb_secret_')) {
    headers.Authorization = `Bearer ${key}`;
  }
  const serializedBody = body ? JSON.stringify(body) : undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(`${url}/rest/v1/${path}`, {
      method,
      headers,
      body: serializedBody,
      cache: 'no-store',
    });
    if (response.ok) return response;
    const details = await response.text();
    if (![502, 503, 504].includes(response.status) || attempt === 2)
      throw new Error(
        `Supabase ${response.status} for ${path.split('?')[0]}: ${details}`,
      );
    await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt));
  }
  throw new Error(`Supabase request failed for ${path.split('?')[0]}`);
}

export async function supabaseRequest<T>(
  path: string,
  method: Method = 'GET',
  body?: unknown,
  prefer?: string,
): Promise<T> {
  const response = await supabaseFetch(path, method, body, prefer);
  return response.status === 204 ? ([] as T) : response.json();
}

export async function supabaseCount(table: string, column = 'id') {
  const response = await supabaseFetch(
    `${table}?select=${encodeURIComponent(column)}`,
    'HEAD',
    undefined,
    'count=exact',
  );
  const range = response.headers.get('content-range');
  return Number(range?.split('/')[1] ?? 0);
}
