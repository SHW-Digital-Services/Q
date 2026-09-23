import { LifeGuide, LivedExperienceStory, CrisisResource, UserMemoryProfile, JournalEntry } from '../types';

export const DEFAULT_USER_PROFILE: UserMemoryProfile = {
  name: '',
  pronouns: '',
  identityTags: [],
  locationRegion: '',
  lifeStage: '',
  optInMemory: true,
  crmSyncConsent: true,
  savedGoals: [],
  privacyLevel: 'high'
};

const lifeGuideTopics: Array<{ title: string; category: LifeGuide['category']; summary: string; links?: { name: string; detail: string }[] }> = [
  { title: 'Finding and Vetting Affirming Healthcare Providers', category: 'healthcare', summary: 'Identify, screen and prepare for care with clinicians who respect LGBTQ+ identities.', links: [{ name: 'GLMA Provider Directory', detail: 'glma.org' }, { name: 'WPATH Directory', detail: 'wpath.org' }] },
  { title: 'Preparing for a First Gender-Affirming Care Appointment', category: 'healthcare', summary: 'Build notes, questions, support and follow-up plans for a first appointment.' },
  { title: 'Asking for a Second Opinion', category: 'healthcare', summary: 'Understand when and how to seek another clinical view without losing momentum.' },
  { title: 'Medication and Prescription Organisation', category: 'healthcare', summary: 'Track prescriptions, refills, side effects and pharmacy questions safely.' },
  { title: 'Mental Health Provider Intake Checklist', category: 'mental_health', summary: 'Screen counsellors or therapists for fit, consent, identity respect and scope.' },
  { title: 'Dysphoria Day Reset Plan', category: 'mental_health', summary: 'Create a practical plan for getting through a difficult dysphoria day with care.' },
  { title: 'Anxiety Before an Appointment', category: 'mental_health', summary: 'Reduce appointment anxiety with scripts, grounding and a clear priority list.' },
  { title: 'Building a Personal Crisis Support Map', category: 'mental_health', summary: 'Map trusted people, professional services and immediate stabilising actions.' },
  { title: 'Coming Out to One Trusted Person', category: 'social', summary: 'Choose timing, words, boundaries and aftercare for a first disclosure.' },
  { title: 'Coming Out to Family as an Adult', category: 'social', summary: 'Plan family conversations while protecting privacy, housing and emotional safety.' },
  { title: 'Setting Pronoun Boundaries', category: 'social', summary: 'Create correction scripts, ally support and limits around repeated misgendering.' },
  { title: 'Handling Unsupportive Relatives', category: 'social', summary: 'Protect yourself around difficult relatives with boundaries and exit plans.' },
  { title: 'Building Chosen Family', category: 'social', summary: 'Find, nurture and maintain supportive relationships at a manageable pace.' },
  { title: 'Joining a Community Group Safely', category: 'social', summary: 'Evaluate moderation, privacy and accessibility before joining a new group.' },
  { title: 'Navigating Dating Apps Safely', category: 'social', summary: 'Set dating-app boundaries, privacy settings and first-meeting safety plans.' },
  { title: 'Repairing a Friendship After Harm', category: 'social', summary: 'Prepare repair conversations and decide whether closeness is still healthy.' },
  { title: 'Workplace Name and Pronoun Updates', category: 'career', summary: 'Coordinate HR, IT, managers and team communication for identity updates.' },
  { title: 'Preparing a Workplace Disclosure Plan', category: 'career', summary: 'Decide what to share, with whom and through which workplace channel.' },
  { title: 'Documenting Workplace Discrimination', category: 'career', summary: 'Keep clear records and identify internal or external support routes.' },
  { title: 'Finding an Inclusive Employer', category: 'career', summary: 'Review policies, benefits, culture signals and interview questions.' },
  { title: 'Interviewing While Protecting Privacy', category: 'career', summary: 'Plan names, documents, gaps, references and disclosure choices during hiring.' },
  { title: 'Remote Work Identity Safety', category: 'career', summary: 'Manage display names, cameras, chat tools and remote-team boundaries.' },
  { title: 'Legal Name Change Planning', category: 'rights', summary: 'Sequence forms, evidence, fees and follow-up for a name change process.' },
  { title: 'Gender Marker Document Updates', category: 'rights', summary: 'Track requirements and dependencies across official records.' },
  { title: 'Understanding Local LGBTQ+ Rights', category: 'rights', summary: 'Find reliable rights information and save relevant contacts.' },
  { title: 'Reporting Hate or Harassment', category: 'rights', summary: 'Decide whether and how to report while preserving evidence and safety.' },
  { title: 'Travel Safety and Regional Rights', category: 'rights', summary: 'Prepare documents, prescriptions, contacts and risk checks before travel.', links: [{ name: 'ILGA World', detail: 'ilga.org' }, { name: 'Equaldex', detail: 'equaldex.com' }] },
  { title: 'Airport Security Preparation', category: 'rights', summary: 'Prepare documents, medications, body-scanner concerns and support contacts.' },
  { title: 'Housing Search Safety', category: 'housing', summary: 'Screen listings, landlords, roommates and neighbourhoods before committing.' },
  { title: 'Roommate Boundaries and Privacy', category: 'housing', summary: 'Set household agreements around guests, names, privacy and shared space.' },
  { title: 'Preparing for a Move', category: 'housing', summary: 'Plan documents, utilities, medication, support and moving-day safety.' },
  { title: 'Emergency Housing Backup Plan', category: 'housing', summary: 'Identify temporary stays, transport, essential documents and support routes.' },
  { title: 'Tenant Rights Preparation', category: 'housing', summary: 'Store lease records, payment proof and local advice contacts.' },
  { title: 'Living With Family While Planning Independence', category: 'housing', summary: 'Plan privacy, documents, money and timelines while sharing a home.' },
  { title: 'Digital Privacy Audit', category: 'rights', summary: 'Review public accounts, location traces, photos and linked identities.' },
  { title: 'Online Community Safety', category: 'social', summary: 'Join online spaces with moderation checks, privacy boundaries and exit plans.' },
  { title: 'Managing Social Media Disclosure', category: 'rights', summary: 'Choose what to share, who can see it and how to protect others consent.' },
  { title: 'Building a Transition Budget', category: 'housing', summary: 'Estimate costs, sort priorities and find practical support routes.' },
  { title: 'Finding Financial Support or Mutual Aid', category: 'housing', summary: 'Search for grants, community funds and support without overexposing yourself.' },
  { title: 'Preparing for a Family Gathering', category: 'social', summary: 'Plan transport, boundaries, ally support and recovery around gatherings.' },
  { title: 'Creating a Personal Safety Plan', category: 'mental_health', summary: 'Map warning signs, supports, grounding actions and professional resources.' },
  { title: 'Supporting a Partner Through Change', category: 'social', summary: 'Offer support while protecting consent, boundaries and your own wellbeing.' },
  { title: 'Exploring Identity Language Privately', category: 'mental_health', summary: 'Experiment with language, labels and expression without pressure to announce.' },
  { title: 'Trying New Clothes or Presentation', category: 'social', summary: 'Plan low-pressure experiments in expression, fit, budget and safety.' },
  { title: 'Faith or Cultural Community Conversations', category: 'social', summary: 'Prepare conversations where identity, culture, family and belief overlap.' },
  { title: 'School or University Chosen Name Requests', category: 'rights', summary: 'Navigate portals, staff contacts, records and privacy at school or university.' },
  { title: 'Healthcare Insurance Pre-Authorisation', category: 'healthcare', summary: 'Track insurer requirements, letters, referrals and appeal options.' },
  { title: 'Preparing an Appeal or Complaint', category: 'rights', summary: 'Organise evidence, timelines, desired outcomes and escalation contacts.' },
  { title: 'Making a Rest and Recovery Routine', category: 'mental_health', summary: 'Build repeatable routines for rest, overload and emotional recovery.' },
  { title: 'Planning a Joyful Milestone', category: 'social', summary: 'Mark personal progress in a way that fits your privacy, culture and safety.' }
];

