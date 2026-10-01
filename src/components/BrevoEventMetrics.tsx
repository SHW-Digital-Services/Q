import React from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { brevoEventInfo } from '../shared/brevoEventPresentation';

export type EventMetrics = { days: number; from: string; to: string; total: number; awaitingReview: number; reviewed: number; buckets: { date: string; event_type: string; count: number }[] };
const categories = [
  { key: 'delivery', name: 'Sending & delivery', color: '#22d3ee' },
  { key: 'engagement', name: 'Opens & clicks', color: '#a78bfa' },
  { key: 'problems', name: 'Delivery problems & complaints', color: '#fb7185' },
  { key: 'contacts', name: 'Contact changes', color: '#34d399' },
  { key: 'consent', name: 'Subscriptions & consent', color: '#fbbf24' },
  { key: 'other', name: 'Other events', color: '#94a3b8' },
];
const tooltip = { contentStyle: { background: '#0f172a', border: '1px solid #334155', borderRadius: 12, color: '#f8fafc' }, labelStyle: { color: '#f8fafc' }, itemStyle: { color: '#f8fafc' } };

export function eventMetricsData(metrics: EventMetrics) {
  const types = new Map<string, { name: string; count: number; group: string }>();
  const totals = new Map<string, number>();
  const days = new Map<string, { date: string; total: number; problems: number }>();
  for (let offset = 0; offset < metrics.days; offset++) {
    const date = new Date(`${metrics.from}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + offset);
    const key = date.toISOString().slice(0, 10); days.set(key, { date: key, total: 0, problems: 0 });
  }
  let delivered = 0;
  for (const bucket of metrics.buckets) {
    const info = brevoEventInfo(bucket.event_type);
    const type = types.get(info.title) || { name: info.title, count: 0, group: info.group };
    type.count += bucket.count; types.set(info.title, type);
    totals.set(info.group, (totals.get(info.group) || 0) + bucket.count);
    const day = days.get(bucket.date);
    if (day) { day.total += bucket.count; if (info.group === 'problems') day.problems += bucket.count; }
    if (info.title === 'Message delivered') delivered += bucket.count;
  }
  return {
    delivered, problems: totals.get('problems') || 0, engagement: totals.get('engagement') || 0,
    daily: [...days.values()], types: [...types.values()].sort((a, b) => b.count - a.count),
    mix: categories.map(category => ({ ...category, value: totals.get(category.key) || 0 })).filter(category => category.value > 0),
  };
}

export default function BrevoEventMetrics({ metrics, loading, error, days, onDaysChange }: { metrics: EventMetrics | null; loading: boolean; error: string; days: number; onDaysChange: (days: number) => void }) {
  const data = metrics ? eventMetricsData(metrics) : null;
  return <section aria-labelledby="event-metrics-heading" className="mt-6 rounded-2xl border border-white/10 bg-slate-950/40 p-4 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 id="event-metrics-heading" className="text-lg font-bold text-white">Event activity</h3><p className="mt-1 text-xs leading-5 text-slate-400">All connections · received dates in UTC · independent of inbox filters</p></div><label className="flex items-center gap-2 text-sm text-slate-300"><span>Reporting period</span><select value={days} onChange={event => onDaysChange(Number(event.target.value))} className="min-h-11 rounded-xl border border-white/10 bg-slate-950 px-3 text-white"><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option></select></label></div>
    {loading ? <p role="status" className="mt-5 text-sm text-slate-400">Loading event metrics…</p> : error ? <p role="alert" className="mt-5 rounded-xl bg-amber-500/10 p-4 text-sm text-amber-200">{error}</p> : metrics && data ? <>
      <p className="mt-3 text-xs text-slate-500">{metrics.from} to {metrics.to}, inclusive</p>
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">{[
        ['Events received', metrics.total, 'All event notifications in this period'],
        ['Delivery confirmations', data.delivered, 'Delivered notifications from Brevo'],
        ['Delivery problems & complaints', data.problems, 'Failures, delays, blocks and spam complaints'],
        ['Opens & clicks', data.engagement, 'Recorded engagement notifications'],
      ].map(([label, value, note]) => <div key={String(label)} className="rounded-xl border border-white/10 bg-slate-900/60 p-4"><p className="text-xs text-slate-300">{label}</p><p className="mt-2 text-3xl font-bold tabular-nums text-cyan-200">{Number(value).toLocaleString('en-GB')}</p><p className="mt-2 text-[11px] leading-4 text-slate-500">{note}</p></div>)}</div>
      {metrics.total === 0 ? <p className="mt-5 rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-400">No events were received in this reporting period. Try a longer period.</p> : <>
        <div className="mt-5 rounded-xl border border-white/10 bg-slate-900/40 p-4"><h4 className="font-semibold text-white">Events received each day</h4><p className="mt-1 text-xs text-slate-400">Cyan: all events · Rose: delivery problems and complaints</p><div className="mt-4 h-56 min-w-0" role="img" aria-label={`Daily event volume: ${metrics.total} events across ${metrics.days} days, including ${data.problems} delivery problems and complaints.`}><ResponsiveContainer width="100%" height="100%"><AreaChart data={data.daily} margin={{ top: 10, right: 12, left: 0, bottom: 0 }} accessibilityLayer><CartesianGrid stroke="#334155" strokeDasharray="3 3" /><XAxis dataKey="date" tickFormatter={date => String(date).slice(5)} minTickGap={30} stroke="#94a3b8" fontSize={11} /><YAxis allowDecimals={false} stroke="#94a3b8" fontSize={11} width={35} /><Tooltip {...tooltip} /><Area name="All events" type="monotone" dataKey="total" stroke="#22d3ee" fill="#22d3ee" fillOpacity={0.12} isAnimationActive={false} /><Area name="Problems & complaints" type="monotone" dataKey="problems" stroke="#fb7185" fill="#fb7185" fillOpacity={0.15} isAnimationActive={false} /></AreaChart></ResponsiveContainer></div></div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2"><div className="min-w-0 rounded-xl border border-white/10 bg-slate-900/40 p-4"><h4 className="font-semibold text-white">Most common event types</h4><p className="mt-1 text-xs text-slate-400">The six largest event counts in this period</p><div className="mt-4 h-64" role="img" aria-label={data.types.slice(0, 6).map(type => `${type.name}: ${type.count}`).join('; ')}><ResponsiveContainer width="100%" height="100%"><BarChart data={data.types.slice(0, 6)} layout="vertical" margin={{ left: 0, right: 12 }} accessibilityLayer><CartesianGrid stroke="#334155" strokeDasharray="3 3" horizontal={false} /><XAxis type="number" allowDecimals={false} stroke="#94a3b8" fontSize={11} /><YAxis type="category" dataKey="name" width={145} stroke="#94a3b8" fontSize={11} /><Tooltip {...tooltip} cursor={{ fill: '#1e293b' }} /><Bar dataKey="count" name="Events" fill="#22d3ee" radius={[0, 4, 4, 0]} isAnimationActive={false} /></BarChart></ResponsiveContainer></div></div>
          <div className="min-w-0 rounded-xl border border-white/10 bg-slate-900/40 p-4"><h4 className="font-semibold text-white">Event mix</h4><div className="h-44" role="img" aria-label={data.mix.map(group => `${group.name}: ${group.value}`).join('; ')}><ResponsiveContainer width="100%" height="100%"><PieChart><Tooltip {...tooltip} /><Pie data={data.mix} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70} stroke="#0f172a" isAnimationActive={false}>{data.mix.map(group => <Cell key={group.key} fill={group.color} />)}</Pie></PieChart></ResponsiveContainer></div><ul className="space-y-2 text-xs">{data.mix.map(group => <li key={group.key} className="flex items-center justify-between gap-3"><span className="flex items-center gap-2 text-slate-300"><span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ backgroundColor: group.color }} />{group.name}</span><span className="font-semibold tabular-nums text-white">{group.value.toLocaleString('en-GB')}</span></li>)}</ul></div></div>
      </>}
      <details className="mt-4 text-xs text-slate-400"><summary className="cursor-pointer font-semibold text-slate-300">View all event counts as a table</summary><div className="mt-3 overflow-x-auto"><table className="w-full text-left"><caption className="sr-only">Event counts for the reporting period</caption><thead><tr><th scope="col" className="p-2">Event</th><th scope="col" className="p-2 text-right">Count</th></tr></thead><tbody>{data.types.map(type => <tr key={type.name} className="border-t border-white/10"><td className="p-2">{type.name}</td><td className="p-2 text-right tabular-nums">{type.count}</td></tr>)}</tbody></table></div></details>
      <p className="mt-4 text-xs leading-5 text-slate-500">Counts represent events, not unique people or messages. Repeated opens and clicks can add events, and privacy tools can affect engagement tracking. These figures are not delivery or open rates. Q only includes events sent to its configured connections.</p>
    </> : null}
  </section>;
}
