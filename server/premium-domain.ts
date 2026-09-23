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

type ProgrammeSession = { title: string; body: string; prompt: string; action: string; activityType?: string };
type Programme = { id: string; title: string; summary: string; sessions: ProgrammeSession[] };

const courseCompleter = (title: string): ProgrammeSession[] => [
  { title: 'Set your baseline', body: `Pause before continuing ${title}. Name what already feels clear, what feels uncertain and what would make the work feel manageable today.`, prompt: 'What am I bringing into this course right now?', action: 'Write a short baseline note before choosing your next step.', activityType: 'Self-check' },
  { title: 'Choose your support conditions', body: 'Good personal work includes conditions that make it easier to stop, pause or ask for help. Decide what support, privacy and timing you need.', prompt: 'What conditions would make this safer or easier to practise?', action: 'List two support conditions you want in place.', activityType: 'Planning' },
  { title: 'Practise a low-risk version', body: 'Try the smallest useful version of the skill before using it in a higher-pressure setting. Rehearsal counts as progress.', prompt: 'What would a low-risk rehearsal look like?', action: 'Choose one rehearsal you can do privately or with someone trusted.', activityType: 'Practice' },
  { title: 'Handle friction', body: 'Most plans meet some friction. Prepare for hesitation, disagreement, fatigue or a change in circumstances without treating that as failure.', prompt: 'What could get in the way, and how could I respond kindly?', action: 'Write one if-then plan for a likely obstacle.', activityType: 'Scenario' },
  { title: 'Review the evidence', body: 'Look for evidence of effort, learning and self-respect, not only a perfect outcome. Decide what information this attempt gave you.', prompt: 'What did I learn from this attempt or rehearsal?', action: 'Record one lesson and one adjustment.', activityType: 'Review' },
  { title: 'Create your maintenance plan', body: `Turn ${title} into something you can revisit. Save the phrases, contacts, reminders or next actions that still feel useful.`, prompt: 'What do I want future me to remember?', action: 'Save a one-paragraph maintenance note.', activityType: 'Maintenance' }
];

