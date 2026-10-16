type DependencyState = 'up' | 'down' | 'not_configured';

type HealthResponse = {
  status: 'ok' | 'down';
  services: {
    api: 'up';
    database: DependencyState;
    auth: DependencyState;
  };
  timestamp: string;
};

async function checkDependency(url: string, apiKey: string): Promise<DependencyState> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(url, {
      headers: { apikey: apiKey },
      signal: controller.signal
    });
    return response.ok ? 'up' : 'down';
  } catch {
    return 'down';
  } finally {
    clearTimeout(timeout);
  }
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  res.setHeader('Cache-Control', 'no-store');

  const timestamp = new Date().toISOString();
  const supabaseUrl = (
    process.env.VITE_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    ''
  ).replace(/\/$/, '');
  const supabaseAnonKey =
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let auth: DependencyState = 'not_configured';
  let database: DependencyState = 'not_configured';

  if (supabaseUrl && supabaseAnonKey) {
    [auth, database] = await Promise.all([
      checkDependency(`${supabaseUrl}/auth/v1/health`, supabaseAnonKey),
      checkDependency(`${supabaseUrl}/rest/v1/site_settings?select=key&limit=1`, supabaseAnonKey)
    ]);
  }

  const status = auth === 'up' && database === 'up' ? 'ok' : 'down';
  const body: HealthResponse = {
    status,
    services: { api: 'up', database, auth },
    timestamp
  };

  return res.status(status === 'ok' ? 200 : 503).json(body);
}
