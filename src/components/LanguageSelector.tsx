import React from 'react';
import { Languages } from 'lucide-react';
import { supportedLanguages, useLanguage, type LanguageCode } from '../contexts/LanguageContext';

export const LanguageSelector: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { language, setLanguage, t } = useLanguage();
  return <label className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-violet-200 bg-white/95 px-2.5 text-xs font-bold text-slate-700 shadow-sm backdrop-blur">
    <Languages className="h-4 w-4 text-violet-600" aria-hidden="true" />
    {!compact && <span>{t('language')}</span>}
    <select aria-label={t('language')} value={language} onChange={event => setLanguage(event.target.value as LanguageCode)} className="max-w-28 bg-transparent py-2 outline-none">
      {Object.entries(supportedLanguages).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
    </select>
  </label>;
};
