export function staffChatName(name: string | null | undefined, role: string) {
  const value = name?.trim();
  return value && !['team member', 'staff', 'admin'].includes(value.toLowerCase()) ? value : 'Team member';
}
