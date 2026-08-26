import React, { useEffect, useRef } from 'react';
import { triggerQuickExit } from '../services/stealthService';
export const QuickExitButton: React.FC = () => {
  const lastEscape = useRef(0);
  useEffect(() => { const onKeyDown = (event: KeyboardEvent) => { if (event.key !== 'Escape') return; const now = Date.now(); if (now - lastEscape.current <= 500) triggerQuickExit(); lastEscape.current = now; }; window.addEventListener('keydown', onKeyDown); return () => window.removeEventListener('keydown', onKeyDown); }, []);
  return <button type="button" onClick={triggerQuickExit} title="Quick Exit (press Escape twice)" aria-label="Quick Exit" className="fixed top-3 right-3 z-[100] flex items-center gap-1.5 px-3 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold text-xs rounded-full shadow-lg active:scale-95"><span className="h-2 w-2 rounded-full bg-white" />Quick Exit <kbd className="hidden sm:inline ml-1 px-1 py-0.5 bg-red-800 rounded text-[10px]">Esc ×2</kbd></button>;
};
