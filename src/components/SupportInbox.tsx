import React, {useState} from 'react';
import SupportRequests from './SupportRequests';
import {supportApi} from '../services/support';
export default function SupportInbox() {
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 async function cleanup(){setBusy(true);try{await supportApi('/staff/attachments/cleanup',{method:'POST'});setNotice('Queued file cleanup completed.');}catch(e){setNotice((e as Error).message);}finally{setBusy(false);}}
 return <div className="mt-6"><SupportRequests staff/><div className="mt-4 text-sm text-white"><button disabled={busy} onClick={()=>void cleanup()} className="rounded-xl border border-white/20 px-3 py-2 disabled:opacity-50">{busy?'Cleaning files…':'Retry queued file cleanup'}</button><p className="mt-2">Removes files queued after request deletion and incomplete uploads older than 24 hours.</p>{notice&&<p role="status">{notice}</p>}</div></div>;
}
