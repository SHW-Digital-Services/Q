import axios, { AxiosInstance } from 'axios';

const API_KEY = process.env.BETTERSTACK_API_KEY;
if (!API_KEY) throw new Error('Missing BETTERSTACK_API_KEY env var');

const INCIDENTS_BASE = process.env.BETTERSTACK_INCIDENTS_BASE || 'https://incidents.betterstack.com/api/v3';
const INCIDENT_ACTIONS_BASE = process.env.BETTERSTACK_INCIDENT_ACTIONS_BASE || 'https://uptime.betterstack.com/api/v3';
const COMMENTS_BASE = process.env.BETTERSTACK_COMMENTS_BASE || 'https://incidents.betterstack.com/api/v2';
const STATUS_BASE = process.env.BETTERSTACK_STATUS_BASE || 'https://incidents.betterstack.com/api/v2';
const STATUS_UPDATES_BASE = process.env.BETTERSTACK_STATUS_UPDATES_BASE || 'https://uptime.betterstack.com/api/v2';

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

type StatusPageAffectedResource = {
  status_page_resource_id: string;
  status: 'maintenance' | 'resolved' | 'degraded' | 'downtime';
};

/** Create a status page report using Better Stack's status-pages API. */
export async function createStatusPageReport(pageId: string, payload: {
  title: string;
  message: string;
  reportType?: 'manual' | 'maintenance';
  notifySubscribers?: boolean;
  affectedResources: StatusPageAffectedResource[];
}) {
  const body = {
    title: payload.title,
    message: payload.message,
    report_type: payload.reportType || 'manual',
    ...(payload.notifySubscribers !== undefined ? { notify_subscribers: payload.notifySubscribers } : {}),
    affected_resources: payload.affectedResources
  };
  const url = `${STATUS_BASE}/status-pages/${encodeURIComponent(pageId)}/status-reports`;
  const resp = await client.post(url, body);
  return resp.data;
}

/** Post a status update to an existing status page report. */
export async function postStatusPageUpdate(pageId: string, reportId: string, update: {
  message: string;
  notifySubscribers?: boolean;
  affectedResources: StatusPageAffectedResource[];
}) {
  const body = {
    message: update.message,
    ...(update.notifySubscribers !== undefined ? { notify_subscribers: update.notifySubscribers } : {}),
    affected_resources: update.affectedResources
  };
  const url = `${STATUS_UPDATES_BASE}/status-pages/${encodeURIComponent(pageId)}/status-reports/${encodeURIComponent(reportId)}/status-updates`;
  const resp = await client.post(url, body);
  return resp.data;
}

/**
 * Fetch status page metadata (v2)
 */
export async function getStatusPage(pageId?: string) {
  const id = pageId || process.env.BETTERSTACK_STATUS_PAGE_ID;
  if (!id) return null;
  const url = `${STATUS_BASE}/status-pages/${encodeURIComponent(id)}`;
  const resp = await client.get(url);
  return resp.data;
}

export default {
  createIncident,
  updateIncident,
  createStatusPageReport,
  postStatusPageUpdate,
  getStatusPage
};
