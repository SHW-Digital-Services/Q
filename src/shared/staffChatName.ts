export function staffChatName(name: string | null | undefined, role: string) {
  const value = name?.trim();
  return value && value !== 'Team member' ? value : role === 'partner_admin' ? 'Admin' : 'Staff';
}
