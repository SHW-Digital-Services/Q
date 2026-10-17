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
      {key:'ticket', table:'contact_requests', time:'created_at', capability:'support.read'},
      {key:'roadmap', table:'feedback_roadmap', time:'created_at', capability:'support.read'},
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
