// Public identity copied from docs/terms.md and docs/privacy.md.
// Add other details only after the operator verifies them for publication.
export const businessIdentity = {
  brand: 'Q Intelligence',
  operator: 'Scott Harvey-Whittle',
  tradingName: 'SHW Digital Services',
  country: 'United Kingdom',
  email: 'office@q-ai.online',
  website: 'https://www.q-ai.online',
  address: null as string | null,
  phone: null as string | null,
  registration: null as { authority: string; number: string; url: string } | null,
  socialProfiles: [] as { name: string; url: string }[],
  team: [] as { name: string; role: string; bio: string; credentials: string[] }[],
};

export const publicLegalPages = ['terms', 'privacy', 'refund', 'cookie', 'accessibility',
  'subscription_terms', 'acceptable_use_policy', 'ai_disclaimer', 'dpa', 'PROCESSORS',
  'security', 'third_party_notices', 'community'] as const;
