export function staffChatName(name: string | null | undefined, role: string) {
  const value = name?.trim();
  if (!value) return role === 'partner_admin' ? 'Administrator' : 'Team member';
  const genericNames = new Set(['team member', 'staff member', 'staff', 'admin', 'administrator', 'team', 'member']);
  return genericNames.has(value.toLowerCase()) ? (role === 'partner_admin' ? 'Administrator' : 'Team member') : value;
}
