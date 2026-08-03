import { createHmac } from 'node:crypto';

type Interaction = {
  user_id: string;
  content?: string;
  created_at: string;
};

type Sentiment = {
  flagged_unsafe: boolean;
  score: number | null;
};

export type AnalyticsExport = {
  generatedAt: string;
  totals: {
    interactions: number;
    uniqueUsers: number;
    unsafeFlags: number;
  };
  trustPivot: {
    usersWithInformationSeeking: number;
    usersWithPersonalGuidance: number;
    usersWhoPivoted: number;
  };
  sentiment: {
    averageScore: number | null;
    flaggedUnsafe: number;
  };
};

/**
 * Anonymize a user id using an HMAC keyed with an environment secret.
 * This prevents deterministic cross-environment linking of identifiers.
 * Set ANALYTICS_HMAC_KEY in your staging/production env to a long random value.
 */
function anonymizeUserId(userId: string): string {
  const key = process.env.ANALYTICS_HMAC_KEY || 'dev-fallback-change-me';
  return createHmac('sha256', key).update(userId).digest('hex').slice(0, 16);
}

function interactionMode(content: string): 'information' | 'personal' | 'other' {
  const normalized = content.toLowerCase();
  if (/\b(i|my|me|feel|afraid|stressed|anxious|struggling|help me)\b/.test(normalized)) return 'personal';
  if (/\b(what|how|where|when|can i find|information|法律|rights|healthcare|doctor|law)\b/.test(normalized)) return 'information';
  return 'other';
}

export function buildAnalyticsExport(interactions: Interaction[], feedback: Sentiment[]): AnalyticsExport {
  const byUser = new Map<string, { info: boolean; personal: boolean; firstInfoAt?: string; firstPersonalAt?: string }>();
  for (const interaction of interactions) {
    const key = anonymizeUserId(interaction.user_id);
    const state = byUser.get(key) ?? { info: false, personal: false };
    const mode = interactionMode(interaction.content ?? '');
    if (mode === 'information') {
      state.info = true;
      state.firstInfoAt = state.firstInfoAt ?? interaction.created_at;
    }
    if (mode === 'personal') {
      state.personal = true;
      state.firstPersonalAt = state.firstPersonalAt ?? interaction.created_at;
    }
    byUser.set(key, state);
  }

  const flaggedUnsafe = feedback.filter((item) => item.flagged_unsafe).length;
  const scores = feedback.map((item) => item.score).filter((score): score is number => typeof score === 'number');
  const usersWhoPivoted = [...byUser.values()].filter((state) =>
    state.info && state.personal && !!state.firstInfoAt && !!state.firstPersonalAt && state.firstPersonalAt >= state.firstInfoAt
  ).length;

  const report: AnalyticsExport = {
    generatedAt: new Date().toISOString(),
    totals: {
      interactions: interactions.length,
      uniqueUsers: byUser.size,
      unsafeFlags: flaggedUnsafe
    },
    trustPivot: {
      usersWithInformationSeeking: [...byUser.values()].filter((state) => state.info).length,
      usersWithPersonalGuidance: [...byUser.values()].filter((state) => state.personal).length,
      usersWhoPivoted
    },
    sentiment: {
      averageScore: scores.length ? Number((scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(3)) : null,
      flaggedUnsafe
    }
  };

  validateAggregateExport(report);
  return report;
}

export function validateAggregateExport(payload: unknown): asserts payload is AnalyticsExport {
  const serialized = JSON.stringify(payload);
  const piiPatterns = [
    // emails
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
    // phone numbers (loose)
    /\b(?:\+?\d[\s().-]?){7,}\d\b/,
    // SSN-like (US) 123-45-6789 or 123456789
    /\b\d{3}-?\d{2}-?\d{4}\b/,
    // dates that look like DOB in YYYY-MM-DD or MM/DD/YYYY (be conservative)
    /\b\d{4}-\d{2}-\d{2}\b/,
    /\b\d{1,2}\/\d{1,2}\/\d{4}\b/,
    // IPv4 addresses
    /\b(?:\d{1,3}\.){3}\d{1,3}\b/,
    // long numeric sequences (possible account numbers) - 9+ digits
    /\b\d{9,}\b/
  ];

  if (piiPatterns.some((pattern) => pattern.test(serialized))) {
    throw new Error('Aggregate export validation failed: possible PII detected.');
  }
}
