import React, { useEffect, useState } from 'react';
import { Video, ExternalLink, RefreshCw } from 'lucide-react';
import { youtubeVideoId } from '../shared/youtube';

function HostedVideo({ url, title }: { url: string; title: string }) {
  const id = youtubeVideoId(url);
  const [playing, setPlaying] = useState(false);
  return <>
    {id && playing ? <iframe title={title} src={`https://www.youtube-nocookie.com/embed/${id}?rel=0`} className="aspect-video w-full rounded-xl border-0 bg-slate-950" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" /> : id ? <button type="button" onClick={() => setPlaying(true)} className="flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-xl bg-slate-950 p-5 text-white"><Video className="h-10 w-10" /><span className="font-bold">Play {title}</span><span className="text-xs text-slate-300">Watch here using the YouTube player</span></button> : null}
    <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-violet-700 px-4 py-2 text-sm font-bold text-white">{id ? 'Open on YouTube' : 'Watch video'}<ExternalLink className="h-4 w-4" /><span className="sr-only">(opens on another website)</span></a>
    <p className="text-xs text-slate-500">{id ? 'Selecting Play loads YouTube’s player. YouTube’s privacy and cookie settings apply.' : "This video opens on its host's website, which applies its own privacy and cookie settings."}</p>
  </>;
}

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
        {video.playback_url ? <video controls preload="none" className="w-full rounded-xl bg-slate-950" aria-label={video.title}><source src={video.playback_url} /><p>Your browser cannot play this video.</p></video> : video.video_url ? <HostedVideo key={video.video_url} url={video.video_url} title={video.title} /> : null}
        <h3 className="font-bold text-slate-900">Steps taken</h3><ol className="list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-700">{video.steps.map((step, index) => <li key={index} className="whitespace-pre-wrap">{step}</li>)}</ol>
      </div>
    </details>)}</div>}
  </section>;
}
