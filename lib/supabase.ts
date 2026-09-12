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
  const response = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: prefer,
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  if (!response.ok)
    throw new Error(`Supabase ${response.status}: ${await response.text()}`);
  return response;
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

export async function supabaseCount(table: string) {
  const response = await supabaseFetch(
    `${table}?select=id`,
    'HEAD',
    undefined,
    'count=exact',
  );
  const range = response.headers.get('content-range');
  return Number(range?.split('/')[1] ?? 0);
}
