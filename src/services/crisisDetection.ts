export const CRISIS_PATTERNS = /\b(suicid(?:e|al)?|end (?:my|this) life|kill myself|self[ -]?harm|hurt myself|don'?t want to (?:be here|live)|abuse|hate crime)\b/i;
export function hasCrisisIntent(message: string): boolean { return CRISIS_PATTERNS.test(message); }
