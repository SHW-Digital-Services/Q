export function hasPremium(subscription: { status: string; current_period_end?: string | null } | null, role?: string, now = Date.now()) {
  return role === 'staff' || role === 'partner_admin' || !!(subscription?.status === 'ACTIVE' && (!subscription.current_period_end || Date.parse(subscription.current_period_end) > now));
}

export function validSnapshot(payload:unknown):boolean {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
  const string=(v:unknown,max=100000)=>typeof v==='string'&&v.length<=max;
  const tags=(v:unknown)=>Array.isArray(v)&&v.length<=30&&v.every(t=>string(t,80));
  const rating=(v:unknown)=>Number.isInteger(v)&&Number(v)>=1&&Number(v)<=5;
  const date=(v:unknown)=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v));
  return Object.entries(payload).every(([kind,items])=>['journal','moods','guides','chat','programmes','preferences'].includes(kind)&&Array.isArray(items)&&items.length<=10000&&items.every(v=>{
    if(!v||!string(v.id,200))return false;
    if(kind==='journal')return date(v.date)&&rating(v.moodRating)&&tags(v.moodTags)&&string(v.title,1000)&&string(v.content)&&string(v.time,100)&&string(v.updatedAt,100);
    if(kind==='moods')return date(v.date)&&rating(v.rating)&&tags(v.tags||[])&&string(v.moodLabel,100)&&string(v.timestamp,100)&&(!v.note||string(v.note));
    if(kind==='guides')return string(v.title,1000)&&string(v.summary)&&string(v.category,100)&&Array.isArray(v.steps)&&v.steps.length<=500&&v.steps.every((s:any)=>s&&string(s.id,200)&&string(s.text)&&typeof s.completed==='boolean');
    if(kind==='chat')return ['user','q_ai'].includes(v.sender)&&string(v.text)&&string(v.timestamp,100);
    if(kind==='preferences')return items.length===1&&v.id==='display'&&['light','dark'].includes(v.theme)&&['en','es','fr','de','pt','it','pl','ar','hi','zh'].includes(v.language);
    const programme = programmes.find(p=>p.id===v.id);
    return !!programme&&Array.isArray(v.completed)&&v.completed.length<=programme.sessions.length&&v.completed.every((n:unknown)=>Number.isInteger(n)&&Number(n)>=0&&Number(n)<programme.sessions.length)&&v.notes&&typeof v.notes==='object'&&!Array.isArray(v.notes)&&Object.entries(v.notes).every(([k,n])=>Number.isInteger(Number(k))&&Number(k)>=0&&Number(k)<programme.sessions.length&&string(n,5000));
  }));
}

type ActivityKind = 'reflection' | 'checklist' | 'scale' | 'script' | 'sorting' | 'if-then' | 'priority-list' | 'review-grid' | 'action-choice' | 'maintenance-plan';
type ProgrammeActivity = { kind: ActivityKind; label: string; description?: string; prompt?: string; items?: string[]; options?: string[]; fields?: string[]; columns?: string[] };
type ProgrammeSession = { title: string; body: string; prompt: string; action: string; activityType?: string; activity?: ProgrammeActivity };
type Programme = { id: string; title: string; summary: string; sessions: ProgrammeSession[] };
type ProgrammeTopic = { id: string; title: string; summary: string; focus: string; outcome: string; examples: string[] };

const activitySequence: ActivityKind[] = ['reflection', 'checklist', 'scale', 'script', 'sorting', 'if-then', 'priority-list', 'review-grid', 'action-choice', 'maintenance-plan'];
const activityLabels: Record<ActivityKind, string> = {
  reflection: 'Reflection',
  checklist: 'Checklist',
  scale: 'Readiness scale',
  script: 'Script writing',
  sorting: 'Sorting map',
  'if-then': 'If-then plan',
  'priority-list': 'Priority list',
  'review-grid': 'Review grid',
  'action-choice': 'Action choice',
  'maintenance-plan': 'Maintenance plan'
};

