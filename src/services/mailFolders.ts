export type MailFolder = { folderId: string; name: string; type: string; path?: string; unreadCount?: number };

// Zoho also gives custom folders the type "Inbox". Prefer the system path.
export function inboxFolder(folders: MailFolder[]): string {
  return (folders.find(f => f.path?.toLowerCase() === '/inbox')
    || folders.find(f => f.name?.toLowerCase() === 'inbox')
    || folders.find(f => String(f.type).toLowerCase() === 'inbox')
    || folders[0])?.folderId || '';
}
