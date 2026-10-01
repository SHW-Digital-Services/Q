import React, { createContext, useContext, useEffect, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabaseClient } from '../services/supabase';
import { presenceTickets, type OnlineRole, type OnlineUser, type PresenceAccess } from '../shared/onlinePresence';

export type PresenceState = { users: OnlineUser[]; role: OnlineRole | null; message: string; connected: boolean; retry: () => void };
const OnlinePresenceContext = createContext<PresenceState>({ users: [], role: null, message: 'Connecting…', connected: false, retry: () => {} });
export const useOnlinePresence = () => useContext(OnlinePresenceContext);

export function OnlinePresenceProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<Omit<PresenceState, 'retry'>>({ users: [], role: null, message: 'Connecting…', connected: false });
  const viewing = ['/crm/online', '/admin/crm/online'].includes(window.location.pathname);

  useEffect(() => {
    const client = getSupabaseClient(); if (!client) return;
    let active = true;
    const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
      if (active) setUserId(session?.user.id ?? null);
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    const client = getSupabaseClient();
    if (!client || !userId) {
      setState({ users: [], role: null, message: 'Please sign in to see who is online.', connected: false });
      return;
    }
    let cancelled = false; let access: PresenceAccess | null = null;
    let publish: RealtimeChannel | null = null;
    let renewal: number | undefined; let refreshTimer: number | undefined; let debounce: number | undefined;
    let resolving = false; let resolveAgain = false; let renewing = false;
    const channels = new Map<string, RealtimeChannel>();
    const ready = new Set<string>();
    const controller = new AbortController();
    setState({ users: [], role: null, message: 'Connecting…', connected: false });

    const fail = (message: string) => { if (!cancelled) setState(previous => ({ ...previous, users: [], message, connected: false })); };
    async function request<T>(path: string, tickets?: string[]): Promise<T> {
      const { data, error } = await client!.auth.getSession();
      if (cancelled) throw new Error('Connection closed.');
      if (error || data.session?.user.id !== userId) throw new Error('Please sign in again to use online status.');
      const response = await fetch(`/api/presence/${path}`, {
        method: tickets ? 'POST' : 'GET', cache: 'no-store', signal: controller.signal,
        headers: { Authorization: `Bearer ${data.session.access_token}`, ...(tickets ? { 'Content-Type': 'application/json' } : {}) },
        ...(tickets ? { body: JSON.stringify({ tickets }) } : {}),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not connect to online status.');
      return result;
    }

    async function resolveUsers() {
      if (cancelled || !access || !viewing || !access.readTopics.every(topic => ready.has(topic))) return;
      if (resolving) { resolveAgain = true; return; }
      resolving = true;
      try {
        const tickets = presenceTickets(access.readTopics.map(topic => channels.get(topic)!.presenceState()));
        const users = new Map<string, OnlineUser>();
        // Keep every request below the API body limit, even with many online tabs.
        for (let offset = 0; offset < tickets.length; offset += 75) {
          const result = await request<{ users: OnlineUser[] }>('resolve', tickets.slice(offset, offset + 75));
          for (const user of result.users) users.set(user.user_id, user);
        }
        if (!cancelled && access.readTopics.every(topic => ready.has(topic))) setState({
          users: [...users.values()].sort((a, b) => a.display_name.localeCompare(b.display_name)),
          role: access.role, message: '', connected: true,
        });
      } catch (error) { fail(error instanceof Error ? error.message : 'Could not load online users.'); }
      finally {
        resolving = false;
        if (resolveAgain && !cancelled) { resolveAgain = false; scheduleResolve(); }
      }
    }
    function scheduleResolve() {
      window.clearTimeout(debounce);
      debounce = window.setTimeout(() => void resolveUsers(), 150);
    }
    async function track() {
      if (!publish || !access || cancelled || !ready.has(access.publishTopic)) return;
      try {
        const status = await publish.track({ ticket: access.ticket });
        if (status !== 'ok') fail('Could not publish online status. Select Reconnect to try again.');
      } catch { fail('Could not publish online status. Select Reconnect to try again.'); }
    }
    async function renew() {
      if (cancelled || renewing) return;
      renewing = true;
      try {
        const next = await request<PresenceAccess>('me');
        if (cancelled) return;
        if (next.role !== access?.role || next.user_id !== access?.user_id) {
          setRevision(value => value + 1); return;
        }
        access = next;
        await track();
        scheduleResolve();
      } catch (error) {
        fail(error instanceof Error ? error.message : 'Could not refresh online status.');
        // Stop publishing a stale account status after a failed authorisation check.
        if (publish) void publish.untrack().catch(() => {});
      } finally { renewing = false; }
    }

    async function connect() {
      try {
        access = await request<PresenceAccess>('me');
        if (cancelled) return;
        setState(previous => ({ ...previous, role: access!.role }));
        if (viewing && access.role === 'customer') { fail('Staff access is required to view online users.'); return; }
        await client!.realtime.setAuth();
        if (cancelled) return;
        const topics = new Set([access.publishTopic, ...(viewing ? access.readTopics : [])]);
        for (const topic of topics) {
          const reading = viewing && access.readTopics.includes(topic);
          const channel = client!.channel(topic, { config: { private: true, presence: { key: userId!, enabled: reading } } });
          channels.set(topic, channel);
          if (topic === access.publishTopic) publish = channel;
          if (reading) channel.on('presence', { event: 'sync' }, scheduleResolve);
          channel.subscribe(status => {
            if (cancelled) return;
            if (status === 'SUBSCRIBED') {
              ready.add(topic);
              if (topic === access!.publishTopic) void track();
              scheduleResolve();
            } else if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) {
              ready.delete(topic);
              fail('Could not connect to online status. Select Reconnect to try again.');
            }
          });
        }
        renewal = window.setInterval(() => void renew(), 60_000);
        // Recheck current roles and ticket expiry even if no presence events arrive.
        if (viewing) refreshTimer = window.setInterval(scheduleResolve, 20_000);
      } catch (error) { fail(error instanceof Error ? error.message : 'Could not connect to online status.'); }
    }
    void connect();
    const focus = () => void renew();
    window.addEventListener('focus', focus);
    return () => {
      cancelled = true; controller.abort();
      window.clearInterval(renewal); window.clearInterval(refreshTimer); window.clearTimeout(debounce);
      window.removeEventListener('focus', focus);
      for (const channel of channels.values()) void client.removeChannel(channel).catch(() => {});
    };
  }, [userId, revision, viewing]);

  return <OnlinePresenceContext.Provider value={{ ...state, retry: () => setRevision(value => value + 1) }}>{children}</OnlinePresenceContext.Provider>;
}
