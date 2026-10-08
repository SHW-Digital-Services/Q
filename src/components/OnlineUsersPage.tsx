import React, { useState } from 'react';
import { ArrowLeft, LogOut, Mail, RefreshCw, Search, Users } from 'lucide-react';
import { useOnlinePresence, type PresenceState } from '../contexts/OnlinePresenceContext';
import type { OnlineRole } from '../shared/onlinePresence';

const roleLabels: Record<OnlineRole, string> = { customer: 'Customer', staff: 'Staff', admin: 'Admin' };
const control = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10';

export default function OnlineUsersPage({ onSignOut }: { onSignOut: () => Promise<void> }) {
  const presence = useOnlinePresence();
  return <OnlineUsersView presence={presence} onSignOut={onSignOut} />;
}

export function OnlineUsersView({ presence, onSignOut }: { presence: PresenceState; onSignOut: () => Promise<void> }) {
  const { users, role, message, connected, retry } = presence;
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | OnlineRole>('all');
  const [signOutError, setSignOutError] = useState('');
  const visible = users.filter(user => (role === 'admin' || user.role === 'customer') &&
    (role !== 'admin' || filter === 'all' || user.role === filter) && user.display_name.toLowerCase().includes(query.trim().toLowerCase()));

  return <main className="w-full min-w-0 text-slate-100">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-sm font-semibold text-purple-300">Q Customer Operations</p><h1 className="mt-2 flex items-center gap-3 text-2xl font-bold"><Users className="h-7 w-7 text-emerald-300" />Online Users</h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">{role === 'admin' ? 'See customers, Staff and Admins currently connected to Q.' : 'See customers currently connected to Q.'}</p></div>

    </header>
    {signOutError && <p role="alert" className="mt-4 text-sm text-rose-300">{signOutError}</p>}
    <section aria-labelledby="online-heading" className="mt-8 rounded-3xl border border-white/10 bg-slate-900/70 p-5 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-4"><div><h2 id="online-heading" className="text-lg font-bold">{role === 'admin' ? 'Online' : 'Customers online'}{connected ? ` (${users.length})` : ''}</h2>
        <p role="status" className={`mt-2 flex items-center gap-2 text-sm ${connected ? 'text-emerald-300' : 'text-slate-400'}`}><span className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-slate-500'}`} />{connected ? 'Live updates connected' : message}</p></div>
        <button type="button" onClick={retry} className={control}><RefreshCw className="h-4 w-4" />Reconnect</button></div>
      {connected && <>
        <div className="mt-6 flex flex-wrap gap-3"><label className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border border-white/10 bg-slate-950 px-3"><Search className="h-4 w-4 shrink-0 text-slate-400" /><span className="sr-only">Search online users</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search names…" className="min-w-0 flex-1 bg-transparent py-3 text-sm text-white outline-none" /></label>
          {role === 'admin' && <label className="flex items-center gap-2 text-sm text-slate-300"><span>Show</span><select value={filter} onChange={event => setFilter(event.target.value as typeof filter)} className="min-h-11 rounded-xl border border-white/10 bg-slate-950 px-3 text-white"><option value="all">Everyone</option><option value="customer">Customers</option><option value="staff">Staff</option><option value="admin">Admins</option></select></label>}</div>
        <p className="mt-4 text-xs text-slate-400">Showing {visible.length} of {users.length}. Each account is counted once across multiple tabs or devices.</p>
        {visible.length ? <ul className="mt-4 grid gap-3 sm:grid-cols-2">{visible.map(user => <li key={user.user_id} className="flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/70 p-4"><div className="flex min-w-0 items-center gap-3"><span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-500/15 font-bold text-purple-200">{user.display_name.slice(0, 1).toUpperCase()}</span><div className="min-w-0"><p className="break-words font-semibold text-white">{user.display_name}</p><p className="mt-1 text-xs text-emerald-300">Online</p></div></div>{role === 'admin' && <span className="shrink-0 rounded-lg border border-white/10 px-2 py-1 text-xs text-slate-300">{roleLabels[user.role]}</span>}</li>)}</ul> : <p className="mt-6 rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-400">{users.length ? 'No online users match your search or filter.' : role === 'admin' ? 'No one is online.' : 'No customers are online.'}</p>}
      </>}
      <p className="mt-6 border-t border-white/10 pt-4 text-xs leading-5 text-slate-500">Online means a signed-in Q session is connected. It does not confirm someone is actively using the screen. Status may take a short time to update after a connection is lost.</p>
    </section>
  </main>;
}
