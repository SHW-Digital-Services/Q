type IncidentInput = {
  title: string;
  details?: string;
  requesterEmail: string;
};

function getBaseUrl(value: string | undefined, fallback: string) {
  const url = new URL(value || fallback);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error('BetterStack API base URL must be an HTTPS origin or path without credentials, query, or fragment.');
  }
  return url.toString().replace(/\/$/, '');
}

async function requestBetterstack(baseUrl: string, path: string, init?: RequestInit) {
  const apiKey = process.env.BETTERSTACK_API_KEY;
  if (!apiKey) throw new Error('BetterStack is not configured.');

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...init?.headers
    },
    signal: AbortSignal.timeout(10_000)
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`BetterStack request failed with status ${response.status}.`);
  return body;
}

const incidentsBase = () => getBaseUrl(process.env.BETTERSTACK_INCIDENTS_BASE, 'https://incidents.betterstack.com/api/v3');
const statusBase = () => getBaseUrl(process.env.BETTERSTACK_STATUS_BASE, 'https://incidents.betterstack.com/api/v2');

export async function createIncident(input: IncidentInput) {
  const body = await requestBetterstack(incidentsBase(), '/incidents', {
    method: 'POST',
    body: JSON.stringify({
      name: input.title,
      summary: input.title,
      requester_email: input.requesterEmail,
      ...(input.details ? { description: input.details } : {})
    })
  });
  return body;
}

export async function getStatusPage(pageId = process.env.BETTERSTACK_STATUS_PAGE_ID) {
  if (!pageId) return null;
  const body = await requestBetterstack(statusBase(), `/status-pages/${encodeURIComponent(pageId)}`);
  return body;
}
