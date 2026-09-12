export function authorizeCron(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return process.env.NODE_ENV === 'development'
      ? null
      : Response.json(
          { error: 'CRON_SECRET is not configured' },
          { status: 503 },
        );
  }
  return request.headers.get('authorization') === `Bearer ${secret}`
    ? null
    : Response.json({ error: 'Unauthorized' }, { status: 401 });
}
