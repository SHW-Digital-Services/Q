import express from 'express';
import {getServiceSupabase,requireStaff} from './admin.js';
import {asyncHandler} from '../middleware.js';
import {boundedString,isUuid,requireExactObject} from '../security.js';
export function createHelpCentreRouter(db=getServiceSupabase,staffAccess=requireStaff){
 const router=express.Router();router.use((_req,res,next)=>{res.setHeader('Cache-Control','no-store');next();});
 router.get('/articles',asyncHandler(async(_req,res)=>{const client=db();if(!client)return res.status(503).json({error:'Help centre is temporarily unavailable.'});const {data,error}=await client.from('help_articles').select('id,publication,published_at').not('publication','is',null).eq('archived',false).order('published_at',{ascending:false}).order('id').limit(200);if(error)return res.status(503).json({error:'Unable to load help articles.'});res.json((data||[]).map((item:any)=>({id:item.id,...item.publication,published_at:item.published_at})));}));
 router.use('/staff',asyncHandler(async(req,res,next)=>{const staff=await staffAccess(req,res);if(!staff)return;const permission=req.method==='GET'?'support.read':'support.write';if(staff.role!=='partner_admin'&&staff.permissions.length&&!staff.permissions.includes(permission))return res.status(403).json({error:'Help centre permission required.'});res.locals.staff=staff;next();}));
 router.get('/staff/articles',asyncHandler(async(_req,res)=>{const{data,error}=await res.locals.staff.serviceSupabase.from('help_articles').select('*').order('updated_at',{ascending:false}).limit(200);if(error)return res.status(503).json({error:'Unable to load help drafts.'});res.json(data||[]);}));
 router.post('/staff/articles/:id',asyncHandler(async(req,res)=>{
  if(!isUuid(req.params.id)||!requireExactObject(req.body,['action','revision','content'])||!['save','publish','unpublish','archive','restore'].includes(req.body.action)||!Number.isSafeInteger(req.body.revision)||req.body.revision<0)return res.status(400).json({error:'Invalid help article action.'});
  let content:any=null;
  if(req.body.action==='save'){
   if(!requireExactObject(req.body.content,['title','category','summary','body','kind']))return res.status(400).json({error:'Invalid article details.'});content={};
   for(const [key,min,max]of [['title',3,160],['category',1,80],['summary',10,500],['body',10,12000]] as const){content[key]=boundedString(req.body.content[key],max,true);if(!content[key]||content[key].length<min)return res.status(400).json({error:`Check the article ${key}.`});}
   content.kind=req.body.content.kind;if(!['guide','faq'].includes(content.kind))return res.status(400).json({error:'Choose guide or FAQ.'});
  }
  const{data,error}=await res.locals.staff.serviceSupabase.rpc('change_help_article',{p_id:req.params.id,p_actor:res.locals.staff.identity.user.id,p_action:req.body.action,p_revision:req.body.revision,p_content:content});
  if(error){const message=String(error.message);return res.status(message.includes('HELP_STALE')||message.includes('HELP_ARCHIVED')?409:message.includes('HELP_NOT_FOUND')?404:503).json({error:message.includes('HELP_STALE')?'Another staff member changed this article. Refresh and compare before saving. Your draft is retained.':'Unable to change this help article.'});}res.json(data);
 }));return router;
}
export const helpCentreRouter=createHelpCentreRouter();
