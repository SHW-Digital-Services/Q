import axios, { AxiosInstance } from 'axios';

const API_KEY = process.env.BETTERSTACK_API_KEY;
if (!API_KEY) throw new Error('Missing BETTERSTACK_API_KEY env var');

const INCIDENTS_BASE = process.env.BETTERSTACK_INCIDENTS_BASE || 'https://incidents.betterstack.com/api/v3';
const STATUS_BASE = process.env.BETTERSTACK_STATUS_BASE || 'https://status.betterstack.com/api/v2';

const client: AxiosInstance = axios.create({
  headers: {
    Authorization: `Bearer ${API_KEY}`,
    'Content-Type': 'application/json'
  },
  timeout: 10000
});

export async function createIncident(payload: {
  title: string;
  details?: string;
  metadata?: any;
  status?: string;
  started_at?: string;
}) {
  const body = {
    incident: {
      name: payload.title,
      message: payload.details || '',
      metadata: payload.metadata || {},
      status: payload.status || 'investigating',
      ...(payload.started_at ? { started_at: payload.started_at } : {})
    }
  };

  const url = `${INCIDENTS_BASE}/incidents`;
  const resp = await client.post(url, body);
  return (resp.data && resp.data.incident) ? resp.data.incident : resp.data;
}

export async function updateIncident(externalId: string, payload: {
  status?: string;
  message?: string;
  summary?: string;
  resolved_at?: string;
  metadata?: any;
}) {
  const body: any = { incident: {} };
  if (payload.status) body.incident.status = payload.status;
  if (payload.message) body.incident.message = payload.message;
  if (payload.summary) body.incident.summary = payload.summary;
  if (payload.resolved_at) body.incident.resolved_at = payload.resolved_at;
  if (payload.metadata) body.incident.metadata = payload.metadata;

  const url = `${INCIDENTS_BASE}/incidents/${encodeURIComponent(externalId)}`;
  const resp = await client.patch(url, body);
  return (resp.data && resp.data.incident) ? resp.data.incident : resp.data;
}

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
