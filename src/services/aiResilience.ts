import type { UserMemoryProfile } from '../types';
import type { InstantLocalReply } from './instantLocalAi';

const HOSTED_COOLDOWN_KEY = 'q_hosted_ai_cooldown_until';
const DEFAULT_HOSTED_COOLDOWN_SECONDS = 180;

export function getHostedAiCooldownUntil(): number {
  const stored = Number(localStorage.getItem(HOSTED_COOLDOWN_KEY));
  return Number.isFinite(stored) ? stored : 0;
}

export function isHostedAiCoolingDown(now = Date.now()): boolean {
  return getHostedAiCooldownUntil() > now;
}

export function getHostedAiCooldownSeconds(now = Date.now()): number {
  return Math.max(0, Math.ceil((getHostedAiCooldownUntil() - now) / 1000));
}

export function setHostedAiCooldown(seconds = DEFAULT_HOSTED_COOLDOWN_SECONDS): void {
  localStorage.setItem(HOSTED_COOLDOWN_KEY, String(Date.now() + seconds * 1000));
}

export function clearHostedAiCooldown(): void {
  localStorage.removeItem(HOSTED_COOLDOWN_KEY);
}

export function isHostedLimitError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /\b(429|rate.?limit|quota|too many requests|usage limit|insufficient_quota|HOSTED_PROVIDER_LIMIT|HOSTED_ALLOWANCE_LIMIT)\b/i.test(message);
}

function getFirstName(profile?: UserMemoryProfile): string {
  const name = profile?.name?.trim();
  return name ? name.split(/\s+/)[0] : '';
}

function inferFocus(prompt: string) {
  if (/\b(doctor|health|medical|therapy|prescription|clinic|insurance|gender care)\b/i.test(prompt)) {
    return {
      label: 'healthcare',
      verify: 'Check official local healthcare guidance or a qualified clinician before relying on medical details.',
      firstStep: 'Write the appointment goal, key symptoms or questions, medication/allergy details, privacy concerns, and what decision you need help with.'
    };
  }
  if (/\b(legal|law|rights|discrimination|document|gender marker|housing|employment)\b/i.test(prompt)) {
    return {
      label: 'rights',
      verify: 'Use official government, regulator, union, legal-aid, or qualified local advice before acting on rights or policy details.',
      firstStep: 'Save dates, screenshots, policy wording, emails, and the exact outcome you want before escalating the issue.'
    };
  }
  if (/\b(email|message|letter|draft|hr|work|manager)\b/i.test(prompt)) {
    return {
      label: 'drafting',
      verify: 'Keep the wording factual and adjust it to your workplace, school, or service process.',
      firstStep: 'Start with one sentence naming the change you need, then add the deadline, privacy request, and any documents or ticket references.'
    };
  }
  if (/\b(anxious|stress|stressed|overwhelmed|panic|burnout|reflection|journal|dysphoria|grief)\b/i.test(prompt)) {
    return {
      label: 'wellbeing',
      verify: 'If this involves immediate danger or thoughts of self-harm, use emergency or crisis support now.',
      firstStep: 'Name the feeling, the need underneath it, and one small action that reduces pressure in the next ten minutes.'
    };
  }
  return {
    label: 'planning',
    verify: 'For healthcare, legal, safeguarding, money, housing, or immigration decisions, verify details with a qualified local source.',
    firstStep: 'Turn the problem into one outcome, three constraints, and one small action you can take today.'
  };
}

export function buildReliableLocalReply(prompt: string, profile?: UserMemoryProfile, reason = 'Hosted AI is busy right now'): InstantLocalReply {
  const firstName = getFirstName(profile);
  const focus = inferFocus(prompt);
  const greeting = firstName ? `${firstName}, I can still help privately.` : 'I can still help privately.';

  return {
    model: 'Q Reliable Private Mode',
    actionItems: [
      'Keep working from this private response while hosted AI cools down.',
      'Verify high-stakes details with an official or qualified local source.',
      'Try Hosted AI again later if you need a more detailed generated answer.'
    ],
    reply: `${greeting}

${reason}. Here is a dependable ${focus.label} frame you can use now:

1. Clarify the ask
Write the exact question or outcome in one sentence. If there are people, deadlines, costs, safety concerns, documents, or privacy risks involved, list those separately.

2. Choose the safest next step
${focus.firstStep}

3. Separate facts from uncertainty
Mark what you know, what you need to verify, and what would change your decision.

4. Use support deliberately
Choose one trusted person, professional, service, or official source that can reduce the risk of doing this alone.

${focus.verify}`
  };
}
