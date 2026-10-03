export type MailFolder = { folderId: string; name: string; type: string; path?: string; unreadCount?: number };

// Zoho also gives custom folders the type "Inbox". Prefer the system path.
export function inboxFolder(folders: MailFolder[]): string {
  return (folders.find(f => f.path?.toLowerCase() === '/inbox')
    || folders.find(f => f.name?.toLowerCase() === 'inbox')
    || folders.find(f => String(f.type).toLowerCase() === 'inbox')
    || folders[0])?.folderId || '';
}

// Prefer Zoho's system folder over a custom folder with a similar name.
export function trashFolder(folders: MailFolder[]): string {
  return (folders.find(f => f.path?.toLowerCase() === '/trash')
    || folders.find(f => String(f.type).toLowerCase() === 'trash')
    || folders.find(f => f.name?.toLowerCase() === 'trash'))?.folderId || '';
}
