export const HELP_VIDEO_STORAGE_BYTES = 50 * 1024 * 1024;

export function compressionArguments(duration: number, targetBytes = 44 * 1024 * 1024) {
  if (!Number.isFinite(duration) || duration <= 0) throw new Error('Unable to read this video’s duration. Try exporting it as MP4 or use a YouTube link.');
  const bitrate = Math.min(4000000, Math.floor(targetBytes * 8 * 0.9 / duration) - 96000);
  if (bitrate < 64000) throw new Error('This video is too long to compress clearly below 50 MB. Shorten it or use a YouTube link.');
  return ['-map', '0:v:0', '-map', '0:a:0?', '-c:v', 'libx264', '-preset', 'veryfast', '-b:v', String(bitrate), '-maxrate', String(bitrate), '-bufsize', String(bitrate * 2), '-vf', "scale=w='min(1280,iw)':h='min(720,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2", '-r', '30', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart'];
}