const topics: ProgrammeTopic[] = [
  { id: 'boundaries', title: 'Boundaries that feel like you', summary: 'Identify, communicate and review a personal boundary without forcing disclosure.', focus: 'a personal boundary', outcome: 'a boundary plan you can use or adapt', examples: ['private time', 'conversation limits', 'digital replies', 'family expectations'] },
  { id: 'connection', title: 'Building a sense of connection', summary: 'Explore people, places and interests that help you feel more yourself.', focus: 'a manageable route toward connection', outcome: 'one low-pressure connection step', examples: ['trusted people', 'shared interests', 'moderated groups', 'places of ease'] },
  { id: 'confidence', title: 'Everyday confidence', summary: 'Build a personal record of strengths and practise manageable next steps.', focus: 'a confidence-building step', outcome: 'a small confidence practice you can repeat', examples: ['strengths', 'small goals', 'kind rehearsal', 'evidence of effort'] },
  { id: 'healthcare-advocacy', title: 'Healthcare self-advocacy', summary: 'Prepare appointments, ask informed questions and leave with a clear follow-up plan.', focus: 'a healthcare appointment or care decision', outcome: 'a one-page appointment and follow-up plan', examples: ['appointment goal', 'symptom notes', 'informed consent questions', 'follow-up route'] },
  { id: 'workplace-transition', title: 'Workplace identity planning', summary: 'Coordinate name, pronoun, records and communication updates at work.', focus: 'a workplace identity update', outcome: 'a practical workplace update sequence', examples: ['HR systems', 'manager support', 'email aliases', 'privacy boundaries'] },
  { id: 'coming-out-planning', title: 'Coming out and privacy planning', summary: 'Decide who, when and how to tell while keeping safety and aftercare central.', focus: 'a coming-out or privacy decision', outcome: 'a safer disclosure and aftercare plan', examples: ['safe people', 'uncertain people', 'message boundaries', 'aftercare'] },
  { id: 'digital-safety', title: 'Digital safety and privacy', summary: 'Audit your online footprint, strengthen accounts and set safer sharing boundaries.', focus: 'your digital privacy and account safety', outcome: 'a practical digital safety checklist', examples: ['public profiles', 'separate identities', 'MFA', 'block and report steps'] },
  { id: 'housing-stability', title: 'Housing stability and home safety', summary: 'Screen housing, set household boundaries and prepare practical backup options.', focus: 'housing stability and home safety', outcome: 'a housing needs and backup plan', examples: ['dealbreakers', 'roommate questions', 'tenant rights', 'backup stays'] },
  { id: 'legal-documents', title: 'Name and document change planning', summary: 'Sequence forms, evidence and agencies without losing track of paperwork.', focus: 'name and document changes', outcome: 'a document tracker and update sequence', examples: ['passport', 'driving licence', 'banks', 'certified copies'] },
  { id: 'resilience-reset', title: 'Resilience after difficult days', summary: 'Create grounding, recovery, support and reset routines for hard days.', focus: 'recovering after difficult days', outcome: 'a reset kit for future hard days', examples: ['next hour', 'minimum day', 'support text', 'comfort items'] },
  { id: 'friendship-repair', title: 'Repairing a strained friendship', summary: 'Prepare an honest repair attempt while respecting consent and limits.', focus: 'a strained friendship', outcome: 'a repair message and next-step boundary', examples: ['what happened', 'accountability', 'listening', 'space'] },
  { id: 'family-conversations', title: 'Difficult family conversations', summary: 'Plan family conversations with clearer aims, limits and exit options.', focus: 'a difficult family conversation', outcome: 'a safer conversation plan', examples: ['topics to avoid', 'support person', 'exit line', 'follow-up'] },
  { id: 'money-basics', title: 'Money basics for steadier weeks', summary: 'Build a simple picture of bills, spending pressure and next money actions.', focus: 'money basics and weekly stability', outcome: 'a small money plan for the next month', examples: ['fixed bills', 'flexible spending', 'urgent costs', 'support services'] },
  { id: 'study-rhythm', title: 'Study rhythm and motivation', summary: 'Turn study pressure into smaller sessions, cues and review habits.', focus: 'study rhythm', outcome: 'a repeatable study session pattern', examples: ['module deadlines', 'focus blocks', 'rewards', 'catch-up time'] },
  { id: 'job-search', title: 'Job search with less overwhelm', summary: 'Create a focused job-search routine with scripts, evidence and pacing.', focus: 'a job search or career move', outcome: 'a paced job-search routine', examples: ['roles', 'CV evidence', 'cover notes', 'application limits'] },
  { id: 'interview-prep', title: 'Interview preparation', summary: 'Prepare examples, access needs, questions and post-interview recovery.', focus: 'an interview', outcome: 'an interview pack and confidence plan', examples: ['STAR examples', 'questions', 'access needs', 'recovery time'] },
  { id: 'neurodivergent-energy', title: 'Neurodivergent energy planning', summary: 'Notice energy patterns and design routines around capacity, not shame.', focus: 'energy planning', outcome: 'an energy-aware week plan', examples: ['sensory load', 'transitions', 'recovery', 'minimum tasks'] },
  { id: 'sensory-comfort', title: 'Sensory comfort toolkit', summary: 'Build a toolkit for sensory strain, social recovery and safer environments.', focus: 'sensory comfort', outcome: 'a sensory toolkit and response plan', examples: ['light', 'sound', 'textures', 'exit options'] },
  { id: 'body-image', title: 'Body image and self-respect', summary: 'Practise kinder body-related choices without forcing positivity.', focus: 'body image and self-respect', outcome: 'a kinder body-care plan', examples: ['clothes', 'mirrors', 'movement', 'language'] },
  { id: 'gender-expression', title: 'Gender expression experiments', summary: 'Plan low-risk experiments with style, presentation and feedback.', focus: 'gender expression experiments', outcome: 'a low-risk expression experiment', examples: ['clothing', 'voice', 'hair', 'names'] },
  { id: 'dating-safety', title: 'Dating boundaries and safety', summary: 'Set expectations, privacy choices and exit plans before dating situations.', focus: 'dating boundaries and safety', outcome: 'a dating safety and communication plan', examples: ['profile privacy', 'meeting place', 'dealbreakers', 'check-in'] },
  { id: 'community-finding', title: 'Finding affirming community', summary: 'Explore groups and spaces with attention to safety, fit and energy.', focus: 'affirming community', outcome: 'a community exploration plan', examples: ['online spaces', 'local groups', 'moderation', 'energy cost'] },
  { id: 'crisis-aftercare', title: 'Aftercare after a crisis moment', summary: 'Create practical aftercare and support routines once immediate danger has passed.', focus: 'aftercare after a crisis moment', outcome: 'an aftercare and support plan', examples: ['basic needs', 'trusted contact', 'reduced demands', 'warning signs'] },
  { id: 'grief-change', title: 'Grief, endings and change', summary: 'Make room for grief while keeping daily life gently supported.', focus: 'grief or a major ending', outcome: 'a gentle support plan for change', examples: ['loss reminders', 'support people', 'rituals', 'daily anchors'] },
  { id: 'conflict-deescalation', title: 'Conflict de-escalation practice', summary: 'Prepare calmer responses, exit lines and repair choices for conflict.', focus: 'a conflict pattern', outcome: 'a de-escalation and repair plan', examples: ['early signs', 'pause lines', 'repair request', 'boundaries'] },
  { id: 'assertive-requests', title: 'Making assertive requests', summary: 'Turn needs into clear requests while leaving room for consent and limits.', focus: 'an assertive request', outcome: 'a clear request script and backup option', examples: ['what I need', 'why it matters', 'timing', 'fallback'] },
  { id: 'habit-reset', title: 'Gentle habit reset', summary: 'Rebuild a habit using cues, tiny steps and realistic recovery after missed days.', focus: 'a habit reset', outcome: 'a small habit loop and restart plan', examples: ['cue', 'tiny action', 'reward', 'missed-day plan'] },
  { id: 'sleep-winddown', title: 'Sleep wind-down planning', summary: 'Create a realistic evening routine around safety, comfort and reduced friction.', focus: 'sleep wind-down', outcome: 'a wind-down routine you can test', examples: ['screens', 'light', 'worries', 'morning setup'] },
  { id: 'creative-restart', title: 'Creative restart', summary: 'Reconnect with creativity through low-pressure experiments and review.', focus: 'a creative restart', outcome: 'a small creative practice', examples: ['materials', 'time box', 'sharing choice', 'inspiration'] },
  { id: 'future-planning', title: 'Future planning when life feels uncertain', summary: 'Choose grounded next steps without pretending uncertainty has disappeared.', focus: 'future planning under uncertainty', outcome: 'a flexible next-steps map', examples: ['known facts', 'open questions', 'support', 'next decisions'] }
];

