import React, { useEffect, useState } from 'react';
import { Video, ExternalLink, RefreshCw } from 'lucide-react';

export interface HelpVideo {
  id: string; title: string; steps: string[]; video_url: string | null;
  video_path: string | null; playback_url?: string; status: 'draft' | 'published' | 'archived';
}

export function HelpVideos({ query = '' }: { query?: string }) {
  const [videos, setVideos] = useState<HelpVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = async () => {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/help-videos', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to load Help Videos.');
      setVideos(data.videos ?? []);
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to load Help Videos.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  const visible = videos.filter((video) => [video.title, ...video.steps].join(' ').toLowerCase().includes(query.trim().toLowerCase()));
  return <section className="rounded-3xl border border-violet-100 bg-white p-5 sm:p-7" aria-labelledby="help-videos-heading">
    <div className="flex items-center justify-between gap-3"><h2 id="help-videos-heading" className="flex items-center gap-2 text-lg font-black text-slate-950"><Video className="h-5 w-5 text-violet-700" />Help Videos</h2><button type="button" aria-label="Refresh Help Videos" onClick={() => void load()} className="rounded-lg p-3 text-violet-700"><RefreshCw className="h-4 w-4" /></button></div>
    <p className="mt-2 text-sm text-slate-600">Watch how to use Q and follow the steps at your own pace.</p>
    {loading ? <p role="status" className="mt-4 text-sm text-slate-500">Loading Help Videos...</p> : error ? <p role="alert" className="mt-4 text-sm text-rose-700">{error}</p> : visible.length === 0 ? <p className="mt-4 text-sm text-slate-500">{videos.length ? 'No videos match your search.' : 'Help Videos are coming soon.'}</p> : <div className="mt-5 space-y-4">{visible.map((video) => <details key={video.id} className="rounded-2xl border border-violet-100 p-4">
      <summary className="cursor-pointer font-bold text-slate-900">{video.title}</summary>
      <div className="mt-4 space-y-4">
        {video.playback_url ? <video controls preload="none" className="w-full rounded-xl bg-slate-950" aria-label={video.title}><source src={video.playback_url} /><p>Your browser cannot play this video.</p></video> : <a href={video.video_url!} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-violet-700 px-4 py-2 text-sm font-bold text-white">Watch video<ExternalLink className="h-4 w-4" /><span className="sr-only">(opens on another website)</span></a>}
        {video.video_url && <p className="text-xs text-slate-500">This video opens on its host's website, which applies its own privacy and cookie settings.</p>}
        <h3 className="font-bold text-slate-900">Steps taken</h3><ol className="list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-700">{video.steps.map((step, index) => <li key={index} className="whitespace-pre-wrap">{step}</li>)}</ol>
      </div>
    </details>)}</div>}
  </section>;
}
