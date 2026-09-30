export const HELP_VIDEO_MAX_BYTES = 500 * 1024 * 1024;
export const HELP_VIDEO_MAX_LABEL = '500 MB';
export const HELP_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/ogg'];

export function helpVideoFile(file: { name: string; type: string; size: number }): { contentType: string; error: string } {
  const fallback: Record<string, string> = { mp4: 'video/mp4', webm: 'video/webm', ogg: 'video/ogg', ogv: 'video/ogg' };
  const contentType = file.type && file.type !== 'application/octet-stream' ? file.type : fallback[file.name.split('.').pop()?.toLowerCase() || ''] || '';
  if (!HELP_VIDEO_TYPES.includes(contentType)) return { contentType, error: 'This video format is not supported. Choose an MP4, WebM or Ogg file.' };
  if (file.size < 1) return { contentType, error: 'This file is empty. Choose a video containing data.' };
  if (file.size > HELP_VIDEO_MAX_BYTES) return { contentType, error: `This video is ${(file.size / 1024 / 1024).toFixed(1)} MB. The upload limit is ${HELP_VIDEO_MAX_LABEL}. Use a smaller file or a hosted video link.` };
  return { contentType, error: '' };
}
