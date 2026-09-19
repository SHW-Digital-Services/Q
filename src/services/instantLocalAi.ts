import type { UserMemoryProfile } from '../types';

export interface InstantLocalReply {
  reply: string;
  actionItems: string[];
  model: string;
}

type InstantIntent = 'hr_email' | 'boundaries' | 'healthcare' | 'legal_rights' | 'journal' | 'planning';

const INSTANT_MODEL = 'Q Fast Private Mode';

const INTENT_PATTERNS: Array<{ intent: InstantIntent; pattern: RegExp }> = [
  { intent: 'hr_email', pattern: /\b(hr|human resources|workplace|display name|email alias|pronouns?|name update|work email|professional email|draft .*email)\b/i },
  { intent: 'boundaries', pattern: /\b(boundar(?:y|ies)|coming out|come out|family|traditional family|parents?|relatives?|relationship conflict)\b/i },
  { intent: 'healthcare', pattern: /\b(healthcare|doctor|gp|clinic|therapy|therapist|insurance|prescription|gender clinic|affirming care|medical)\b/i },
  { intent: 'legal_rights', pattern: /\b(legal|law|rights|non-discrimination|discrimination|name marker|gender marker|documents?|policy|protection)\b/i },
  { intent: 'journal', pattern: /\b(journal|reflect|reflection|mood|anxious|anxiety|stress|stressed|overwhelmed|burnout|dysphoria|grief)\b/i },
  { intent: 'planning', pattern: /\b(plan|checklist|steps|prepare|organise|organize|decision|options|strategy|next steps)\b/i }
];

function getFirstName(profile?: UserMemoryProfile): string {
  const name = profile?.name?.trim();
  if (!name) return '';
  return name.split(/\s+/)[0];
}

function formatGreeting(profile?: UserMemoryProfile): string {
  const firstName = getFirstName(profile);
  return firstName ? `${firstName}, here is a private draft you can adapt.` : 'Here is a private draft you can adapt.';
}

function buildHrEmail(profile?: UserMemoryProfile): InstantLocalReply {
  const preferredName = profile?.name?.trim() || '[preferred display name]';
  const pronounsLine = profile?.pronouns?.trim() ? `\nMy pronouns are ${profile.pronouns.trim()}.` : '';

  return {
    model: INSTANT_MODEL,
    actionItems: ['Replace the bracketed alias with the exact address you want.', 'Add any HR ticket number or policy form if your workplace requires one.', 'Keep a copy of the request and any confirmation.'],
    reply: `${formatGreeting(profile)}

Subject: Request to Update Display Name and Email Alias

Dear HR Team,

I hope you are well.

I am writing to request an update to my workplace display name and email alias.${pronounsLine}

Please could my display name be updated to:
${preferredName}

Please could my email alias be updated to:
[preferred.email@company.com]

If there is a form, identity verification step, or IT ticket needed to complete this, please let me know and I will provide the required information.

Kind regards,
${preferredName}`
  };
}

function buildBoundariesGuide(profile?: UserMemoryProfile): InstantLocalReply {
  return {
    model: INSTANT_MODEL,
    actionItems: ['Decide what you are comfortable sharing before the conversation.', 'Write one boundary sentence you can repeat calmly.', 'Choose a safer exit plan if the conversation becomes hostile.'],
    reply: `${formatGreeting(profile)}

A steady way to set boundaries is to keep the message short, clear, and repeatable:

1. Name the boundary:
"I am not discussing or debating my identity. I am sharing something important about my life."

2. Say what respectful support looks like:
"You do not have to understand everything immediately, but I need you to use my name and speak to me respectfully."

3. Set a consequence without making it a threat:
"If the conversation becomes hurtful, I will pause it and we can try again another time."

4. Protect your energy:
Have a friend, helpline, or safe activity ready afterwards. Coming out or correcting family can be emotionally expensive, even when it goes well.

If there is any risk of violence, housing loss, financial control, or outing, prioritise safety planning over disclosure.`
  };
}

