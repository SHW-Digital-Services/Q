import express from 'express';
import { requireStaff } from './admin.js';
import { asyncHandler } from '../middleware.js';

export function createCrmNotificationsRouter(authorise: typeof requireStaff = requireStaff) {
  const router = express.Router();
  router.get('/', asyncHandler(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store, private');
    const staff = await authorise(req, res); if (!staff) return;
    const can = (capability: string) => staff.role === 'partner_admin' || (staff.permissions.length ? staff.permissions.includes(capability) : ['crm.read','support.read','billing.read'].includes(capability));
    const sources = [
      {key:'customers', table:'profiles', time:'created_at', capability:'crm.read'},
      {key:'activity', table:'crm_activities', time:'created_at', capability:'crm.read'},
      {key:'tasks', table:'crm_tasks', time:'updated_at', capability:'crm.read'},
      {key:'communications', table:'crm_communications', time:'created_at', capability:'crm.read'},
      {key:'support', table:'support_events', time:'created_at', capability:'support.read'},
      {key:'feedback', table:'feedback_suggestions', time:'created_at', capability:'support.read'},
      {key:'billing', table:'crm_payments', time:'created_at', capability:'billing.read'},
      {key:'security', table:'security_events', time:'occurred_at', capability:'security.admin'},
    ].filter(source => can(source.capability));
    const results = await Promise.all(sources.map(async source => {
      const {data,error} = await staff.serviceSupabase.from(source.table).select(source.time).order(source.time,{ascending:false}).limit(1);
      return {key:source.key, time:error?undefined:data?.[0]?.[source.time] || null, unavailable:!!error};
    }));
    // Only activity timestamps leave this endpoint; no customers, bodies or actors.
    res.json({activity:Object.fromEntries(results.filter(item => !item.unavailable).map(item => [item.key,item.time])),unavailable:results.filter(item => item.unavailable).map(item => item.key)});
  }));
  return router;
}
export const crmNotificationsRouter = createCrmNotificationsRouter();
