type StaffProfile = { id: string; role: string; preferred_name?: string | null };

/** Resolve a staff display name from the profile or the identity provider. */
export async function staffIdentityName(db: any, profile: StaffProfile): Promise<string> {
  const { data: identity } = await db.auth.admin.getUserById(profile.id);
  const user = identity?.user;
  const microsoft = user?.identities?.find((entry: any) => String(entry.provider || '').toLowerCase().startsWith('sso:'));
  const claims = { ...(user?.user_metadata || {}), ...(microsoft?.identity_data || {}) } as Record<string, unknown>;
  const microsoftName = [
    claims.full_name, claims.name, claims.display_name, claims.displayName,
    [claims.given_name || claims.givenName, claims.family_name || claims.surname].filter(Boolean).join(' '),
  ].find(value => typeof value === 'string' && value.trim());
  return (microsoftName as string | undefined)?.trim() || profile.preferred_name?.trim() ||
    `${profile.role === 'partner_admin' ? 'Admin' : 'Staff'} ${profile.id.slice(0, 8)}`;
}
