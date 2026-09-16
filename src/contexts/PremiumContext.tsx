import React, { createContext, useContext, useEffect, useState } from 'react';
import { premiumRequest } from '../services/premium';
const Context = createContext({premium:false,loading:true,userId:'',upgrade:()=>{},error:''});
export const usePremium = () => useContext(Context);
export function PremiumProvider({userId,upgrade,children}:{key?:string;userId:string;upgrade:()=>void;children:React.ReactNode}) {
  const [state,setState] = useState({premium:false,loading:true,error:''});
  useEffect(() => {
    let active = true;
    const refresh = () => premiumRequest('access','GET',undefined,userId).then(data => {if(active) setState({premium:data.premium === true,loading:false,error:''});}).catch(() => {if(active) setState({premium:false,loading:false,error:'Unable to verify premium access. Reconnect and try again.'});});
    void refresh(); const timer = window.setInterval(refresh,60000); window.addEventListener('focus',refresh);
    return () => {active=false;clearInterval(timer);window.removeEventListener('focus',refresh);};
  },[userId]);
  return <Context.Provider value={{...state,userId,upgrade}}>{children}</Context.Provider>;
}
export function PremiumGate({title,description,children}:{title:string;description:string;children:React.ReactNode}) {
  const {premium,loading,error,upgrade} = usePremium();
  return <section className="my-5 rounded-2xl border border-violet-200 bg-white p-5 shadow-sm"><div className="mb-3 flex flex-wrap items-center gap-2"><h2 className="text-lg font-bold text-slate-900">{title}</h2><span className="rounded-full bg-violet-100 px-2 py-1 text-xs font-bold text-violet-800">Premium</span></div><p className="mb-4 text-sm text-slate-600">{description}</p>{loading ? <p role="status">Checking access…</p> : premium ? children : <><p role="status" className="text-sm">{error || 'Included with Q Premium.'}</p><button onClick={upgrade} className="mt-3 rounded-xl bg-violet-700 px-4 py-2 font-semibold text-white">Explore Premium</button></>}</section>;
}
