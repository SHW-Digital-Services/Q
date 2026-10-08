import React,{useEffect} from 'react';
import HelpCentre from './HelpCentre';
import {LegalFooter} from './LegalFooter';
export default function HelpCentrePage(){useEffect(()=>{const old=document.title;document.title='Q Help centre';return()=>{document.title=old;};},[]);return <><main className="mx-auto max-w-4xl space-y-6 p-5 sm:p-8"><nav className="flex gap-4 text-sm text-violet-700 underline"><a href="/">Q home</a><a href="/app?tab=help">My support requests</a><a href="/support">Guest request access</a></nav><h1 className="text-3xl font-bold text-slate-950">Q Help &amp; Support</h1><HelpCentre/></main><LegalFooter/></>;}
