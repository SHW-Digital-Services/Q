import { Request, Response } from 'express';
import { createIncident, updateIncident, getStatusPage } from '../services/betterstack';
import { logEvent, getRecentEvents } from '../services/supabase_server';

export async function createIncidentHandler(req: Request, res: Response) {
  const { title, details, metadata, requester_email } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });

  try {
    const created = await createIncident({ title, details, metadata, requester_email });
    await logEvent('incident_created', created);
    res.status(201).json(created);
  } catch (err) {
    console.error('[IT Hub] Incident creation failed:', err instanceof Error ? `${err.name}: ${err.message}` : 'Unknown error');
    res.status(500).json({ error: 'failed to create incident' });
  }
}

export async function updateIncidentHandler(req: Request, res: Response) {
  const id = req.params.id;
  const { status, message } = req.body;
  try {
    const updated = await updateIncident(id, { status, message });
    await logEvent('incident_update', updated);
    res.json(updated);
  } catch (err) {
    console.error('[IT Hub] Incident update failed:', err instanceof Error ? `${err.name}: ${err.message}` : 'Unknown error');
    res.status(500).json({ error: 'failed to update incident' });
  }
}

export async function getStatusHandler(req: Request, res: Response) {
  try {
    const statusPage = await getStatusPage(process.env.BETTERSTACK_STATUS_PAGE_ID);
    const events = await getRecentEvents(50);
    res.json({ statusPage, recentEvents: events });
  } catch (err) {
    console.error('[IT Hub] Status fetch failed:', err instanceof Error ? `${err.name}: ${err.message}` : 'Unknown error');
    res.status(500).json({ error: 'failed to fetch status' });
  }
}
