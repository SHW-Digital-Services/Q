import React, { useEffect, useRef, useState } from 'react';
import { Plus, Trash2, Video, RefreshCw } from 'lucide-react';
import { getSupabaseClient } from '../services/supabase';
import type { HelpVideo } from './HelpVideos';
import { helpVideoFile, HELP_VIDEO_MAX_LABEL } from '../shared/helpVideoUpload';
import { uploadHelpVideo } from '../services/helpVideoUpload';
import { compressHelpVideo } from '../services/compressHelpVideo';
import { HELP_VIDEO_STORAGE_BYTES } from '../shared/videoCompression';
import { useCrmDraftState } from '../hooks/useCrmDraftState';

export function HelpVideoAdmin() {
  const [videos, setVideos] = useState<HelpVideo[]>([]);
  const [editingId, setEditingId] = useCrmDraftState<string | null>('help-video:id', null);
  const [title, setTitle] = useCrmDraftState('help-video:title', '');
  const [steps, setSteps] = useCrmDraftState('help-video:steps', ['', '', '']);
  const [mode, setMode] = useCrmDraftState<'upload' | 'link'>('help-video:mode', 'upload');
  const [videoUrl, setVideoUrl] = useCrmDraftState('help-video:url', '');
  const [file, setFile] = useState<File | null>(null);
  const [uploadedPath, setUploadedPath] = useCrmDraftState<string | null>('help-video:path', null);
  const [status, setStatus] = useCrmDraftState('help-video:status', 'draft');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [phase, setPhase] = useState<'compressing' | 'uploading' | null>(null);
  const processing = useRef<AbortController | null>(null);
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
    catch (error) { setIsError(true); setMessage(error instanceof Error ? error.message : 'Unable to load videos.'); }
  };
  useEffect(() => { void load(); }, []);
  useEffect(() => () => processing.current?.abort(), []);
  useEffect(() => {
    if (!busy && (!file || uploadedPath)) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [busy, file, uploadedPath]);
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage(''); setIsError(false); setProgress(null);
    try {
      let path = uploadedPath;
      if (mode === 'upload' && !path) {
        if (!file) throw new Error('Choose a video file.');
        const validation = helpVideoFile(file);
        if (validation.error) throw new Error(validation.error);
        const controller = new AbortController(); processing.current = controller;
        let prepared = file;
        if (file.size > HELP_VIDEO_STORAGE_BYTES) {
          setPhase('compressing'); setProgress(0); setMessage('Reducing this video to fit the 50 MB upload limit. Keep this page open.');
          prepared = await compressHelpVideo(file, setProgress, controller.signal);
          setFile(prepared);
        }
        if (prepared.size > HELP_VIDEO_STORAGE_BYTES) throw new Error('This video is still over 50 MB. Use a shorter video or a YouTube link.');
        setMessage('Uploading video...');
        const upload = await request('/upload', 'POST', { contentType: helpVideoFile(prepared).contentType, size: prepared.size });
        if (controller.signal.aborted) throw new Error('Video processing cancelled.');
        setPhase('uploading');
        setProgress(0);
        await uploadHelpVideo(prepared, upload.path, upload.token, helpVideoFile(prepared).contentType, setProgress, undefined, controller.signal);
        path = upload.path; setUploadedPath(path);
      }
      setPhase(null); processing.current = null;
      setMessage('Saving video details...');
      await request(editingId ? `/${editingId}` : '', editingId ? 'PUT' : 'POST', { title, steps: steps.filter((step) => step.trim()), videoPath: mode === 'upload' ? path : null, videoUrl: mode === 'link' ? videoUrl.trim() : null, status });
      resetForm();
      setMessage(editingId ? 'Help Video updated.' : status === 'published' ? 'Help Video published.' : 'Help Video draft saved.'); await load();
    } catch (error) { setIsError(true); setMessage(error instanceof Error ? error.message : 'Unable to save Help Video.'); }
    finally { setBusy(false); setProgress(null); setPhase(null); processing.current = null; }
  };
  const resetForm = () => {
    setEditingId(null); setTitle(''); setSteps(['', '', '']); setFile(null); setUploadedPath(null); setVideoUrl(''); setMode('upload'); setStatus('draft'); setFileKey(key => key + 1);
  };
  const editVideo = (video: HelpVideo) => {
    if ((title || steps.some(step => step.trim()) || file) && !window.confirm('Replace the current video draft with this video?')) return;
    setEditingId(video.id); setTitle(video.title); setSteps([...video.steps]);
    setMode(video.video_path ? 'upload' : 'link'); setUploadedPath(video.video_path); setVideoUrl(video.video_url || '');
    setStatus(video.status); setFile(null); setFileKey(key => key + 1); setMessage(''); setIsError(false);
    document.getElementById('help-video-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const changeStatus = async (video: HelpVideo, nextStatus: string) => {
    setBusy(true); setIsError(false);
    try { await request(`/${video.id}`, 'PATCH', { status: nextStatus }); setMessage(`Help Video ${nextStatus === 'draft' ? 'unpublished' : nextStatus}.`); await load(); }
    catch (error) { setIsError(true); setMessage(error instanceof Error ? error.message : 'Unable to update video.'); }
    finally { setBusy(false); }
  };
  const fieldClass = 'mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white';
  return <section className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5" aria-labelledby="admin-help-videos">
    <div className="flex items-center justify-between"><h2 id="admin-help-videos" className="flex items-center gap-2 font-bold text-white"><Video className="h-5 w-5 text-sky-300" />Help Videos</h2><button type="button" onClick={() => void load()} aria-label="Refresh Help Videos" className="p-3 text-slate-300"><RefreshCw className="h-4 w-4" /></button></div>
    <p className="mt-2 text-sm text-slate-400">Admin-only tutorials for the Help centre. Use demonstration data and add captions to your video. Written steps provide a text alternative.</p>
    <p className="mt-2 text-xs text-slate-400">Written details are recovered after a refresh in this tab. A video file selected from your device must be selected again if it has not finished uploading.</p>
    <form id="help-video-form" onSubmit={save} className="mt-4 space-y-4"><fieldset disabled={busy} className="space-y-4 disabled:opacity-60">
      {editingId && <p className="text-sm font-bold text-sky-200">Editing Help Video</p>}
      <label className="block text-sm text-slate-200">Video title<input required minLength={3} maxLength={180} value={title} onChange={(event) => setTitle(event.target.value)} className={fieldClass} /></label>
      <label className="block text-sm text-slate-200">Video source<select value={mode} onChange={(event) => setMode(event.target.value as 'upload' | 'link')} className={fieldClass}><option value="upload">Upload a video file</option><option value="link">Hosted video link</option></select></label>
      {mode === 'upload' ? <div><label className="block text-sm text-slate-200">Video file (MP4, WebM or Ogg, up to {HELP_VIDEO_MAX_LABEL})<input key={fileKey} required={!uploadedPath} type="file" accept=".mp4,.webm,.ogg,.ogv,video/mp4,video/webm,video/ogg" onChange={(event) => { const nextFile = event.target.files?.[0] ?? null; setFile(nextFile); setUploadedPath(null); setMessage(''); setIsError(false); }} className={fieldClass} /></label>{file && <p className="mt-2 text-xs text-slate-300">Selected: {file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB</p>}{file && helpVideoFile(file).error && <p role="alert" className="mt-2 text-sm text-rose-300">{helpVideoFile(file).error}</p>}<p className="mt-2 text-xs text-slate-400">Videos over 50 MB are compressed in your browser before upload. This can take several minutes and may reduce picture quality. Keep the page open, or use a YouTube link.</p></div> : <label className="block text-sm text-slate-200">HTTPS video link<input required type="url" pattern="https://.*" maxLength={2000} value={videoUrl} onChange={(event) => setVideoUrl(event.target.value)} className={fieldClass} /></label>}
      <div><h3 className="text-sm font-bold text-slate-200">Steps taken</h3><div className="mt-2 space-y-2">{steps.map((step, index) => <div key={index} className="flex items-start gap-2"><label className="min-w-0 flex-1 text-xs text-slate-300">Step {index + 1}<textarea required maxLength={2000} value={step} onChange={(event) => setSteps((current) => current.map((value, item) => item === index ? event.target.value : value))} className={fieldClass} /></label><button type="button" disabled={steps.length === 1} aria-label={`Delete step ${index + 1}`} onClick={() => setSteps((current) => current.filter((_, item) => item !== index))} className="mt-6 rounded-xl p-3 text-rose-300 disabled:opacity-30"><Trash2 className="h-5 w-5" /></button></div>)}</div><button type="button" disabled={steps.length >= 50} onClick={() => setSteps((current) => [...current, ''])} className="mt-3 inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-white disabled:opacity-50"><Plus className="h-4 w-4" />Add step</button></div>
      <label className="block text-sm text-slate-200">Visibility<select value={status} onChange={(event) => setStatus(event.target.value)} className={fieldClass}><option value="draft">Draft</option><option value="published">Published</option></select></label>
      {uploadedPath && mode === 'upload' && <p className="text-xs text-sky-200">The uploaded video is retained. Choose a new file to replace it.</p>}
      <button type="submit" className="rounded-xl bg-sky-600 px-4 py-3 text-sm font-bold text-white">{busy ? 'Saving...' : editingId ? 'Save changes' : 'Save Help Video'}</button>
      <button type="button" onClick={() => { if (window.confirm('Discard the current video draft?')) resetForm(); }} className="ml-3 rounded-xl border border-white/10 px-4 py-3 text-sm text-slate-200">{editingId ? 'Cancel editing' : 'Discard draft'}</button>
    </fieldset></form>
    {progress !== null && phase && <div className="mt-4"><p role="status" className="text-sm text-sky-200">{phase === 'compressing' ? 'Compressing' : 'Uploading'} video: {progress}%</p><progress aria-label="Video processing progress" max={100} value={progress} className="mt-2 w-full" /><button type="button" onClick={() => processing.current?.abort()} className="mt-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-200">Cancel</button></div>}
    {message && <p role={isError ? 'alert' : 'status'} className={`mt-4 rounded-xl p-3 text-sm ${isError ? 'bg-rose-500/10 text-rose-200' : 'text-sky-200'}`}>{message}</p>}
    <div className="mt-5 grid gap-3 md:grid-cols-2">{videos.map((video) => <article key={video.id} className="rounded-2xl border border-white/10 p-4"><h3 className="font-bold text-white">{video.title}</h3><p className="mt-2 text-xs text-slate-400">{video.status} · {video.steps.length} steps · {video.video_path ? 'Uploaded video' : 'Hosted link'}</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={() => editVideo(video)} className="rounded-lg border border-sky-300/30 px-3 py-2 text-xs font-bold text-sky-200 disabled:opacity-50">Edit</button><button type="button" disabled={busy} onClick={() => void changeStatus(video, video.status === 'published' ? 'draft' : 'published')} className="rounded-lg bg-sky-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{video.status === 'published' ? 'Unpublish' : 'Publish'}</button><button type="button" disabled={busy} onClick={() => void changeStatus(video, 'archived')} className="rounded-lg border border-rose-300/20 px-3 py-2 text-xs text-rose-200 disabled:opacity-50">Archive</button></div></article>)}</div>
  </section>;
}
