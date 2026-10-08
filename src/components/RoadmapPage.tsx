import React, { useEffect } from 'react';
import RoadmapBoard from './RoadmapBoard';
import { LegalFooter } from './LegalFooter';

export default function RoadmapPage() {
  useEffect(()=>{const previous=document.title;document.title='Q product roadmap';return()=>{document.title=previous;};},[]);
  return <div className="min-h-screen bg-violet-50 text-slate-900"><main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6"><nav aria-label="Roadmap navigation" className="flex flex-wrap gap-4 text-sm font-semibold text-violet-700"><a href="/" className="underline">Q home</a><a href="/app?tab=help" className="underline">Suggest an improvement in Q</a></nav><RoadmapBoard /></main><LegalFooter /></div>;
}
