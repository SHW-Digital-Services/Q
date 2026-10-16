import axios, { AxiosInstance } from 'axios';

const API_KEY = process.env.BETTERSTACK_API_KEY;
if (!API_KEY) throw new Error('Missing BETTERSTACK_API_KEY env var');

const INCIDENTS_BASE = process.env.BETTERSTACK_INCIDENTS_BASE || 'https://incidents.betterstack.com/api/v3';
const INCIDENT_ACTIONS_BASE = process.env.BETTERSTACK_INCIDENT_ACTIONS_BASE || 'https://uptime.betterstack.com/api/v3';
const COMMENTS_BASE = process.env.BETTERSTACK_COMMENTS_BASE || 'https://uptime.betterstack.com/api/v2';
const STATUS_BASE = process.env.BETTERSTACK_STATUS_BASE || 'https://status.betterstack.com/api/v2';

const client: AxiosInstance = axios.create({
  headers: {
    Authorization: `Bearer ${API_KEY}`,
    'Content-Type': 'application/json'
  },
  timeout: 10000
});

/**
 * Create an incident using BetterStack Incidents API v3.
 * Uses the documented top-level v3 fields.
 */
export async function createIncident(payload: {
  title: string;
  details?: string;
  metadata?: any;
  requester_email?: string;
}) {
  const requesterEmail = payload.requester_email || process.env.BETTERSTACK_REQUESTER_EMAIL;
  if (!requesterEmail) throw new Error('requester_email or BETTERSTACK_REQUESTER_EMAIL is required');

  const body = {
    name: payload.title,
    summary: payload.title,
    requester_email: requesterEmail,
    ...(payload.details ? { description: String(payload.details) } : {}),
    ...(payload.metadata ? { metadata: payload.metadata } : {})
  };

  const url = `${INCIDENTS_BASE}/incidents`;
  const resp = await client.post(url, body);
  return resp.data;
}

/**
 * Apply supported incident actions and post a comment using Better Stack APIs.
 */
export async function updateIncident(externalId: string, payload: {
  status?: string;
  message?: string;
}) {
  const incidentUrl = `${INCIDENT_ACTIONS_BASE}/incidents/${encodeURIComponent(externalId)}`;
  let result: any;

  if (payload.status) {
    const normalizedStatus = payload.status.toLowerCase();
    const action = normalizedStatus === 'resolved' ? 'resolve'
      : normalizedStatus === 'acknowledged' ? 'acknowledge'
      : null;
    if (!action) throw new Error(`Unsupported incident status: ${payload.status}`);
    const by = process.env.BETTERSTACK_REQUESTER_EMAIL || 'IT Hub';
    const response = await client.post(`${incidentUrl}/${action}`, {
      [action === 'resolve' ? 'resolved_by' : 'acknowledged_by']: by
    });
    result = response.data;
  }

  if (payload.message) {
    const response = await client.post(
      `${COMMENTS_BASE}/incidents/${encodeURIComponent(externalId)}/comments`,
      { content: payload.message }
    );
    result = response.data;
  }

  if (!result) throw new Error('Provide a supported status or a message to update');
  return result;
}

/**
 * Create a public status page incident (v2 status API) — kept for status page updates.
 */
export async function createStatusPageIncident(pageId: string, payload: {
  name: string;
  message?: string;
  status?: string;
  started_at?: string;
  metadata?: any;
}) {
  const body: any = {
    incident: {
      name: payload.name,
      message: payload.message || '',
      status: payload.status || 'investigating',
      ...(payload.started_at ? { started_at: payload.started_at } : {}),
      ...(payload.metadata ? { metadata: payload.metadata } : {})
    }
  };

  const url = `${STATUS_BASE}/pages/${encodeURIComponent(pageId)}/incidents`;
  const resp = await client.post(url, body);
  return (resp.data && resp.data.incident) ? resp.data.incident : resp.data;
}

/**
 * Post an update to a status page incident (v2)
 */
export async function postStatusPageUpdate(pageId: string, incidentId: string, update: {
  message: string;
  status?: string;
}) {
  const body = {
    update: {
      message: update.message,
      ...(update.status ? { status: update.status } : {})
    }
  };

  const url = `${STATUS_BASE}/pages/${encodeURIComponent(pageId)}/incidents/${encodeURIComponent(incidentId)}/updates`;
  const resp = await client.post(url, body);
  return (resp.data && resp.data.update) ? resp.data.update : resp.data;
}

/**
 * Fetch status page metadata (v2)
 */
export async function getStatusPage(pageId?: string) {
  const id = pageId || process.env.BETTERSTACK_STATUS_PAGE_ID;
  if (!id) return null;
  const url = `${STATUS_BASE}/pages/${encodeURIComponent(id)}`;
  const resp = await client.get(url);
  return resp.data;
}

export default {
  createIncident,
  updateIncident,
  createStatusPageIncident,
  postStatusPageUpdate,
  getStatusPage
};
