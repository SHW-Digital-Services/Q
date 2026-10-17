import { logEvent } from './supabase_server';
import { createIncident } from './betterstack';

export async function createIncidentIfDeploymentFailed(payload: any) {
  const eventType = payload?.type || payload?.event;
  const failed = eventType === 'deployment.error'
    || eventType === 'deployment-error'
    || payload?.state === 'error'
    || payload?.deploymentStatus === 'failed'
    || payload?.status === 'failed';
  if (!failed) return;

  const event = payload?.payload || payload;
  const deploymentName = event?.deployment?.name || event?.project?.name || event?.name || event?.source || 'unknown';
  const title = `Deployment failed: ${deploymentName}`;
  const details = JSON.stringify(event, null, 2);

  try {
    const incident = await createIncident({
      title,
      details,
      metadata: { source: 'vercel' },
      requester_email: process.env.BETTERSTACK_REQUESTER_EMAIL
    });
    await logEvent('incident_created_from_vercel', { payload, incident });
    return incident;
  } catch (err) {
    console.error('[IT Hub] Incident creation from Vercel failed:', err instanceof Error ? `${err.name}: ${err.message}` : 'Unknown error');
    await logEvent('incident_creation_error', { error: String(err), payload });
    return null;
  }
}