function buildSessions(topic: ProgrammeTopic): ProgrammeSession[] {
  return activitySequence.map((kind, index) => {
    const label = activityLabels[kind];
    const common = {
      activityType: label,
      activity: { kind, label } as ProgrammeActivity
    };
    if (kind === 'reflection') return {
      ...common,
      title: 'Name the focus',
      body: `Start by naming what matters about ${topic.focus}. You are not committing to a big change yet; you are making the situation clearer and kinder to work with.`,
      prompt: `What is the real-life situation behind ${topic.focus}?`,
      action: `Save one sentence describing what you want ${topic.outcome} to help with.`,
      activity: { ...common.activity, prompt: `What do I want to understand about ${topic.focus}?`, description: 'Open reflection gives you room to name the situation before choosing actions.' }
    };
    if (kind === 'checklist') return {
      ...common,
      title: 'Gather what matters',
      body: `Good planning for ${topic.focus} starts with a few concrete details. Tick what is relevant today and leave anything that does not fit.`,
      prompt: 'Which pieces matter for this situation?',
      action: 'Tick the relevant pieces and notice what is missing.',
      activity: { ...common.activity, prompt: 'Select the pieces you want this course to account for.', items: topic.examples }
    };
    if (kind === 'scale') return {
      ...common,
      title: 'Check readiness',
      body: `Readiness is information, not a pass/fail score. Rate how manageable this feels before choosing the size of your next step.`,
      prompt: `How ready do I feel to work on ${topic.focus} this week?`,
      action: 'Set a readiness score and name one thing that would make it easier.',
      activity: { ...common.activity, prompt: `How manageable does ${topic.focus} feel right now?`, description: 'Use the slider to choose the size of the next step.' }
    };
    if (kind === 'script') return {
      ...common,
      title: 'Find your words',
      body: `A short script can make ${topic.focus} less abstract. Keep it plain, specific and easy to edit later.`,
      prompt: 'What words could I use?',
      action: 'Draft the words you might use privately, in writing or with someone trusted.',
      activity: { ...common.activity, fields: ['What I want to say', 'Boundary or request', 'Fallback phrase'] }
    };
    if (kind === 'sorting') return {
      ...common,
      title: 'Sort the moving parts',
      body: `Some parts of ${topic.focus} may feel safe, some uncertain and some not right for now. Sorting helps you act without treating everything as equally urgent.`,
      prompt: 'Where does each piece belong today?',
      action: 'Sort the pieces into a simple map before choosing priorities.',
      activity: { ...common.activity, prompt: 'Sort each piece into the column that fits today.', items: topic.examples, columns: ['Feels safe', 'Needs care', 'Not for now'] }
    };
    if (kind === 'if-then') return {
      ...common,
      title: 'Plan for friction',
      body: `Plans for ${topic.focus} become sturdier when they include likely obstacles. An if-then plan keeps the response ready and specific.`,
      prompt: 'What could get in the way, and how could I respond kindly?',
      action: 'Write one if-then plan for a likely obstacle.',
      activity: { ...common.activity, description: 'Pair one likely difficulty with one practical response.' }
    };
    if (kind === 'priority-list') return {
      ...common,
      title: 'Choose the order',
      body: `You do not have to do everything at once. Put the next few actions for ${topic.focus} into an order that respects energy, safety and timing.`,
      prompt: 'What should happen first, second and later?',
      action: 'Create a short priority list for the next phase.',
      activity: { ...common.activity, prompt: 'Write one action per line, in the order you want to try them.', items: [`First small step toward ${topic.outcome}`, 'Support or information to gather', 'Later step to revisit'] }
    };
    if (kind === 'review-grid') return {
      ...common,
      title: 'Review the attempt',
      body: `Review ${topic.focus} by looking for information, not perfection. What happened, what helped and what would you adjust?`,
      prompt: 'What did this attempt teach me?',
      action: 'Record one lesson and one adjustment.',
      activity: { ...common.activity, fields: ['What worked', 'What was difficult', 'What I will adjust'] }
    };
    if (kind === 'action-choice') return {
      ...common,
      title: 'Choose the next move',
      body: `The next move for ${topic.focus} can be action, practice, waiting or asking for support. Choosing deliberately still counts as progress.`,
      prompt: 'What is the right next move?',
      action: 'Choose one next move and add a reason if useful.',
      activity: { ...common.activity, prompt: 'Pick the next move that best fits today.', options: ['Do now', 'Practise first', 'Wait', 'Ask for support'] }
    };
    return {
      ...common,
      title: 'Save the maintenance plan',
      body: `Turn ${topic.outcome} into something you can revisit. Keep the useful words, support options and reminders in one place.`,
      prompt: 'What do I want future me to remember?',
      action: 'Save a maintenance note you can come back to.',
      activity: { ...common.activity, fields: ['Reminder for future me', 'Support contact or resource', 'Next revisit point'] }
    };
  });
}