function buildHealthcareGuide(profile?: UserMemoryProfile): InstantLocalReply {
  const region = profile?.locationRegion?.trim();
  return {
    model: INSTANT_MODEL,
    actionItems: ['Search for official local healthcare guidance and LGBTQ+ community directories.', 'Prepare a short symptom/history note before appointments.', 'Check privacy, records, costs, and complaint routes before sharing sensitive details.'],
    reply: `${formatGreeting(profile)}

For affirming healthcare, use a practical screening approach:

1. Start with official sources.
${region ? `Look for guidance specific to ${region}, then compare it with LGBTQ+ community recommendations.` : 'Use your country or region when searching, because referral routes and patient rights vary.'}

2. Ask direct but low-risk questions before booking:
- Do you have experience supporting LGBTQ+ patients?
- Can my chosen name and pronouns be used on records and appointment notes?
- What information is shared with insurers, family members, employers, or other services?
- What are the waiting times, costs, and referral requirements?

3. Bring a concise note.
Include your goals, current medication, allergies, relevant history, and the specific decision you need help with.

4. Trust patterns, not promises.
A clinic that handles names, privacy, and questions respectfully is usually safer than one that sounds affirming but cannot explain its process.

This is general guidance, not medical advice. For diagnosis, prescriptions, urgent symptoms, or safeguarding concerns, use a qualified local professional or emergency service.`
  };
}

function buildLegalRightsGuide(profile?: UserMemoryProfile): InstantLocalReply {
  const region = profile?.locationRegion?.trim();
  return {
    model: INSTANT_MODEL,
    actionItems: ['Use official government, regulator, union, or legal-aid sources.', 'Save screenshots or copies of relevant policies.', 'Get professional advice before relying on legal rights in a dispute.'],
    reply: `${formatGreeting(profile)}

To check rights or policy protections safely:

1. Start with jurisdiction.
${region ? `Use ${region} as the starting point, then check whether national, state, local, workplace, or school rules also apply.` : 'Identify your country, state/region, workplace, school, or service provider before relying on any answer.'}

2. Prefer official sources:
- government equality or civil-rights pages
- workplace or education policies
- regulator guidance
- trade union, legal-aid, or recognised advocacy organisations

3. Search for the exact issue:
"display name at work", "email alias", "gender marker", "dress code", "harassment", "healthcare records", or "housing discrimination".

4. Keep evidence organised:
Save dates, screenshots, emails, policy wording, names of people involved, and what outcome you asked for.

This is general information, not legal advice. If money, housing, immigration, employment, safety, or formal complaints are involved, speak to a qualified local adviser before acting.`
  };
}

function buildJournalPrompt(profile?: UserMemoryProfile): InstantLocalReply {
  return {
    model: INSTANT_MODEL,
    actionItems: ['Write for five minutes without editing.', 'Name one feeling, one need, and one next action.', 'Use the mood check-in if this connects to stress or wellbeing.'],
    reply: `${formatGreeting(profile)}

Try this private reflection:

1. What happened, in plain facts?
Avoid judging yourself. Just name the situation.

2. What did I feel in my body?
For example: tight chest, tired, restless, numb, relieved, angry, hopeful.

3. What did I need in that moment?
Safety, respect, rest, clarity, privacy, reassurance, practical help, or time.

4. What is one kind next step?
Choose something small enough to do today: send one message, drink water, save a note, step away, make an appointment, or ask someone trusted to check in.

If this feeling includes immediate danger or thoughts of harming yourself, use local emergency support or Q's crisis-support option now.`
  };
}

function buildPlanningGuide(profile?: UserMemoryProfile): InstantLocalReply {
  return {
    model: INSTANT_MODEL,
    actionItems: ['Define the outcome in one sentence.', 'Split the next step into a 10-minute action.', 'Decide what information must be verified before acting.'],
    reply: `${formatGreeting(profile)}

Here is a simple private planning frame:

1. Outcome:
Write the result you want in one sentence.

2. Constraints:
List anything that matters: safety, privacy, money, time, documents, people involved, or emotional capacity.

3. Options:
Choose three possible routes: the easiest, the safest, and the strongest.

4. First action:
Pick one step that takes less than 10 minutes.

5. Verification:
If this involves healthcare, law, money, housing, employment, or safeguarding, verify with an official source or qualified local support before relying on it.`
  };
}

export function generateInstantLocalReply(prompt: string, profile?: UserMemoryProfile): InstantLocalReply | null {
  const trimmed = prompt.trim();
  if (!trimmed) return null;

  const matched = INTENT_PATTERNS.find(({ pattern }) => pattern.test(trimmed));
  if (!matched) return null;

  switch (matched.intent) {
    case 'hr_email':
      return buildHrEmail(profile);
    case 'boundaries':
      return buildBoundariesGuide(profile);
    case 'healthcare':
      return buildHealthcareGuide(profile);
    case 'legal_rights':
      return buildLegalRightsGuide(profile);
    case 'journal':
      return buildJournalPrompt(profile);
    case 'planning':
      return buildPlanningGuide(profile);
    default:
      return null;
  }
}
