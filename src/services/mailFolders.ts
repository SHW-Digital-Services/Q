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

// Keep provider folders intact; only combine their presentation in Q.
export function combinedInboxFolders(folders: MailFolder[]): MailFolder[] {
  const primary = inboxFolder(folders);
  return folders.filter(folder => folder.folderId === primary || ['notification', 'notifications', 'newsletter', 'newsletters'].includes((folder.name || '').trim().toLowerCase()) || ['/notification', '/notifications', '/newsletter', '/newsletters'].includes((folder.path || '').toLowerCase()));
}

export function visibleMailFolders(folders: MailFolder[]): MailFolder[] {
  const combined = combinedInboxFolders(folders);
  const primary = inboxFolder(folders);
  const ids = new Set(combined.map(folder => folder.folderId));
  return folders.filter(folder => !ids.has(folder.folderId) || folder.folderId === primary).map(folder => folder.folderId === primary ? {...folder, name: 'Inbox', unreadCount: combined.reduce((total, item) => total + (item.unreadCount || 0), 0)} : folder);
}