const baseProgrammes: Programme[] = [
  { id: 'boundaries', title: 'Boundaries that feel like you', summary: 'Ten-step course to identify, communicate and review a personal boundary.', sessions: [
    { title: 'Notice what matters', body: 'Think of a recent interaction that left you comfortable or drained. Notice what you needed, without judging yourself.', prompt: 'What would I like more or less of in that situation?', action: 'Choose one boundary you would like to explore.', activityType: 'Reflection' },
    { title: 'Find your words', body: 'A boundary can describe what you will do. Keep it clear and specific: “If the conversation becomes personal, I will take a break.”', prompt: 'How could I express my boundary in my own words?', action: 'Write one sentence you could use.', activityType: 'Script writing' },
    { title: 'Choose a safe next step', body: 'You decide whether, when and how to communicate. You can practise privately or talk to someone you trust first. You do not owe anyone disclosure.', prompt: 'What would help me feel supported, and is now a safe time?', action: 'Choose a small step, or deliberately choose to wait.', activityType: 'Safety check' },
    { title: 'Reflect and adjust', body: 'Boundaries may need practice and revision. Another person’s reaction does not determine whether your needs matter.', prompt: 'What worked, what felt difficult, and what would I change?', action: 'Record one thing to carry forward.', activityType: 'Review' }
  ] },
  { id: 'connection', title: 'Building a sense of connection', summary: 'Explore the people, places and interests that help you feel more yourself.', sessions: [
    { title: 'Define connection', body: 'Connection can mean one trusted person, a shared interest or a space where you feel at ease. There is no required social pace.', prompt: 'When do I feel accepted and able to be myself?', action: 'List two qualities you value in a connection.' },
    { title: 'Follow an interest', body: 'Shared interests can offer a gentle starting point. Consider a book group, creative activity, walking group or online community with clear moderation.', prompt: 'Which interest would I enjoy sharing?', action: 'Identify one group to learn more about without committing.' },
    { title: 'Plan a small hello', body: 'Decide what you feel comfortable sharing. For a new group, check the setting and privacy expectations and give yourself permission to leave.', prompt: 'What would make a first interaction manageable?', action: 'Draft an introduction or question.' },
    { title: 'Review your experience', body: 'You can decide a group is not for you. Notice moments of ease as well as discomfort, and make room for rest.', prompt: 'Would I like to return, try something different or pause?', action: 'Choose your next step at your own pace.' }
  ] },
  { id: 'confidence', title: 'Everyday confidence', summary: 'Course: build a personal record of strengths and practise manageable steps.', sessions: [
    { title: 'Recognise a strength', body: 'Strengths can be quiet: asking for help, being curious, resting or showing care. Think about something you managed recently.', prompt: 'What helped me get through it?', action: 'Name one strength you used.' },
    { title: 'Make the goal smaller', body: 'Pick something within your control. A small, specific step is easier to review than a demand to feel confident.', prompt: 'What is a manageable version of something I want to try?', action: 'Choose a step that takes around ten minutes.' },
    { title: 'Practise kindly', body: 'Try your step when you feel ready. You may adapt, stop or ask for support. Progress does not require ignoring discomfort.', prompt: 'What support or preparation would help?', action: 'Try your step or write a plan for trying it.' },
    { title: 'Keep the evidence', body: 'Review effort and learning as well as results. Confidence can fluctuate; a difficult day does not erase earlier progress.', prompt: 'What did I learn, and what would I tell a friend in my position?', action: 'Write a reminder to revisit.' }
  ] },
  { id: 'healthcare-advocacy', title: 'Healthcare self-advocacy', summary: 'Course: prepare appointments, ask informed questions and leave with a clear follow-up plan.', sessions: [
    { title: 'Clarify the appointment goal', body: 'Decide whether you need information, a referral, documentation, medication discussion or a care-plan review.', prompt: 'What do I need this appointment to achieve?', action: 'Write one appointment goal and your top three questions.' },
    { title: 'Build your one-page brief', body: 'Include current medication, relevant history, names and pronouns, symptoms, access needs and privacy concerns.', prompt: 'What information do I want ready without relying on memory?', action: 'Draft a one-page appointment note.' },
    { title: 'Prepare informed-consent questions', body: 'Ask about benefits, risks, alternatives, timelines, costs and what happens if you wait.', prompt: 'What do I need to understand before deciding?', action: 'Choose three informed-consent questions.' },
    { title: 'Leave with next steps', body: 'Before leaving, confirm who is responsible, when to follow up, warning signs and how results will arrive.', prompt: 'What must be clear before I leave?', action: 'Create a follow-up checklist.' }
  ] },
  { id: 'workplace-transition', title: 'Workplace identity planning', summary: 'Course: coordinate name, pronoun, records and communication updates at work.', sessions: [
    { title: 'Audit the workplace landscape', body: 'Review policies, HR systems, manager support, IT ownership and legal protections in your location.', prompt: 'Where is support likely, and where might friction appear?', action: 'Create a workplace readiness map.' },
    { title: 'Choose the update sequence', body: 'Separate public display changes, legal records, payroll, benefits, email aliases, signatures and directories.', prompt: 'Which changes matter now, and which can wait?', action: 'List desired changes in priority order.' },
    { title: 'Write the request', body: 'Keep the request practical: what should change, when, who owns it, and what should remain private.', prompt: 'What do HR or IT need to do?', action: 'Draft the HR or IT request.' },
    { title: 'Maintain and document', body: 'After rollout, record what changed, what still needs fixing and any incidents that need follow-up.', prompt: 'What follow-up protects my wellbeing and rights?', action: 'Create a two-week maintenance checklist.' }
  ] },
  { id: 'coming-out-planning', title: 'Coming out and privacy planning', summary: 'Course: decide who, when and how to tell while keeping safety and aftercare central.', sessions: [
    { title: 'Separate desire from pressure', body: 'Coming out is not a duty. Name what you want and what privacy still protects you.', prompt: 'What do I want for myself apart from pressure?', action: 'Write a private intention statement.' },
    { title: 'Map people and risk', body: 'Consider emotional safety, housing, money, work, caregiving, culture and social networks.', prompt: 'Who is safest, uncertain or unsafe to tell right now?', action: 'Create a three-zone people map.' },
    { title: 'Write the message', body: 'Name what you are sharing, what support looks like, what questions are welcome and what is off limits.', prompt: 'What do I need them to understand first?', action: 'Draft your message and boundary line.' },
    { title: 'Plan aftercare', body: 'Arrange transport, a supportive contact, a calming activity and a way to end the conversation.', prompt: 'How will I care for myself afterwards?', action: 'Set one support check-in and one exit option.' }
  ] },
  { id: 'digital-safety', title: 'Digital safety and privacy', summary: 'Course: audit your online footprint, strengthen accounts and set safer sharing boundaries.', sessions: [
    { title: 'Audit your footprint', body: 'Search for what is publicly connected to your names, handles, photos, workplace and location.', prompt: 'What information about me is easy to connect online?', action: 'List accounts and details needing attention.' },
    { title: 'Separate identities intentionally', body: 'Use different usernames, photos, emails and posting patterns where separation matters.', prompt: 'Where would separation reduce risk or stress?', action: 'Choose one account boundary to improve.' },
    { title: 'Strengthen access', body: 'Prioritise email, banking, cloud storage and social accounts with unique passwords and MFA.', prompt: 'Which accounts would cause most harm if accessed?', action: 'Secure two high-priority accounts.' },
    { title: 'Set a response plan', body: 'Prepare block, report, screenshot and trusted-contact steps for unwanted contact.', prompt: 'What is my response plan for harassment or unwanted contact?', action: 'Save the plan and one support contact.' }
  ] },
  { id: 'housing-stability', title: 'Housing stability and home safety', summary: 'Course: screen housing, set household boundaries and prepare practical backup options.', sessions: [
    { title: 'Define needs and dealbreakers', body: 'Include money, privacy, lease terms, commute, identity respect, accessibility and emergency options.', prompt: 'What do I need from a home to feel stable enough?', action: 'Write needs, preferences and dealbreakers.' },
    { title: 'Screen listings and roommates', body: 'Ask about bills, guests, repairs, privacy, neighbourhood and how conflict is handled.', prompt: 'What must I know before signing or moving in?', action: 'Create a screening question list.' },
    { title: 'Prepare documents and rights', body: 'Keep lease copies, payment records, communication logs and local tenant-rights contacts.', prompt: 'Which documents and advice contacts do I need saved?', action: 'Save key documents and one advice contact.' },
    { title: 'Build a backup plan', body: 'Identify temporary stays, transport, essential documents, medication, pets and financial support options.', prompt: 'What would I need if I had to leave quickly?', action: 'Build a housing backup checklist.' }
  ] },
  { id: 'legal-documents', title: 'Name and document change planning', summary: 'Course: sequence forms, evidence and agencies without losing track of paperwork.', sessions: [
    { title: 'Map document dependencies', body: 'Legal name, gender marker, passport, driving licence, banks, payroll and healthcare may affect one another.', prompt: 'Which documents affect the most areas of my life?', action: 'Create a document dependency map.' },
    { title: 'Gather requirements', body: 'Use official sources and note fees, forms, evidence, processing time and certified-copy needs.', prompt: 'What does each agency require from me?', action: 'Record requirements for two document targets.' },
    { title: 'Create the tracker', body: 'Keep dates, submissions, receipts, confirmation numbers and follow-up reminders together.', prompt: 'How will I track every submission and response?', action: 'Set up a folder and tracking table.' },
    { title: 'Close the loop', body: 'After one document changes, update dependent records and archive proof safely.', prompt: 'Which records now need the updated document?', action: 'Mark completed steps and list dependent updates.' }
  ] },
  { id: 'resilience-reset', title: 'Resilience after difficult days', summary: 'Course: create grounding, recovery, support and reset routines for hard days.', sessions: [
    { title: 'Stabilise the next hour', body: 'Focus on food, water, medication, warmth, sensory comfort, rest or one safe person.', prompt: 'What would make the next hour safer or easier?', action: 'Choose one immediate stabilising action.' },
    { title: 'Lower the demand', body: 'Reduce tasks to essentials and use neutral goals when positivity is out of reach.', prompt: 'Which demands can be paused, reduced or delegated?', action: 'Make a minimum-viable-day list.' },
    { title: 'Reach out simply', body: 'A support request can be short: I am having a hard day; could you check in later?', prompt: 'Who can receive a small, clear support request?', action: 'Draft a low-explanation support text.' },
    { title: 'Prepare a future reset kit', body: 'Save comfort items, contacts, scripts, reminders and practical steps before the next hard day.', prompt: 'What should be ready before the next difficult day?', action: 'Create or update your reset kit.' }
  ] }
];

export const programmes = baseProgrammes.map(programme => ({
  ...programme,
  summary: programme.summary.replace(/^Four short sessions/, 'Ten-step course').replace(/^Explore /, 'Ten-step course: explore '),
  sessions: programme.sessions.length >= 10 ? programme.sessions : [...programme.sessions, ...courseCompleter(programme.title)].slice(0, 10)
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
