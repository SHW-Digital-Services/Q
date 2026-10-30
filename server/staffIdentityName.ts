type StaffProfile = { id: string; role: string; preferred_name?: string | null; email?: string | null };

function emailLocalPart(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed || !trimmed.includes('@')) return undefined;
  const [localPart] = trimmed.split('@');
  const clean = localPart.trim();
  if (!clean || clean.length > 120) return undefined;
  return clean;
}

function candidateName(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  const normalized = trimmed.toLowerCase();
  if (['team member', 'staff member', 'staff', 'admin', 'administrator', 'team', 'member'].includes(normalized)) {
    return undefined;
  }
  return trimmed;
}

/** Resolve a staff display name from the profile or the identity provider. */
export async function staffIdentityName(db: any, profile: StaffProfile): Promise<string> {
  const { data: identity } = await db.auth.admin.getUserById(profile.id);
  const user = identity?.user;
  const microsoft = user?.identities?.find((entry: any) => String(entry.provider || '').toLowerCase().startsWith('sso:'));
  const claims = { ...(user?.user_metadata || {}), ...(microsoft?.identity_data || {}) } as Record<string, unknown>;
  const identityName = [
    claims.full_name, claims.name, claims.display_name, claims.displayName, claims.preferred_name,
    [claims.given_name || claims.givenName || claims.first_name, claims.family_name || claims.surname || claims.last_name].filter(Boolean).join(' '),
  ].map(candidateName).find(Boolean);
  const emailName = candidateName(emailLocalPart(user?.email || profile.email));
  const preferredName = candidateName(profile.preferred_name);
  return preferredName || identityName || emailName ||
    (profile.role === 'partner_admin' ? 'Administrator' : 'Team member');
}