export const INITIAL_LIFE_GUIDES: LifeGuide[] = lifeGuideTopics.map((topic, index) => ({
  id: `g-${index + 1}`,
  title: topic.title,
  category: topic.category,
  summary: topic.summary,
  steps: [
    { id: 's1', text: 'Clarify the goal, urgency and what would feel safe enough for the next step.', completed: false },
    { id: 's2', text: 'Gather verified information, local rules, relevant documents and any support contacts.', completed: false },
    { id: 's3', text: 'Write down your boundaries, privacy needs and the details you do not want to share.', completed: false },
    { id: 's4', text: 'Prepare a short script, checklist or question list before taking action.', completed: false },
    { id: 's5', text: 'Choose one practical next step that fits your current energy and safety.', completed: false },
    { id: 's6', text: 'Review what happened, save useful evidence and decide whether to continue, pause or get more support.', completed: false }
  ],
  keyContactsOrLinks: topic.links,
  savedOffline: false,
  updatedAt: new Date().toISOString()
}));

export const INITIAL_LIVED_EXPERIENCES: LivedExperienceStory[] = [
  {
    id: 'exp-1',
    title: 'How I navigated coming out at 28 while maintaining family boundaries',
    authorAlias: 'Taylor, 30 (They/Them)',
    tags: ['Family', 'Boundaries', 'Adult Coming Out'],
    category: 'Social & Family',
    content: 'Coming out later in young adulthood felt intimidating because everyone expected me to have it figured out. What helped most was writing down my non-negotiable boundaries before having hard conversations. I gave my family space to process while staying firm on how I deserved to be addressed.',
    adviceKeyTakeaways: [
      'Set clear boundaries before emotional conversations',
      'Give family a written letter if speaking feels overwhelming',
      'Surround yourself with affirming chosen family for post-conversation care'
    ],
    upvotes: 42,
    savedOffline: false
  },
  {
    id: 'exp-2',
    title: 'Finding a queer-friendly landlord and safe apartment hunting tips',
    authorAlias: 'Jordan, 26 (He/Him)',
    tags: ['Housing', 'Safety', 'Tenant Rights'],
    category: 'Housing & Rights',
    content: 'When looking for roommates and apartments in a new city, I asked explicit questions during viewings about community vibes and neighborhood safety. Joining local queer housing Facebook groups and Discord channels saved me from unsafe lease situations.',
    adviceKeyTakeaways: [
      'Use community-vetted housing networks over generic listings',
      'Scope out the neighborhood at night before signing a lease',
      'Know your local fair housing non-discrimination ordinances'
    ],
    upvotes: 38,
    savedOffline: false
  },
  {
    id: 'exp-3',
    title: 'Transitioning in tech: My experience updating credentials and colleagues',
    authorAlias: 'Morgan, 34 (She/Her)',
    tags: ['Workplace', 'Career', 'Trans in Tech'],
    category: 'Workplace & Identity',
    content: 'I collaborated directly with HR to set an exact rollout date. On Monday, my Slack handle, Google Workspace email, and GitHub alias were updated simultaneously. Giving team leads a short briefing script prevented awkward misgendering loops.',
    adviceKeyTakeaways: [
      'Coordinate IT handle changes in one batch window',
      'Provide a simple 1-paragraph template for managers to announce updates',
      'Focus energy on colleagues who show active respect'
    ],
    upvotes: 56,
    savedOffline: false
  },
  {
    id: 'exp-4',
    title: 'Starting therapy with an affirming counselor',
    authorAlias: 'Riley, 24 (They/Them)',
    tags: ['Mental Health', 'Therapy', 'Self-Advocacy'],
    category: 'Mental Health & Care',
    content: 'I asked potential therapists directly how they worked with LGBTQ clients and what language they used around identity. The first person was not a fit, and that was useful information rather than a failure. A short intake checklist helped me find someone who respected my pace.',
    adviceKeyTakeaways: ['Ask about experience before sharing your whole story', 'A no-pressure consultation can reveal a lot', 'You are allowed to change providers'],
    upvotes: 31,
    savedOffline: false
  },
  {
    id: 'exp-5',
    title: 'Making a first queer friend after moving cities',
    authorAlias: 'Sam, 29 (He/They)',
    tags: ['Community', 'Friendship', 'Moving'],
    category: 'Community & Connection',
    content: 'I moved for work and expected community to happen immediately. Instead, I chose one recurring event and went three times before deciding how I felt. Recognizing familiar faces made the fourth visit much less intimidating, and one casual conversation became a real friendship.',
    adviceKeyTakeaways: ['Choose a recurring activity instead of chasing perfect events', 'Give community time to grow', 'Small repeated hellos count as progress'],
    upvotes: 44,
    savedOffline: false
  },
  {
    id: 'exp-6',
    title: 'Finding confidence at my first support group',
    authorAlias: 'Avery, 37 (She/Her)',
    tags: ['Support Group', 'Confidence', 'Community'],
    category: 'Community & Connection',
    content: 'I was nervous that I would say the wrong thing, so I listened during my first meeting. Nobody required a dramatic introduction. Being able to attend quietly and leave with a resource list helped me return the next week with less fear.',
    adviceKeyTakeaways: ['Listening is a valid way to participate', 'Ask about confidentiality before sharing', 'You can leave whenever you need to'],
    upvotes: 27,
    savedOffline: false
  },
  {
    id: 'exp-7',
    title: 'Setting pronoun boundaries with a well-meaning parent',
    authorAlias: 'Casey, 22 (They/Them)',
    tags: ['Family', 'Pronouns', 'Boundaries'],
    category: 'Social & Family',
    content: 'My parent was trying but kept asking me to correct everyone for them. I explained that support also meant practicing privately and not making me manage every room. We agreed on a simple correction phrase and a pause when conversations became too much.',
    adviceKeyTakeaways: ['Support includes shared responsibility', 'Agree on a practical correction script', 'Take breaks before resentment builds'],
    upvotes: 35,
    savedOffline: false
  },
  {
    id: 'exp-8',
    title: 'Using a chosen name safely at school',
    authorAlias: 'Noah, 19 (He/Him)',
    tags: ['School', 'Chosen Name', 'Safety'],
    category: 'Education & Identity',
    content: 'Before asking every teacher to use my chosen name, I checked the student portal, email settings, and housing rules. I started with the staff members I trusted and carried a short note explaining what I needed. Planning the order made the change feel manageable.',
    adviceKeyTakeaways: ['Check where legal information may still appear', 'Start with a trusted staff member', 'Write down exactly what you are requesting'],
    upvotes: 29,
    savedOffline: false
  },
  {
    id: 'exp-9',
    title: 'Managing dysphoria on a difficult day',
    authorAlias: 'Lee, 31 (They/She)',
    tags: ['Dysphoria', 'Self-Care', 'Grounding'],
    category: 'Mental Health & Care',
    content: 'On hard days I stopped treating dysphoria like a problem I had to solve before I could continue. I kept a small list of neutral clothes, comforting music, and people I could text. The goal became getting through the next hour with care, not forcing myself to feel positive.',
    adviceKeyTakeaways: ['Use neutral goals when positivity feels unreachable', 'Prepare comfort options before a hard day', 'Reach out without needing a perfect explanation'],
    upvotes: 62,
    savedOffline: false
  },
  {
    id: 'exp-10',
    title: 'Preparing for an affirming healthcare appointment',
    authorAlias: 'Jamie, 41 (He/Him)',
    tags: ['Healthcare', 'Preparation', 'Advocacy'],
    category: 'Healthcare Navigation',
    content: 'I wrote my questions before the appointment and brought a trusted person on speakerphone. Having my medication list and preferred language on one page meant I did not have to explain everything while anxious. The visit was still imperfect, but I left knowing what to ask next.',
    adviceKeyTakeaways: ['Bring a written question list', 'Keep medication and history notes current', 'A support person can help you remember details'],
    upvotes: 48,
    savedOffline: false
  },
  {
    id: 'exp-11',
    title: 'Learning to ask a doctor for a second opinion',
    authorAlias: 'Drew, 27 (They/Them)',
    tags: ['Healthcare', 'Second Opinion', 'Self-Advocacy'],
    category: 'Healthcare Navigation',
    content: 'I used to think asking questions would make me seem difficult. When a treatment plan did not feel right, I asked what alternatives existed and requested time to consider them. The clinician was supportive, and I learned that informed consent includes taking time.',
    adviceKeyTakeaways: ['Ask about alternatives and risks', 'You can request time before deciding', 'Questions are part of informed care'],
    upvotes: 39,
    savedOffline: false
  },
  {
    id: 'exp-12',
    title: 'Coming out to a sibling with a low-pressure plan',
    authorAlias: 'Em, 25 (She/They)',
    tags: ['Coming Out', 'Family', 'Communication'],
    category: 'Social & Family',
    content: 'I chose a text conversation because it gave both of us time to respond thoughtfully. I included what support looked like and what topics were off limits. Their first reply was awkward, but the follow-up conversation was kinder than I expected.',
    adviceKeyTakeaways: ['Choose the format that helps you feel safest', 'Explain the support you need', 'One awkward response does not define the whole relationship'],
    upvotes: 33,
    savedOffline: false
  },
  {
    id: 'exp-13',
    title: 'Building a private transition budget',
    authorAlias: 'Chris, 33 (He/Him)',
    tags: ['Finances', 'Planning', 'Transition'],
    category: 'Practical Planning',
    content: 'I made a private budget for appointments, documents, transport, and a small emergency fund. Separating needs from future goals stopped every expense from feeling urgent. I also found a local nonprofit that helped with one cost I could not cover alone.',
    adviceKeyTakeaways: ['List recurring and one-time costs separately', 'Build a small emergency buffer where possible', 'Look for community grants and mutual aid'],
    upvotes: 41,
    savedOffline: false
  },
  {
    id: 'exp-14',
    title: 'Finding inclusive clothing that feels like me',
    authorAlias: 'Alex, 28 (They/Them)',
    tags: ['Self-Expression', 'Clothing', 'Confidence'],
    category: 'Identity & Expression',
    content: 'I started with one outfit that felt comfortable rather than trying to reinvent my whole wardrobe. A friend helped me shop online and made the process playful instead of stressful. Small experiments taught me more about my style than waiting for certainty.',
    adviceKeyTakeaways: ['Start with comfort and one small experiment', 'Use a supportive friend or private fitting option', 'Your style can change over time'],
    upvotes: 36,
    savedOffline: false
  },
  {
    id: 'exp-15',
    title: 'Handling misgendering without abandoning my day',
    authorAlias: 'Morgan, 30 (She/Her)',
    tags: ['Misgendering', 'Boundaries', 'Resilience'],
    category: 'Workplace & Identity',
    content: 'I created three responses: a quick correction, a private follow-up, and a choice to conserve energy. Having options helped me stop judging myself for not correcting every single person. I also asked one colleague to be an ally when I was too tired to explain.',
    adviceKeyTakeaways: ['Prepare different responses for different energy levels', 'You do not owe every mistake a lesson', 'Ask trusted allies for practical support'],
    upvotes: 53,
    savedOffline: false
  },
  {
    id: 'exp-16',
    title: 'Making a remote workplace feel safer',
    authorAlias: 'Devon, 35 (They/Them)',
    tags: ['Workplace', 'Remote Work', 'Boundaries'],
    category: 'Workplace & Identity',
    content: 'I updated my display name and pronouns in stages, starting with the tools my team used most. I asked my manager to keep personal details out of broad announcements. A predictable meeting routine and one supportive teammate made remote work feel less isolating.',
    adviceKeyTakeaways: ['Update high-visibility tools in a deliberate order', 'Set boundaries around what managers share', 'Create regular connection with a trusted teammate'],
    upvotes: 46,
    savedOffline: false
  },
  {
    id: 'exp-17',
    title: 'Finding queer joy through a creative hobby',
    authorAlias: 'Robin, 26 (She/They)',
    tags: ['Queer Joy', 'Creativity', 'Community'],
    category: 'Community & Connection',
    content: 'I joined a queer craft night expecting to make something impressive. Instead, the best part was being around people who understood why small acts of self-expression mattered. I left with a half-finished project and much more energy than I arrived with.',
    adviceKeyTakeaways: ['Choose activities that do not require disclosure', 'Let connection matter more than performance', 'Joy is a valid reason to seek community'],
    upvotes: 58,
    savedOffline: false
  },
  {
    id: 'exp-18',
    title: 'Navigating dating apps with clearer boundaries',
    authorAlias: 'Taylor, 32 (They/Them)',
    tags: ['Dating', 'Boundaries', 'Safety'],
    category: 'Relationships & Safety',
    content: 'I wrote down my boundaries before matching and stopped treating discomfort as something I had to negotiate away. I used public first meetings and told a friend my plans. The biggest change was realizing that leaving a conversation early is not rude when I feel unsafe.',
    adviceKeyTakeaways: ['Decide boundaries before pressure arrives', 'Use a check-in plan for first meetings', 'Trust discomfort and leave when needed'],
    upvotes: 64,
    savedOffline: false
  },
  {
    id: 'exp-19',
    title: 'Repairing a friendship after a hurtful comment',
    authorAlias: 'Jules, 38 (He/They)',
    tags: ['Friendship', 'Repair', 'Communication'],
    category: 'Relationships & Safety',
    content: 'I explained specifically what hurt and what I needed going forward. My friend apologized and changed their behavior, which made repair possible. I also accepted that an apology without change would not have been enough.',
    adviceKeyTakeaways: ['Name the behavior and its impact clearly', 'Look for consistent change, not only words', 'Repair requires care from both people'],
    upvotes: 37,
    savedOffline: false
  },
  {
    id: 'exp-20',
    title: 'Creating a safety plan for family gatherings',
    authorAlias: 'Pat, 45 (They/Them)',
    tags: ['Family', 'Safety Planning', 'Boundaries'],
    category: 'Social & Family',
    content: 'Before a large gathering, I arranged my own transport, chose an exit time, and told one relative what support looked like. I kept a private room available for decompression. Planning an exit made it easier to stay present without feeling trapped.',
    adviceKeyTakeaways: ['Keep control of your transport when possible', 'Set an exit time before arriving', 'Plan a quiet place to reset'],
    upvotes: 51,
    savedOffline: false
  },
  {
    id: 'exp-21',
    title: 'Finding community as an LGBTQ parent',
    authorAlias: 'Reese, 39 (She/Her)',
    tags: ['Parenting', 'Community', 'Family'],
    category: 'Social & Family',
    content: 'I felt out of place in both general parenting groups and younger queer spaces. A local LGBTQ family network gave me room to talk about parenting without explaining my identity first. It helped me build support for myself as well as for my child.',
    adviceKeyTakeaways: ['Look for groups that match more than one part of your life', 'You deserve support beyond your role as a parent', 'Community can be specific and still welcoming'],
    upvotes: 43,
    savedOffline: false
  },
  {
    id: 'exp-22',
    title: 'Updating documents one step at a time',
    authorAlias: 'Kai, 29 (He/Him)',
    tags: ['Legal Documents', 'Planning', 'Identity'],
    category: 'Rights & Documents',
    content: 'The paperwork felt impossible until I made a checklist and handled one agency at a time. I saved copies of every submission and noted the next follow-up date. Progress was slower than I wanted, but the checklist kept one delay from becoming total discouragement.',
    adviceKeyTakeaways: ['Break paperwork into a dated checklist', 'Keep copies and confirmation numbers', 'A slow process is still progress'],
    upvotes: 49,
    savedOffline: false
  },
  {
    id: 'exp-23',
    title: 'Asking a roommate to respect private space',
    authorAlias: 'Mia, 23 (She/Her)',
    tags: ['Housing', 'Roommates', 'Privacy'],
    category: 'Housing & Rights',
    content: 'My roommate kept bringing guests into shared spaces during medical recovery. I asked for specific quiet hours rather than trying to explain every detail. A written agreement made the request easier to remember and less personal during later disagreements.',
    adviceKeyTakeaways: ['Make requests specific and observable', 'Put shared agreements in writing', 'Privacy needs are legitimate household needs'],
    upvotes: 28,
    savedOffline: false
  },
  {
    id: 'exp-24',
    title: 'Using mutual aid without feeling guilty',
    authorAlias: 'Ash, 36 (They/Them)',
    tags: ['Mutual Aid', 'Support', 'Community Care'],
    category: 'Community & Care',
    content: 'I used to think accepting help meant I had failed. A mutual aid organizer reminded me that care moves in different directions at different times. I accepted support for transport and later contributed time when my situation was steadier.',
    adviceKeyTakeaways: ['Receiving help is part of community care', 'Ask clearly for the specific support you need', 'Contribute when and how you are able'],
    upvotes: 55,
    savedOffline: false
  },
  {
    id: 'exp-25',
    title: 'Recovering after an exhausting pride event',
    authorAlias: 'Nico, 21 (They/He)',
    tags: ['Pride', 'Rest', 'Self-Care'],
    category: 'Community & Care',
    content: 'I wanted to attend everything and ended up overwhelmed. The next year I picked one event, packed water and ear protection, and scheduled a quiet morning afterward. I enjoyed the day more because I stopped treating rest as missing out.',
    adviceKeyTakeaways: ['Plan recovery time as part of the event', 'Bring sensory and physical comfort items', 'You do not need to attend everything'],
    upvotes: 34,
    savedOffline: false
  },
  {
    id: 'exp-26',
    title: 'Finding language for an evolving identity',
    authorAlias: 'Sage, 27 (They/Them)',
    tags: ['Identity', 'Self-Discovery', 'Language'],
    category: 'Identity & Expression',
    content: 'I worried that choosing a label meant I could never change it. Writing a private list of words that felt close, maybe, and not for me gave me space to explore without announcing anything. I now use the language that helps me communicate today.',
    adviceKeyTakeaways: ['Labels can be tools rather than permanent contracts', 'Explore privately before explaining publicly', 'It is okay to use different language over time'],
    upvotes: 61,
    savedOffline: false
  },
  {
    id: 'exp-27',
    title: 'Supporting a partner through a major change',
    authorAlias: 'Alexis, 34 (She/Her)',
    tags: ['Relationships', 'Support', 'Communication'],
    category: 'Relationships & Safety',
    content: 'I wanted to be supportive without becoming my partner’s only support. We talked about practical help, emotional check-ins, and where I needed boundaries. Encouraging them to build their own care network made our relationship stronger instead of more fragile.',
    adviceKeyTakeaways: ['Ask what support is wanted instead of guessing', 'Keep your own support network active', 'Love and boundaries can exist together'],
    upvotes: 45,
    savedOffline: false
  },
  {
    id: 'exp-28',
    title: 'Making a first appointment after a long wait',
    authorAlias: 'Theo, 30 (He/They)',
    tags: ['Healthcare', 'Anxiety', 'Preparation'],
    category: 'Healthcare Navigation',
    content: 'After waiting months, I was afraid the appointment had to go perfectly. I brought a short summary and chose the three questions that mattered most. Even though we did not cover everything, I left with a follow-up plan and permission to keep asking questions.',
    adviceKeyTakeaways: ['Prioritize your top three questions', 'Appointments do not have to cover everything at once', 'Ask for a clear follow-up plan'],
    upvotes: 40,
    savedOffline: false
  },
  {
    id: 'exp-29',
    title: 'Protecting privacy while sharing online',
    authorAlias: 'River, 25 (They/Them)',
    tags: ['Online Safety', 'Privacy', 'Community'],
    category: 'Digital Safety',
    content: 'I wanted online community but did not want my personal details searchable. I created a separate profile, avoided posting location patterns, and took conversations slowly before moving off-platform. The extra steps let me participate with more confidence.',
    adviceKeyTakeaways: ['Separate community profiles from identifying accounts', 'Avoid sharing routine and location details', 'Build trust gradually before moving conversations elsewhere'],
    upvotes: 47,
    savedOffline: false
  },
  {
    id: 'exp-30',
    title: 'Celebrating a small milestone privately',
    authorAlias: 'Fin, 40 (They/She)',
    tags: ['Milestones', 'Queer Joy', 'Reflection'],
    category: 'Identity & Expression',
    content: 'Not every milestone was safe to celebrate publicly, so I created a private ritual with a favorite meal and a journal entry. Marking the moment helped me see how much had changed even when other people did not notice. Quiet joy still counts.',
    adviceKeyTakeaways: ['Celebrate in ways that match your safety and comfort', 'Record progress so you can revisit it later', 'Private joy is real and meaningful'],
    upvotes: 59,
    savedOffline: false
  }
];

