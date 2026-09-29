import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Video, RefreshCw } from 'lucide-react';
import { getSupabaseClient } from '../services/supabase';
import type { HelpVideo } from './HelpVideos';

export function HelpVideoAdmin() {
  const [videos, setVideos] = useState<HelpVideo[]>([]);
  const [title, setTitle] = useState('');
  const [steps, setSteps] = useState(['', '', '']);
  const [mode, setMode] = useState<'upload' | 'link'>('upload');
  const [videoUrl, setVideoUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploadedPath, setUploadedPath] = useState<string | null>(null);
  const [status, setStatus] = useState('draft');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [fileKey, setFileKey] = useState(0);
  const request = async (path = '', method = 'GET', body?: unknown) => {
    const { data } = await getSupabaseClient()!.auth.getSession();
    if (!data.session) throw new Error('Sign in as an Admin to manage Help Videos.');
    const response = await fetch(`/api/v1/admin/help-videos${path}`, { method, headers: { Authorization: `Bearer ${data.session.access_token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Unable to manage Help Videos.');
    return result;
  };
  const load = async () => {
    try { setVideos((await request()).videos); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to load videos.'); }
  };
  useEffect(() => { void load(); }, []);
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      let path = uploadedPath;
      if (mode === 'upload' && !path) {
        if (!file) throw new Error('Choose a video file.');
        if (!['video/mp4', 'video/webm', 'video/ogg'].includes(file.type) || file.size > 104857600) throw new Error('Choose an MP4, WebM or Ogg video up to 100 MB.');
        setMessage('Uploading video...');
        const upload = await request('/upload', 'POST', { contentType: file.type, size: file.size });
        const { error } = await getSupabaseClient()!.storage.from('help-videos').uploadToSignedUrl(upload.path, upload.token, file, { contentType: file.type });
        if (error) throw error;
        path = upload.path; setUploadedPath(path);
      }
      await request('', 'POST', { title, steps: steps.filter((step) => step.trim()), videoPath: mode === 'upload' ? path : null, videoUrl: mode === 'link' ? videoUrl.trim() : null, status });
      setTitle(''); setSteps(['', '', '']); setFile(null); setUploadedPath(null); setVideoUrl(''); setFileKey((key) => key + 1);
      setMessage(status === 'published' ? 'Help Video published.' : 'Help Video draft saved.'); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to save Help Video.'); }
    finally { setBusy(false); }
  };
  const changeStatus = async (video: HelpVideo, nextStatus: string) => {
    setBusy(true);
    try { await request(`/${video.id}`, 'PATCH', { status: nextStatus }); setMessage(`Help Video ${nextStatus === 'draft' ? 'unpublished' : nextStatus}.`); await load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to update video.'); }
    finally { setBusy(false); }
  };
  const fieldClass = 'mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white';
  return <section className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5" aria-labelledby="admin-help-videos">
    <div className="flex items-center justify-between"><h2 id="admin-help-videos" className="flex items-center gap-2 font-bold text-white"><Video className="h-5 w-5 text-sky-300" />Help Videos</h2><button type="button" onClick={() => void load()} aria-label="Refresh Help Videos" className="p-3 text-slate-300"><RefreshCw className="h-4 w-4" /></button></div>
    <p className="mt-2 text-sm text-slate-400">Admin-only tutorials for the Help centre. Use demonstration data and add captions to your video. Written steps provide a text alternative.</p>
    <form onSubmit={save} className="mt-4 space-y-4"><fieldset disabled={busy} className="space-y-4 disabled:opacity-60">
      <label className="block text-sm text-slate-200">Video title<input required minLength={3} maxLength={180} value={title} onChange={(event) => setTitle(event.target.value)} className={fieldClass} /></label>
      <label className="block text-sm text-slate-200">Video source<select value={mode} onChange={(event) => setMode(event.target.value as 'upload' | 'link')} className={fieldClass}><option value="upload">Upload a video file</option><option value="link">Hosted video link</option></select></label>
      {mode === 'upload' ? <label className="block text-sm text-slate-200">Video file (MP4, WebM or Ogg, up to 100 MB)<input key={fileKey} required={!uploadedPath} type="file" accept="video/mp4,video/webm,video/ogg" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setUploadedPath(null); }} className={fieldClass} /></label> : <label className="block text-sm text-slate-200">HTTPS video link<input required type="url" pattern="https://.*" maxLength={2000} value={videoUrl} onChange={(event) => setVideoUrl(event.target.value)} className={fieldClass} /></label>}
      <div><h3 className="text-sm font-bold text-slate-200">Steps taken</h3><div className="mt-2 space-y-2">{steps.map((step, index) => <div key={index} className="flex items-start gap-2"><label className="min-w-0 flex-1 text-xs text-slate-300">Step {index + 1}<textarea required maxLength={2000} value={step} onChange={(event) => setSteps((current) => current.map((value, item) => item === index ? event.target.value : value))} className={fieldClass} /></label><button type="button" disabled={steps.length === 1} aria-label={`Delete step ${index + 1}`} onClick={() => setSteps((current) => current.filter((_, item) => item !== index))} className="mt-6 rounded-xl p-3 text-rose-300 disabled:opacity-30"><Trash2 className="h-5 w-5" /></button></div>)}</div><button type="button" disabled={steps.length >= 50} onClick={() => setSteps((current) => [...current, ''])} className="mt-3 inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-white disabled:opacity-50"><Plus className="h-4 w-4" />Add step</button></div>
      <label className="block text-sm text-slate-200">Visibility<select value={status} onChange={(event) => setStatus(event.target.value)} className={fieldClass}><option value="draft">Draft</option><option value="published">Published</option></select></label>
      <button type="submit" className="rounded-xl bg-sky-600 px-4 py-3 text-sm font-bold text-white">{busy ? 'Saving...' : 'Save Help Video'}</button>
    </fieldset></form>
    {message && <p role="status" className="mt-4 text-sm text-sky-200">{message}</p>}
    <div className="mt-5 grid gap-3 md:grid-cols-2">{videos.map((video) => <article key={video.id} className="rounded-2xl border border-white/10 p-4"><h3 className="font-bold text-white">{video.title}</h3><p className="mt-2 text-xs text-slate-400">{video.status} · {video.steps.length} steps · {video.video_path ? 'Uploaded video' : 'Hosted link'}</p><div className="mt-3 flex gap-2"><button type="button" disabled={busy} onClick={() => void changeStatus(video, video.status === 'published' ? 'draft' : 'published')} className="rounded-lg bg-sky-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{video.status === 'published' ? 'Unpublish' : 'Publish'}</button><button type="button" disabled={busy} onClick={() => void changeStatus(video, 'archived')} className="rounded-lg border border-rose-300/20 px-3 py-2 text-xs text-rose-200 disabled:opacity-50">Archive</button></div></article>)}</div>
  </section>;
}
