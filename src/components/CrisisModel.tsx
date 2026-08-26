import React, { useEffect, useState } from 'react';
import { ExternalLink, MessageCircle, PhoneCall, ShieldAlert, X } from 'lucide-react';
import { crisisDirectory, globalFallback, supportedCountryCodes } from '../data/crisisHelplines';
import { detectUserCountry } from '../services/localeDetection';

interface Props { isOpen: boolean; onClose: () => void; userProfileCountry?: string; initialCountry?: string; }
const dial = (value: string) => value.replace(/[^0-9+]/g, '');

export const CrisisModal: React.FC<Props> = ({ isOpen, onClose, userProfileCountry, initialCountry }) => {
  const [country, setCountry] = useState(() => detectUserCountry(initialCountry || userProfileCountry));
  useEffect(() => { if (isOpen) setCountry(detectUserCountry(initialCountry || userProfileCountry)); }, [isOpen, initialCountry, userProfileCountry]);
  if (!isOpen) return null;
  const profile = crisisDirectory[country] || globalFallback;
  return <div role="dialog" aria-modal="true" aria-labelledby="crisis-title" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
    <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-slate-900 border border-red-500/40 shadow-2xl text-white">
      <header className="flex items-center justify-between p-5 border-b border-slate-700"><div className="flex items-center gap-3"><ShieldAlert className="w-6 h-6 text-red-400" /><div><h2 id="crisis-title" className="text-xl font-bold text-red-300">Immediate Support & Helplines</h2><p className="text-xs text-slate-400">Stored on this device and available offline</p></div></div><button onClick={onClose} aria-label="Close support window" className="p-2 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button></header>
      <div className="p-5 space-y-4 max-h-[78vh] overflow-y-auto">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm"><label htmlFor="country-select" className="text-slate-300">Showing resources for:</label><select id="country-select" value={country} onChange={e => setCountry(e.target.value)} className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white">{supportedCountryCodes.map(code => <option key={code} value={code}>{crisisDirectory[code].countryName}</option>)}</select></div>
        {profile.emergencyNumber && <div className="p-4 bg-red-950/50 border border-red-700/60 rounded-xl flex gap-3 justify-between items-center"><div><p className="font-semibold text-red-100">Immediate physical danger</p><p className="text-xs text-red-300">Call local emergency services</p></div><a href={`tel:${profile.emergencyNumber}`} className="px-4 py-2 bg-red-600 hover:bg-red-500 font-bold rounded-lg">Call {profile.emergencyNumber}</a></div>}
        <p className="text-xs text-slate-400">Hours and availability can change. If one service is unavailable, try another or use an international directory.</p>
        <div className="space-y-3">{profile.resources.map(item => <article key={item.name} className="bg-slate-800/80 p-4 rounded-xl border border-slate-700"><div className="flex flex-col sm:flex-row sm:justify-between gap-3"><div><h3 className="font-semibold">{item.name}</h3><p className="text-xs text-slate-400">{item.hours}</p></div><div className="flex flex-wrap gap-2">{item.phone && <a href={`tel:${dial(item.phone)}`} className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold rounded-lg"><PhoneCall className="w-3.5 h-3.5" />Call</a>}{item.sms && <a href={`sms:${dial(item.sms)}${item.smsBody ? `?body=${encodeURIComponent(item.smsBody)}` : ''}`} className="inline-flex items-center gap-1.5 px-3 py-2 bg-teal-600 hover:bg-teal-500 text-xs font-semibold rounded-lg"><MessageCircle className="w-3.5 h-3.5" />Text</a>}{item.chatUrl && <a href={item.chatUrl} target="_blank" rel="noopener noreferrer" className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-xs font-semibold rounded-lg">Chat</a>}{item.url && <a href={item.url} target="_blank" rel="noopener noreferrer" aria-label={`Visit ${item.name}`} className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg"><ExternalLink className="w-4 h-4" /></a>}</div></div></article>)}</div>
      </div>
    </div>
  </div>;
};