export const CRISIS_RESOURCES: CrisisResource[] = [
  {
    id: 'cr-1',
    name: 'Trans Lifeline',
    description: 'Peer support services run by and for trans individuals. Operating with a strict anti-carceral care standard (no non-consensual active rescue).',
    phoneOrText: '877-565-8860 (US) / 877-330-6366 (CA)',
    website: 'translifeline.org',
    region: 'US & Canada',
    availability: '24/7',
    category: 'trans'
  },
  {
    id: 'cr-2',
    name: 'The Trevor Project',
    description: '24/7 crisis intervention and suicide prevention services for LGBTQ young people under 25.',
    phoneOrText: 'Call 1-866-488-7386 or Text START to 678-678',
    website: 'thetrevorproject.org',
    region: 'International / US',
    availability: '24/7',
    category: 'youth'
  },
  {
    id: 'cr-3',
    name: 'LGBT National Help Center',
    description: 'Free & confidential peer-counseling, information, and local resources across the life spectrum.',
    phoneOrText: '888-843-4564',
    website: 'lgbthotline.org',
    region: 'United States',
    availability: 'Mon-Fri 1pm-9pm PST / Sat 9am-2pm PST',
    category: 'general'
  },
  {
    id: 'cr-4',
    name: 'MindOut LGBTQ Mental Health',
    description: 'Mental health service run by and for LGBTQ people providing online support, advocacy, and advice.',
    phoneOrText: 'Online Chat Available',
    website: 'mindout.org.uk',
    region: 'UK & Global',
    availability: 'Check schedule online',
    category: 'mental_health'
  }
];

export const INITIAL_JOURNAL_ENTRIES: JournalEntry[] = [];
