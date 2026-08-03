import { ChatMessage, UserMemoryProfile } from '../types';

const REDACTION_LABELS = {
  email: '[REDACTED_EMAIL]',
  phone: '[REDACTED_PHONE]',
  ssn: '[REDACTED_SSN]',
  card: '[REDACTED_CARD]',
  ip: '[REDACTED_IP]'
} as const;

// These patterns intentionally target common identifiers, not ordinary words or names.
const PII_PATTERNS: Array<[RegExp, string]> = [
  [/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, REDACTION_LABELS.email],
  [/\b(?:\+?\d[\s().-]?){7,}\d\b/g, REDACTION_LABELS.phone],
  [/\b\d{3}[- ]\d{2}[- ]\d{4}\b/g, REDACTION_LABELS.ssn],
  [/\b(?:\d[ -]*?){13,19}\b/g, REDACTION_LABELS.card],
  [/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, REDACTION_LABELS.ip]
];

export function redactPii(value: string): string {
  return PII_PATTERNS.reduce((result, [pattern, replacement]) => result.replace(pattern, replacement), value);
}

// Public name used by the privacy middleware contract.
export const maskPII = redactPii;

export function sanitizeChatHistory(messages: ChatMessage[]): ChatMessage[] {
  return messages.map((message) => ({
    ...message,
    text: redactPii(message.text)
  }));
}

/**
 * Produces the minimum profile context suitable for an external AI request.
 * Names and regions are treated as identifying context even when they are not
 * matched by a structured identifier pattern.
 */
export function sanitizeProfileForExternalService(profile: UserMemoryProfile): UserMemoryProfile {
  return {
    ...profile,
    name: profile.name ? '[PRIVATE_NAME]' : '',
    locationRegion: profile.locationRegion ? '[PRIVATE_REGION]' : '',
    savedGoals: profile.savedGoals.map(redactPii),
    identityTags: profile.identityTags.map(redactPii)
  };
}
