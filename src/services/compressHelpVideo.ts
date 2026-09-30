import { compressionArguments, HELP_VIDEO_STORAGE_BYTES } from '../shared/videoCompression';

export async function compressHelpVideo(file: File, progress: (percentage: number) => void, signal: AbortSignal): Promise<File> {
  if (file.size <= HELP_VIDEO_STORAGE_BYTES) return file;
  const { FFmpeg } = await import('@ffmpeg/ffmpeg');
  const ffmpeg = new FFmpeg();
  const cancel = () => ffmpeg.terminate();
  signal.addEventListener('abort', cancel, { once: true });
  try {
    if (signal.aborted) throw new Error('Video processing cancelled.');
    await ffmpeg.load({ classWorkerURL: new URL('/vendor/ffmpeg/worker.js', window.location.origin).href, coreURL: new URL('/vendor/ffmpeg/ffmpeg-core.js', window.location.origin).href, wasmURL: new URL('/vendor/ffmpeg/ffmpeg-core.wasm', window.location.origin).href });
    await ffmpeg.writeFile('input', new Uint8Array(await file.arrayBuffer()));
    const probe = await ffmpeg.ffprobe(['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', '-o', 'duration.txt', 'input']);
    if (probe !== 0) throw new Error('Unable to read this video. Export it as MP4 or use a YouTube link.');
    const raw = await ffmpeg.readFile('duration.txt');
    const duration = Number(typeof raw === 'string' ? raw : new TextDecoder().decode(raw));
    ffmpeg.on('progress', ({ progress: value }) => progress(Math.max(0, Math.min(99, Math.floor(value * 100)))));
    for (const target of [44, 32]) {
      progress(0);
      const exit = await ffmpeg.exec(['-y', '-i', 'input', ...compressionArguments(duration, target * 1024 * 1024), 'output.mp4'], 30 * 60 * 1000);
      if (exit !== 0) throw new Error('This browser could not compress the video. Try a smaller MP4 or use a YouTube link.');
      const bytes = await ffmpeg.readFile('output.mp4');
      if (typeof bytes !== 'string' && bytes.byteLength > 0 && bytes.byteLength <= HELP_VIDEO_STORAGE_BYTES) {
        progress(100);
        return new File([new Uint8Array(bytes).buffer], file.name.replace(/\.[^.]+$/, '') + '-compressed.mp4', { type: 'video/mp4' });
      }
    }
    throw new Error('The compressed video is still over 50 MB. Shorten it or use a YouTube link.');
  } catch (error) {
    if (signal.aborted) throw new Error('Video processing cancelled.');
    if (error instanceof Error && /video|browser/.test(error.message)) throw error;
    throw new Error('Video compression could not start. Reload Q and try again, or use a YouTube link.');
  } finally { signal.removeEventListener('abort', cancel); ffmpeg.terminate(); }
}
