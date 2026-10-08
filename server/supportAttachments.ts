import {TextDecoder} from 'node:util';
export const supportAttachmentLimit=2*1024*1024;
export function attachmentType(bytes:Buffer):string|null{
 if(!bytes.length||bytes.length>supportAttachmentLimit)return null;
 if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return'image/png';
 if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return'image/jpeg';
 if(bytes.subarray(0,5).toString()==='%PDF-')return'application/pdf';
 try{const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);if(!/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(text)&&!/^\s*(<|\{\s*")/.test(text))return'text/plain';}catch{}
 return null;
}
export const attachmentColumns='id,name,mime,size,internal,created_at';
export async function cleanupSupportFiles(db:any){
 const cutoff=new Date(Date.now()-86400000).toISOString();
 const stale=await db.from('support_attachments').delete().eq('status','pending').lt('created_at',cutoff);if(stale.error)throw new Error('Cleanup unavailable');
 const pending=await db.from('support_storage_cleanup').select('object_path').order('created_at').limit(50);if(pending.error)throw new Error('Cleanup unavailable');
 const paths=(pending.data||[]).map((row:any)=>row.object_path);if(!paths.length)return 0;
 const removed=await db.storage.from('q-support-private').remove(paths);if(removed.error)throw new Error('Storage cleanup unavailable');
 const cleared=await db.from('support_storage_cleanup').delete().in('object_path',paths);if(cleared.error)throw new Error('Cleanup acknowledgement unavailable');return paths.length;
}
