import { getSupabaseEnvConfig } from './supabase';

export async function uploadHelpVideo(file: File, path: string, token: string, contentType: string, onProgress: (percentage: number) => void, config = getSupabaseEnvConfig(), signal?: AbortSignal) {
  const { Upload } = await import('tus-js-client');
  const { url, key } = config;
  const storage = new URL(url);
  storage.hostname = storage.hostname.replace(/\.supabase\.co$/, '.storage.supabase.co');
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) { reject(new Error('Video processing cancelled.')); return; }
    const cancelled = () => { void upload.abort(); reject(new Error('Video processing cancelled.')); };
    const cleanup = () => signal?.removeEventListener('abort', cancelled);
    const upload = new Upload(file, {
      endpoint: `${storage.origin}/storage/v1/upload/resumable`,
      headers: { apikey: key, 'x-signature': token },
      chunkSize: 6 * 1024 * 1024,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      storeFingerprintForResuming: false,
      uploadDataDuringCreation: true,
      metadata: { bucketName: 'help-videos', objectName: path, contentType, cacheControl: '3600' },
      onProgress: (uploaded, total) => onProgress(Math.floor(uploaded / total * 100)),
      onSuccess: () => { cleanup(); resolve(); },
      onError: error => {
        cleanup();
        const status = 'originalResponse' in error ? error.originalResponse?.getStatus() : undefined;
        reject(new Error(status === 413 ? 'Storage rejected this file as too large. Ask an Admin to check the project and Help Videos storage limits.' : status === 401 || status === 403 ? 'The video upload permission expired or was denied. Sign in again and retry.' : 'Video upload failed after retrying. Check your connection and try again.'));
      },
    });
    signal?.addEventListener('abort', cancelled, { once: true });
    upload.start();
  });
}
