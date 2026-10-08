import {mailId,ZohoMailClient} from './zohoMail.js';
export const mailAddresses=(value:unknown)=>(String(value||'').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').match(/[a-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-z0-9.-]+/gi)||[]).map(email=>email.toLowerCase());
export async function logCustomerOfficeEmail(db:any,user:{id:string;email:string},account:string,message:any,inbound:boolean){
 const time=Number(message.receivedTime||message.receivedtime||message.sentDateInGMT);const received=Number.isFinite(time)&&time>0?new Date(time).toISOString():null;
 const{error}=await db.rpc('log_office_customer_email',{p_user:user.id,p_email:user.email.toLowerCase(),p_inbound:inbound,p_account:mailId(account),p_folder:mailId(message.folderId),p_message:mailId(message.messageId),p_subject:String(message.subject||'Customer email').slice(0,160),p_received:received});if(error)throw new Error('Customer email logging is temporarily unavailable. Retry to finish linking tickets.');
}
export async function syncOfficeEmailTickets(db:any,client:ZohoMailClient,account:string,start=1){
 const users=new Map<string,{id:string;email:string}>();let page=1;
 for(;page<=10;page++){const{data,error}=await db.auth.admin.listUsers({page,perPage:1000});if(error)throw Error('Customer identities could not be loaded.');for(const user of data.users||[])if(user.email&&user.email_confirmed_at){const email=user.email.toLowerCase();if(users.has(email))throw Error('Customer email identity is ambiguous.');users.set(email,{id:user.id,email});}if((data.users||[]).length<1000)break;}if(page>10)throw Error('Customer directory exceeds the email sync limit.');
 const folders=await client.json(`/accounts/${mailId(account)}/folders`);if(!Array.isArray(folders))throw Error('Unable to load office folders.');
 const included=folders.filter(f=>!['drafts','outbox','templates','trash','spam','junk'].includes(String(f.folderType||'').toLowerCase())&&!['drafts','outbox','templates','trash','spam','junk'].includes(String(f.folderName||'').toLowerCase()));
 let logged=0,hasMore=false;
 for(const folder of included){for(const offset of start===1?[1]:[1,start]){const folderId=mailId(folder.folderId);const query=new URLSearchParams({folderId,start:String(offset),limit:'30',includeto:'true'});const messages=await client.json(`/accounts/${mailId(account)}/messages/view?${query}`);if(!Array.isArray(messages))throw Error('Unable to read office emails.');if(offset===start)hasMore ||= messages.length===30;
 for(const message of messages){const from=mailAddresses(message.fromAddress),recipients=mailAddresses([message.toAddress,message.ccAddress,message.bccAddress].filter(Boolean).join(','));const inbound=String(folder.folderType).toLowerCase()!=='sent'&&!from.includes('office@q-ai.online');const matches=inbound?from:from.includes('office@q-ai.online')?recipients:[];
 for(const email of new Set(matches)){const user=users.get(email);if(!user)continue;await logCustomerOfficeEmail(db,user,account,{...message,folderId:message.folderId||folderId},inbound);logged++;}}
 }}
 return{logged,hasMore,nextStart:hasMore?start+30:1};
}
