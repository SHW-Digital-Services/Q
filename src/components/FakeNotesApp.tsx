import React, { useRef, useState } from 'react';
import { ArrowLeft, FileText, Plus } from 'lucide-react';

interface Props { onUnlock: () => void; requiredPin?: string; }
const initialNotes = [
  { id: 1, title: 'Weekly Grocery List', text: '• Oat milk\n• Eggs\n• Wholewheat bread\n• Apples\n• Coffee beans' },
  { id: 2, title: 'Meeting Takeaways', text: 'Follow up with the team regarding project timelines for Q3.' },
  { id: 3, title: 'Book Recommendations', text: '1. Atomic Habits\n2. Thinking, Fast and Slow' }
];
export const FakeNotesApp: React.FC<Props> = ({ onUnlock, requiredPin }) => {
  const [notes, setNotes] = useState(initialNotes); const [selectedId, setSelectedId] = useState(1); const [showUnlock, setShowUnlock] = useState(false); const [pin, setPin] = useState(''); const [error, setError] = useState(false); const clicks = useRef<number[]>([]);
  const active = notes.find(note => note.id === selectedId) || notes[0];
  const requestReturn = () => { if (requiredPin) { setError(false); setShowUnlock(true); } else onUnlock(); };
  const hiddenUnlock = () => { const now = Date.now(); clicks.current = [...clicks.current.filter(time => now - time < 1200), now]; if (clicks.current.length >= 4) { clicks.current = []; requestReturn(); } };
  const update = (change: Partial<typeof active>) => setNotes(current => current.map(note => note.id === selectedId ? { ...note, ...change } : note));
  const addNote = () => { const next = { id: Date.now(), title: 'Untitled Note', text: '' }; setNotes(current => [next, ...current]); setSelectedId(next.id); };
  return <div className="h-screen w-screen bg-slate-100 text-slate-800 flex font-sans antialiased">
    <aside className="w-36 sm:w-64 bg-slate-200 border-r border-slate-300 flex flex-col p-3 sm:p-4"><button type="button" onClick={hiddenUnlock} className="flex items-center gap-2 mb-6 text-left select-none"><span className="w-7 h-7 bg-slate-500 rounded flex items-center justify-center text-white"><FileText className="w-4 h-4" /></span><span className="font-semibold text-slate-700">QuickNotes</span></button><button onClick={addNote} className="flex items-center gap-1 w-full py-2 px-3 bg-white border border-slate-300 rounded shadow-sm text-sm mb-4 hover:bg-slate-50"><Plus className="w-4 h-4" />New Note</button><nav className="flex-1 space-y-1 overflow-y-auto">{notes.map(note => <button key={note.id} onClick={() => setSelectedId(note.id)} className={`w-full text-left px-3 py-2 rounded text-sm truncate ${selectedId === note.id ? 'bg-slate-300 font-medium' : 'text-slate-600 hover:bg-slate-300/60'}`}>{note.title || 'Untitled Note'}</button>)}</nav><button type="button" onClick={requestReturn} title="Back" aria-label="Return to previous app" className="mt-4 flex items-center gap-1.5 self-start rounded-lg px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-300/70 hover:text-slate-700"><ArrowLeft className="h-3.5 w-3.5" /><span>Back</span></button></aside>
    <main className="flex-1 flex flex-col bg-white p-6 sm:p-8"><input value={active.title} onChange={e => update({ title: e.target.value })} className="text-2xl font-bold outline-none mb-4 w-full" /><textarea value={active.text} onChange={e => update({ text: e.target.value })} className="flex-1 w-full resize-none outline-none text-slate-700 leading-relaxed" placeholder="Start typing your note..." /></main>
    {showUnlock && <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center"><form onSubmit={e => { e.preventDefault(); if (pin === requiredPin) onUnlock(); else { setPin(''); setError(true); } }} className="w-72 bg-white rounded-xl shadow-xl p-5"><h2 className="font-semibold mb-2">Unlock protected notes</h2><p className="text-xs text-slate-500 mb-3">Enter your 4-digit PIN.</p><input autoFocus inputMode="numeric" maxLength={4} type="password" value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))} className="w-full border rounded-lg p-2" />{error && <p className="text-xs text-red-600 mt-2">Incorrect PIN.</p>}<div className="flex justify-end gap-2 mt-4"><button type="button" onClick={() => { setShowUnlock(false); setPin(''); }} className="px-3 py-2 text-sm">Cancel</button><button className="px-3 py-2 bg-slate-700 text-white rounded-lg text-sm">Unlock</button></div></form></div>}
  </div>;
};