export const programmes: Programme[] = topics.map(topic => ({
  id: topic.id,
  title: topic.title,
  summary: topic.summary,
  sessions: buildSessions(topic)
}));

export function journalInsights(records: Array<{ date: string; rating: number; tags: string[] }>, days: number, now = new Date()) {
  const end = now.toISOString().slice(0, 10);
  const startDate = new Date(`${end}T00:00:00Z`); startDate.setUTCDate(startDate.getUTCDate() - days + 1);
  const start = startDate.toISOString().slice(0, 10);
  const selected = records.filter(r => r.date >= start && r.date <= end);
  const dates = new Map<string, number[]>();
  const tags = new Map<string, number[]>();
  for (const record of selected) {
    dates.set(record.date, [...(dates.get(record.date) || []), record.rating]);
    for (const tag of new Set(record.tags.map(t => t.trim().toLowerCase()).filter(Boolean))) tags.set(tag, [...(tags.get(tag) || []), record.rating]);
  }
  const mean = (values: number[]) => values.length ? Math.round(values.reduce((a,b) => a+b, 0) / values.length * 10) / 10 : null;
  const daily = [...dates].sort(([a],[b]) => a.localeCompare(b)).map(([date, values]) => ({ date, average: mean(values)! }));
  return { count: selected.length, daysRecorded: dates.size, average: mean(daily.map(d => d.average)), daily,
    tags: [...tags].filter(([,v]) => v.length >= 3).map(([tag,v]) => ({ tag, count:v.length, average:mean(v) })).sort((a,b) => b.count-a.count).slice(0,12) };
}
