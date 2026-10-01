import React, { createContext, useContext, useEffect, useState } from 'react';

const CrmDraftContext = createContext('');
export const CRM_DRAFT_PREFIX = 'q-crm-draft-v1:';

export function clearCrmDrafts(userId: string) {
  try {
    const prefix = `${CRM_DRAFT_PREFIX}${userId}:`;
    Object.keys(sessionStorage).filter(key => key.startsWith(prefix)).forEach(key => sessionStorage.removeItem(key));
  } catch { /* Storage may be unavailable. */ }
}

export function CrmDraftProvider({ userId, children }: { userId: string; children: React.ReactNode }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const fail = () => setFailed(true);
    window.addEventListener('q-crm-draft-error', fail);
    return () => window.removeEventListener('q-crm-draft-error', fail);
  }, []);
  return <CrmDraftContext.Provider value={userId}>
    {failed && <p role="alert" className="bg-amber-950 p-3 text-sm text-amber-100">Your browser could not save draft recovery. Keep this page open until you save or send your work.</p>}
    {children}
  </CrmDraftContext.Provider>;
}

export function useCrmDraftUser() { return useContext(CrmDraftContext); }
