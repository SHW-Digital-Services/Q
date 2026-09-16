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
    return programmes.some(p=>p.id===v.id)&&Array.isArray(v.completed)&&v.completed.length<=4&&v.completed.every((n:unknown)=>Number.isInteger(n)&&Number(n)>=0&&Number(n)<4)&&v.notes&&typeof v.notes==='object'&&!Array.isArray(v.notes)&&Object.entries(v.notes).every(([k,n])=>/^[0-3]$/.test(k)&&string(n,5000));
  }));
}

export const programmes = [
  { id: 'boundaries', title: 'Boundaries that feel like you', summary: 'Four short sessions to identify, communicate and review a personal boundary.', sessions: [
    { title: 'Notice what matters', body: 'Think of a recent interaction that left you comfortable or drained. Notice what you needed, without judging yourself.', prompt: 'What would I like more or less of in that situation?', action: 'Choose one boundary you would like to explore.' },
    { title: 'Find your words', body: 'A boundary can describe what you will do. Keep it clear and specific: “If the conversation becomes personal, I will take a break.”', prompt: 'How could I express my boundary in my own words?', action: 'Write one sentence you could use.' },
    { title: 'Choose a safe next step', body: 'You decide whether, when and how to communicate. You can practise privately or talk to someone you trust first. You do not owe anyone disclosure.', prompt: 'What would help me feel supported, and is now a safe time?', action: 'Choose a small step, or deliberately choose to wait.' },
    { title: 'Reflect and adjust', body: 'Boundaries may need practice and revision. Another person’s reaction does not determine whether your needs matter.', prompt: 'What worked, what felt difficult, and what would I change?', action: 'Record one thing to carry forward.' }
  ] },
  { id: 'connection', title: 'Building a sense of connection', summary: 'Explore the people, places and interests that help you feel more yourself.', sessions: [
    { title: 'Define connection', body: 'Connection can mean one trusted person, a shared interest or a space where you feel at ease. There is no required social pace.', prompt: 'When do I feel accepted and able to be myself?', action: 'List two qualities you value in a connection.' },
    { title: 'Follow an interest', body: 'Shared interests can offer a gentle starting point. Consider a book group, creative activity, walking group or online community with clear moderation.', prompt: 'Which interest would I enjoy sharing?', action: 'Identify one group to learn more about without committing.' },
    { title: 'Plan a small hello', body: 'Decide what you feel comfortable sharing. For a new group, check the setting and privacy expectations and give yourself permission to leave.', prompt: 'What would make a first interaction manageable?', action: 'Draft an introduction or question.' },
    { title: 'Review your experience', body: 'You can decide a group is not for you. Notice moments of ease as well as discomfort, and make room for rest.', prompt: 'Would I like to return, try something different or pause?', action: 'Choose your next step at your own pace.' }
  ] },
  { id: 'confidence', title: 'Everyday confidence', summary: 'Build a personal record of strengths and practise manageable steps.', sessions: [
    { title: 'Recognise a strength', body: 'Strengths can be quiet: asking for help, being curious, resting or showing care. Think about something you managed recently.', prompt: 'What helped me get through it?', action: 'Name one strength you used.' },
    { title: 'Make the goal smaller', body: 'Pick something within your control. A small, specific step is easier to review than a demand to feel confident.', prompt: 'What is a manageable version of something I want to try?', action: 'Choose a step that takes around ten minutes.' },
    { title: 'Practise kindly', body: 'Try your step when you feel ready. You may adapt, stop or ask for support. Progress does not require ignoring discomfort.', prompt: 'What support or preparation would help?', action: 'Try your step or write a plan for trying it.' },
    { title: 'Keep the evidence', body: 'Review effort and learning as well as results. Confidence can fluctuate; a difficult day does not erase earlier progress.', prompt: 'What did I learn, and what would I tell a friend in my position?', action: 'Write a reminder to revisit.' }
  ] }
];

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
