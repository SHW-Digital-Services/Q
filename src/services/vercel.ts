import { logEvent } from './supabase';
import { createIncident } from './betterstack';

export async function createIncidentIfDeploymentFailed(payload: any) {
  const failed = (payload?.state === 'error') || (payload?.deploymentStatus === 'failed') || (payload?.status === 'failed') || (payload?.type === 'deployment.failed');
  if (!failed) return;

  const title = `Deployment failed: ${payload?.project?.name || payload?.name || payload?.source || 'unknown'}`;
  const details = JSON.stringify(payload, null, 2);

  try {
    const incident = await createIncident({ title, details, metadata: { source: 'vercel' } });
    await logEvent('incident_created_from_vercel', { payload, incident });
    return incident;
  } catch (err) {
    console.error('failed to create incident from vercel payload', err);
    await logEvent('incident_creation_error', { error: String(err), payload });
    return null;
  }
}
