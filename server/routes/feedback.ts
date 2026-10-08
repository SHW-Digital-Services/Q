import express from 'express';
import { asyncHandler, getAuthenticatedUser, getCanonicalAppUrl } from '../middleware.js';
import { getServiceSupabase, requireStaff } from './admin.js';
import { boundedString, isUuid, requireExactObject } from '../security.js';
import { allowedMailOrigin } from '../zohoMail.js';
import { feedbackReviewStates, roadmapStatuses } from '../../src/shared/feedback.js';

type Dependencies = { db: () => any; authenticate: typeof getAuthenticatedUser; staff: typeof requireStaff; origin: typeof getCanonicalAppUrl };
const publicFields = 'id,published_title,published_summary,published_status,published_at';
const publicItem = (item: any) => ({ id: item.id, title: item.published_title, summary: item.published_summary, status: item.published_status, published_at: item.published_at });
const revision = (value: unknown, allowZero = false) => Number.isSafeInteger(value) && Number(value) >= (allowZero ? 0 : 1);

export function createFeedbackRouter(deps: Dependencies) {
  const router = express.Router();
  router.use((_req,res,next) => { res.setHeader('Cache-Control','no-store, private'); next(); });
  router.use((_req,res,next) => { const db=deps.db(); if(!db)return res.status(503).json({error:'Feedback and the roadmap are temporarily unavailable.'});res.locals.db=db;next(); });
  router.use((req,res,next) => {
    if(req.method!=='GET' && req.headers.origin && !allowedMailOrigin(req.headers.origin,deps.origin()))return res.status(403).json({error:'Open feedback on Q’s configured site address.'});next();
  });
  function failure(res: express.Response,error:any) {
    const message=String(error?.message||'');
    if(message.includes('FEEDBACK_NOT_FOUND'))return res.status(404).json({error:'Suggestion or roadmap item not found.'});
    if(message.includes('FEEDBACK_STALE'))return res.status(409).json({error:'Another staff member changed this item. Refresh it before saving. Your draft is still available.',code:'FEEDBACK_STALE'});
    if(message.includes('FEEDBACK_CONFLICT'))return res.status(409).json({error:'This submission identifier was already used with different details.',code:'FEEDBACK_CONFLICT'});
    if(message.includes('FEEDBACK_RATE_LIMIT')){res.setHeader('Retry-After','300');return res.status(429).json({error:'Please wait five minutes before submitting another suggestion. Your draft is still available.'});}
    if(message.includes('FEEDBACK_ARCHIVED'))return res.status(409).json({error:'Restore this archived item before editing, grouping or publishing it.'});
    if(message.includes('FEEDBACK_INVALID') || error?.code==='23514')return res.status(400).json({error:'Check the feedback or roadmap details.'});
    return res.status(503).json({error:'Unable to save or load feedback. Please try again.',code:'FEEDBACK_UNAVAILABLE'});
  }
  async function account(req: express.Request,res: express.Response) {
    const identity=await deps.authenticate(req);
    if(!identity || identity.user.is_anonymous || !identity.user.email_confirmed_at){res.status(401).json({error:'Sign in with a verified Q account to suggest an improvement.'});return null;}
    return identity;
  }
  const publishedQuery = (res: express.Response) => res.locals.db.from('feedback_roadmap').select(publicFields).eq('published',true).is('archived_at',null);

  router.get('/roadmap',asyncHandler(async(req,res) => {
    const status=String(req.query.status||'');
    if(status && !roadmapStatuses.includes(status as any))return res.status(400).json({error:'Choose a valid roadmap status.'});
    let query=publishedQuery(res);if(status)query=query.eq('published_status',status);
    const {data,error}=await query.order('published_at',{ascending:false}).order('id').limit(200);
    if(error)return failure(res,error);
    return res.json((data||[]).map(publicItem));
  }));
  router.get('/suggestions',asyncHandler(async(req,res) => {
    const identity=await account(req,res);if(!identity)return;
    const {data,error}=await res.locals.db.from('feedback_suggestions').select('id,title,details,review_state,archived_at,created_at,updated_at,roadmap_id').eq('user_id',identity.user.id).order('created_at',{ascending:false}).order('id').limit(200);
    if(error)return failure(res,error);
    const ids=[...new Set((data||[]).map((row:any)=>row.roadmap_id).filter(Boolean))];
    const linked=ids.length?await publishedQuery(res).in('id',ids):{data:[],error:null};
    if(linked.error)return failure(res,linked.error);
    const roadmap=new Map((linked.data||[]).map((row:any)=>[row.id,publicItem(row)]));
    // Never return a draft roadmap ID or its internal status to a submitter.
    return res.json((data||[]).map(({roadmap_id,...suggestion}:any)=>({...suggestion,roadmap:roadmap.get(roadmap_id)||null})));
  }));
  router.post('/suggestions',asyncHandler(async(req,res) => {
    const identity=await account(req,res);if(!identity)return;
    if(!requireExactObject(req.body,['id','title','details']) || !isUuid(req.body.id))return res.status(400).json({error:'Invalid suggestion details.'});
    const title=boundedString(req.body.title,160,true),details=boundedString(req.body.details,5000,true);
    if(!title || title.length<3 || !details || details.length<10)return res.status(400).json({error:'Enter a title of 3–160 characters and details of 10–5,000 characters.'});
    const {data,error}=await res.locals.db.rpc('submit_feedback',{p_id:req.body.id,p_user_id:identity.user.id,p_title:title,p_details:details});
    if(error)return failure(res,error);return res.status(201).json(data);
  }));
  router.use('/staff',asyncHandler(async(req,res,next) => {
    const staff=await deps.staff(req,res);if(!staff)return;
    const capability=req.method==='GET'?'support.read':'support.write';
    if(staff.role!=='partner_admin' && staff.permissions.length && !staff.permissions.includes(capability))return res.status(403).json({error:'This staff feedback permission is required.'});
    res.locals.staff=staff;next();
  }));
  router.get('/staff/suggestions',asyncHandler(async(req,res) => {
    const state=String(req.query.state||''), archived=String(req.query.archived||'false'), roadmapId=String(req.query.roadmap||'');
    if((state && !feedbackReviewStates.includes(state as any)) || !['false','true'].includes(archived) || (roadmapId && roadmapId!=='unlinked' && !isUuid(roadmapId)))return res.status(400).json({error:'Invalid suggestion filters.'});
    let query=res.locals.db.from('feedback_suggestions').select('*');
    query=archived==='true'?query.not('archived_at','is',null):query.is('archived_at',null);
    if(state)query=query.eq('review_state',state);
    if(roadmapId)query=roadmapId==='unlinked'?query.is('roadmap_id',null):query.eq('roadmap_id',roadmapId);
    const {data,error}=await query.order('created_at',{ascending:false}).order('id').limit(200);
    if(error)return failure(res,error);return res.json(data||[]);
  }));
  router.post('/staff/suggestions/review',asyncHandler(async(req,res) => {
    if(!requireExactObject(req.body,['changes','action','roadmapId']) || !['group','review','archive','restore'].includes(req.body.action) || !Array.isArray(req.body.changes) || req.body.changes.length<1 || req.body.changes.length>100)return res.status(400).json({error:'Choose 1–100 suggestions and a review action.'});
    if(req.body.changes.some((change:any)=>!requireExactObject(change,['id','revision']) || !isUuid(change.id) || !revision(change.revision)) || new Set(req.body.changes.map((change:any)=>change.id)).size!==req.body.changes.length)return res.status(400).json({error:'Invalid or duplicate suggestion selections.'});
    if(req.body.action==='group' && req.body.roadmapId!==null && !isUuid(req.body.roadmapId))return res.status(400).json({error:'Choose a roadmap item or unlink the suggestions.'});
    const {data,error}=await res.locals.db.rpc('review_feedback',{p_changes:req.body.changes,p_actor_id:res.locals.staff.identity.user.id,p_action:req.body.action,p_roadmap_id:req.body.action==='group'?req.body.roadmapId:null});
    if(error)return failure(res,error);return res.json({changed:data});
  }));
  router.get('/staff/roadmap',asyncHandler(async(_req,res) => {
    const {data,error}=await res.locals.db.from('feedback_roadmap').select('*').order('updated_at',{ascending:false}).order('id').limit(200);
    if(error)return failure(res,error);return res.json(data||[]);
  }));
  router.get('/staff/roadmap/:id',asyncHandler(async(req,res) => {
    if(!isUuid(req.params.id))return res.status(400).json({error:'Invalid roadmap item.'});
    const [item,events]=await Promise.all([
      res.locals.db.from('feedback_roadmap').select('*').eq('id',req.params.id).maybeSingle(),
      res.locals.db.from('feedback_events').select('id,actor_id,action,revision,created_at').eq('roadmap_id',req.params.id).order('created_at').order('id')
    ]);
    if(item.error || events.error)return failure(res,item.error||events.error);
    if(!item.data)return res.status(404).json({error:'Roadmap item not found.'});
    return res.json({item:item.data,events:events.data||[]});
  }));
  async function save(req: express.Request,res: express.Response,creating: boolean) {
    const action=creating?'save':req.body?.action;
    if(!requireExactObject(req.body,creating?['id','title','summary','status']:action==='save'?['action','revision','title','summary','status']:['action','revision']) || !['save','publish','unpublish','archive','restore'].includes(action))return res.status(400).json({error:'Invalid roadmap action.'});
    const id=creating?req.body.id:req.params.id;
    if(!isUuid(id) || (!creating && !revision(req.body.revision)))return res.status(400).json({error:'Refresh and choose a valid roadmap item.'});
    let title:string|null=null,summary:string|null=null,status:string|null=null;
    if(action==='save') {
      title=boundedString(req.body.title,160,true);summary=boundedString(req.body.summary,3000,true);status=req.body.status;
      if(!title || title.length<3 || !summary || summary.length<10 || !roadmapStatuses.includes(status as any))return res.status(400).json({error:'Enter a public title of 3–160 characters, summary of 10–3,000 characters and a status.'});
    }
    const {data,error}=await res.locals.db.rpc('change_feedback_roadmap',{p_id:id,p_actor_id:res.locals.staff.identity.user.id,p_action:action,p_expected_revision:creating?0:req.body.revision,p_title:title,p_summary:summary,p_status:status});
    if(error)return failure(res,error);return res.status(creating?201:200).json(data);
  }
  router.post('/staff/roadmap',asyncHandler(async(req,res)=>save(req,res,true)));
  router.patch('/staff/roadmap/:id',asyncHandler(async(req,res)=>save(req,res,false)));
  return router;
}
export const feedbackRouter=createFeedbackRouter({db:getServiceSupabase,authenticate:getAuthenticatedUser,staff:requireStaff,origin:getCanonicalAppUrl});
