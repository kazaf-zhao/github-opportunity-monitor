type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';
export async function supabaseRequest<T>(
  path: string,
  method: Method = 'GET',
  body?: unknown,
): Promise<T> {
  const url = process.env.SUPABASE_URL,
    key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase is not configured');
  const response = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok)
    throw new Error(`Supabase ${response.status}: ${await response.text()}`);
  return response.status === 204 ? ([] as T) : response.json();
}
