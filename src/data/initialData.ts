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

const lifeGuideTopics: Array<{ title: string; category: LifeGuide['category']; summary: string; steps: string[]; links?: { name: string; detail: string }[] }> = [
  { title: 'Finding and Vetting Affirming Healthcare Providers', category: 'healthcare', summary: 'Identify, screen and prepare for care with clinicians who respect LGBTQ+ identities.', steps: ['Search provider directories, local LGBTQ+ organisations and clinic websites for explicit LGBTQ+ or gender-care experience.', 'Check the provider is licensed, in network if relevant, accessible for you and accepting new patients.', 'Prepare two screening questions about names, pronouns, confidentiality, gender-affirming care experience or referral pathways.', 'Call or message the practice before sharing sensitive history and notice whether staff respond respectfully.', 'Book the first appointment only after you know what records, ID, insurance details or support person options are needed.'], links: [{ name: 'GLMA Provider Directory', detail: 'glma.org' }, { name: 'WPATH Directory', detail: 'wpath.org' }, { name: 'NHS gender dysphoria information', detail: 'nhs.uk' }] },
  { title: 'Preparing for a First Gender-Affirming Care Appointment', category: 'healthcare', summary: 'Build notes, questions, support and follow-up plans for a first appointment.', steps: ['Write a one-page summary of your goals, current medicines, allergies, health conditions and the name/pronouns you want used.', 'Choose the top three questions you need answered so the appointment does not depend on remembering everything under stress.', 'Bring or request copies of referral letters, blood tests, previous diagnoses, medication history and relevant mental-health notes.', 'Ask what the provider can do now, what needs referral, what waiting times apply and how follow-up will be arranged.', 'Before leaving, confirm the next step in writing, including prescriptions, tests, referrals, portal messages or review dates.'] },
  { title: 'Asking for a Second Opinion', category: 'healthcare', summary: 'Understand when and how to seek another clinical view without losing momentum.', steps: ['Name the exact concern: unclear diagnosis, treatment risk, poor communication, denied care or a plan that does not match your goals.', 'Ask the current clinician for the reasoning, alternatives, benefits, risks and what would change their recommendation.', 'Request copies of notes, test results and referral letters so another clinician can review the same evidence.', 'Find out whether your health system, insurer or clinic requires a referral, authorisation or specific second-opinion form.', 'Keep current care safe while you wait by asking what symptoms, side effects or delays should trigger urgent contact.'] },
  { title: 'Medication and Prescription Organisation', category: 'healthcare', summary: 'Track prescriptions, refills, side effects and pharmacy questions safely.', steps: ['Create a private medication list with dose, timing, prescriber, pharmacy, refill date and what each medicine is for.', 'Set refill reminders early enough to cover weekends, travel, shortages, postal delays or appointment gaps.', 'Track side effects, missed doses and mood or body changes in plain language to discuss with a clinician or pharmacist.', 'Ask the pharmacy how names, privacy, delivery labels and notification messages appear before collecting sensitive medication.', 'Do not change dose or stop medication without qualified advice unless emergency instructions say to seek urgent help.'] },
  { title: 'Mental Health Provider Intake Checklist', category: 'mental_health', summary: 'Screen counsellors or therapists for fit, consent, identity respect and scope.', steps: ['List what you want support with, such as anxiety, dysphoria, family conflict, trauma, grief, relationships or identity exploration.', 'Ask the provider about LGBTQ+ experience, confidentiality, crisis processes, fees, cancellations and whether sessions are online or in person.', 'Check whether the provider works within their professional scope and whether they avoid conversion practices or pressure to disclose.', 'Use the first session to test fit: respectful language, consent, pacing, cultural humility and practical safety planning.', 'Decide after the intake whether to continue, request adjustments, seek a different provider or add peer support.'], links: [{ name: 'Mind LGBTQIA+ mental health support', detail: 'mind.org.uk' }] },
  { title: 'Dysphoria Day Reset Plan', category: 'mental_health', summary: 'Create a practical plan for getting through a difficult dysphoria day with care.', steps: ['Name the day as difficult without making yourself solve your whole identity or future immediately.', 'Choose one body-neutral comfort option: loose clothing, shower change, blanket, music, walk, low-light room or grounding object.', 'Reduce exposure to mirrors, photos, comments, apps or tasks that make the feeling sharper if avoidance helps short term.', 'Message one trusted person with a simple script such as "Hard dysphoria day. Can you distract me or check in later?"', 'Postpone irreversible decisions and make a small aftercare plan for food, rest and sleep.'] },
  { title: 'Anxiety Before an Appointment', category: 'mental_health', summary: 'Reduce appointment anxiety with scripts, grounding and a clear priority list.', steps: ['Write the appointment purpose, time, location, travel plan and what you need to bring in one place.', 'Pick the three points you most need to say and put them at the top of your notes or phone.', 'Prepare a sentence for overwhelm, such as "I am anxious and may need a moment to read my notes."', 'Arrive with a grounding plan: water, breathing, headphones, support person, quiet waiting spot or permission to step outside.', 'After the appointment, record what happened before anxiety blurs the details and schedule any follow-up tasks.'] },
  { title: 'Building a Personal Crisis Support Map', category: 'mental_health', summary: 'Map trusted people, professional services and immediate stabilising actions.', steps: ['Write early warning signs that mean you need support before things become urgent.', 'List three personal contacts with what each can realistically do, such as listen, visit, help with transport or stay on the phone.', 'Add professional and crisis routes for your country, including emergency services for immediate danger.', 'Create a short "first 20 minutes" plan with safer location, grounding action, removing hazards and contacting support.', 'Store the map somewhere easy to reach offline and review it when you are calm.'], links: [{ name: 'Q crisis resources', detail: 'Use the in-app country support directory' }, { name: 'Mind crisis and mental health contacts', detail: 'mind.org.uk' }] },
  { title: 'Coming Out to One Trusted Person', category: 'social', summary: 'Choose timing, words, boundaries and aftercare for a first disclosure.', steps: ['Choose someone whose past behaviour suggests they can respect privacy, listen and avoid turning the moment into gossip.', 'Decide what you are sharing now, what you are not ready to discuss and whether you want advice, celebration or quiet support.', 'Pick a format that gives you control: message, letter, call, walk, private room or planned meet-up.', 'Use a direct script that includes your identity, name or pronouns if relevant, and what you need from them next.', 'Plan aftercare for the hour after: friend, journal, comfort activity or exit from the conversation.'], links: [{ name: 'Trevor Project Coming Out Handbook', detail: 'thetrevorproject.org' }] },
  { title: 'Coming Out to Family as an Adult', category: 'social', summary: 'Plan family conversations while protecting privacy, housing and emotional safety.', steps: ['Check practical dependencies first, including housing, money, childcare, documents, immigration, faith community and emergency contact risks.', 'Decide whether one conversation, a letter, a staged approach or telling one safer relative first gives you more control.', 'Write boundaries in advance: names, pronouns, privacy, topics off limits and what happens if the conversation turns hostile.', 'Prepare answers for likely questions without accepting pressure to debate your identity or prove yourself.', 'Arrange support afterwards and give yourself permission to pause contact if the response is harmful.'] },
  { title: 'Setting Pronoun Boundaries', category: 'social', summary: 'Create correction scripts, ally support and limits around repeated misgendering.', steps: ['Choose the pronouns, name and title you want used in each setting and whether any exceptions are needed for safety.', 'Prepare a quick correction for mistakes, such as "It is they, thanks," and a private follow-up for repeated issues.', 'Ask one ally to help correct others so the burden is not always on you.', 'For work, school or services, request record and system updates through the proper channel and keep the request in writing.', 'If misgendering becomes deliberate or repeated, document examples and consider a complaint, manager, adviser or support organisation.'], links: [{ name: 'Stonewall pronouns guide', detail: 'stonewall.org.uk' }, { name: 'Acas gender reassignment discrimination', detail: 'acas.org.uk' }] },
  { title: 'Handling Unsupportive Relatives', category: 'social', summary: 'Protect yourself around difficult relatives with boundaries and exit plans.', steps: ['Identify which behaviours are upsetting, unsafe or non-negotiable, rather than trying to fix every belief at once.', 'Choose a short boundary statement and repeat it without adding long explanations under pressure.', 'Set limits around visits, phone calls, group chats, photos, deadnaming, religious debate or comments about your body.', 'Create an exit plan before contact: transport, safe room, friend on standby or a reason to end the call.', 'After each interaction, note whether contact needs reducing, restructuring or support from another family member.'] },
  { title: 'Building Chosen Family', category: 'social', summary: 'Find, nurture and maintain supportive relationships at a manageable pace.', steps: ['List the kinds of connection you want: friendship, elders, peers, practical help, celebration, accountability or quiet companionship.', 'Look for recurring spaces where trust can build slowly, such as hobby groups, support groups, volunteering or community events.', 'Start with small repeated contact rather than forcing instant closeness or disclosure.', 'Notice reciprocity: people who respect time, privacy, boundaries and differences in identity or culture.', 'Maintain the relationships with check-ins, shared rituals and honest repair when harm happens.'] },
  { title: 'Joining a Community Group Safely', category: 'social', summary: 'Evaluate moderation, privacy and accessibility before joining a new group.', steps: ['Check who runs the group, its rules, moderation style, safeguarding policy and whether it is identity-specific or open to allies.', 'Look for privacy basics before sharing: photos policy, attendance lists, online visibility and confidentiality expectations.', 'Attend first as a listener if that feels safer and note exits, transport, accessibility and group culture.', 'Share only the level of personal information you would be comfortable being remembered by strangers.', 'After attending, decide whether the space felt respectful, manageable and worth returning to.'] },
  { title: 'Navigating Dating Apps Safely', category: 'social', summary: 'Set dating-app boundaries, privacy settings and first-meeting safety plans.', steps: ['Separate dating visibility from work, family or high-risk accounts if being identified would create problems.', 'Decide what identity, HIV/STI, trans status, relationship goals or location details you want to share and when.', 'Use app privacy and reporting tools, block pressure quickly and avoid moving off-platform before trust is earned.', 'For first meetings, choose a public place, arrange your own transport and tell a trusted person your plan.', 'Trust discomfort: end chats, dates or physical contact without needing to justify your boundary.'], links: [{ name: 'eSafety LGBTQIA+ online safety', detail: 'esafety.gov.au' }] },
  { title: 'Repairing a Friendship After Harm', category: 'social', summary: 'Prepare repair conversations and decide whether closeness is still healthy.', steps: ['Name the specific behaviour and impact instead of trying to litigate the whole friendship.', 'Decide what repair would look like: apology, changed language, privacy respect, space, accountability or a practical boundary.', 'Choose a calm format where both people can pause rather than escalating in public or in a group chat.', 'Listen for responsibility and changed behaviour, not just defensiveness, guilt or pressure to move on fast.', 'Give yourself permission to rebuild slowly, redefine closeness or step back if the harm continues.'] },
  { title: 'Workplace Name and Pronoun Updates', category: 'career', summary: 'Coordinate HR, IT, managers and team communication for identity updates.', steps: ['Make a list of systems that display your name or pronouns: HR, payroll, email, chat, badge, rota, learning tools and directories.', 'Ask HR or a manager who can update each system, what evidence is needed and what can be changed before legal documents update.', 'Agree who is told, when they are told, and the exact wording of any team message.', 'Request confidentiality for previous names, gender history and medical details unless you explicitly consent to sharing.', 'Check all visible systems after rollout and send a single correction list for anything missed.'], links: [{ name: 'Acas workplace transition guidance', detail: 'acas.org.uk' }] },
  { title: 'Preparing a Workplace Disclosure Plan', category: 'career', summary: 'Decide what to share, with whom and through which workplace channel.', steps: ['Clarify your goal: records update, leave for appointments, team awareness, dress code, facilities, safety or general authenticity.', 'Review employer policies on equality, harassment, grievance, data protection, transition and flexible working.', 'Choose the smallest first audience that can help, such as HR, a trusted manager, union rep or employee network contact.', 'Write what may be shared with others and what must stay confidential.', 'Schedule follow-up dates so support is not a one-off conversation.'] },
  { title: 'Documenting Workplace Discrimination', category: 'career', summary: 'Keep clear records and identify internal or external support routes.', steps: ['Create a private dated log with what happened, where, who was involved, witnesses and any immediate impact.', 'Save copies of emails, chat messages, rota changes, performance notes, policies and screenshots without breaching confidentiality rules.', 'Separate facts from interpretation so the record is useful if reviewed by HR, a union, Acas or an adviser.', 'Report through the safest internal route if appropriate and ask for confirmation of next steps in writing.', 'Get timely advice before deadlines for grievances, tribunal claims or complaints pass.'], links: [{ name: 'Acas protected characteristics', detail: 'acas.org.uk' }, { name: 'GOV.UK discrimination at work', detail: 'gov.uk' }] },
  { title: 'Finding an Inclusive Employer', category: 'career', summary: 'Review policies, benefits, culture signals and interview questions.', steps: ['Check public policies, benefits, gender-neutral parental leave, healthcare coverage, dress codes and anti-harassment commitments.', 'Look for evidence beyond slogans: staff networks, transparent reporting, inclusive recruitment and manager training.', 'Review whether systems support chosen names, pronouns, remote work, accessibility and confidential HR records.', 'Prepare interview questions about team culture, flexibility, wellbeing and how concerns are handled.', 'Notice warning signs: evasive answers, jokes about identity, no complaint route or pressure to be a diversity symbol.'] },
  { title: 'Interviewing While Protecting Privacy', category: 'career', summary: 'Plan names, documents, gaps, references and disclosure choices during hiring.', steps: ['Decide which name, pronouns, email and phone number you want recruiters to use at each stage.', 'Plan how to handle legal-name checks, background screening, certificates or references that may reveal older information.', 'Use a concise answer for employment gaps or document mismatch without disclosing identity details you do not want to share.', 'Ask when identity documents are required and who can see them before sending sensitive files.', 'Save job adverts, interview notes and communications in case you need to challenge unfair treatment.'] },
  { title: 'Remote Work Identity Safety', category: 'career', summary: 'Manage display names, cameras, chat tools and remote-team boundaries.', steps: ['Audit work tools for display names, handles, profile photos, pronoun fields, meeting names and automatic email signatures.', 'Decide camera, background, voice, clothing and household privacy boundaries before recurring meetings.', 'Ask managers to keep identity details out of broad announcements unless you approve the wording and timing.', 'Use private messages or meeting norms to correct names and pronouns without turning every call into a discussion.', 'Create a connection plan with at least one trusted colleague so remote work does not become isolating.'] },
  { title: 'Legal Name Change Planning', category: 'rights', summary: 'Sequence forms, evidence, fees and follow-up for a name change process.', steps: ['Check the official name-change route for your country or nation; UK deed poll rules differ from Scotland and overseas residence rules.', 'Decide whether you need an enrolled public record or an unenrolled/private route accepted by most organisations.', 'Make a priority list: passport, driving licence, bank, employer, tax, health records, education records, utilities and subscriptions.', 'Keep certified copies, posting receipts, reference numbers and dates for every organisation you contact.', 'Update records in an order that gives you usable photo ID early and reduces mismatches.'], links: [{ name: 'GOV.UK deed poll', detail: 'gov.uk' }, { name: 'GOV.UK passport name or gender change', detail: 'gov.uk' }] },
  { title: 'Gender Marker Document Updates', category: 'rights', summary: 'Track requirements and dependencies across official records.', steps: ['List each document separately because passport, driving licence, birth record, visa, school and work systems may have different evidence rules.', 'Check official guidance before paying for documents or letters, especially where a Gender Recognition Certificate or clinician letter may matter.', 'Decide which document is most useful to update first for daily life and which can wait.', 'Keep copies of evidence and note whether the organisation returns originals safely.', 'After each update, check downstream systems such as travel bookings, payroll, banking, insurance and health records.'], links: [{ name: 'GOV.UK passport gender change', detail: 'gov.uk' }, { name: 'GOV.UK driving licence details', detail: 'gov.uk' }] },
  { title: 'Understanding Local LGBTQ+ Rights', category: 'rights', summary: 'Find reliable rights information and save relevant contacts.', steps: ['Start with official government, equality body, regulator or recognised advice organisation pages for your country or region.', 'Check separate areas of life: work, housing, healthcare, education, public services, family law, hate crime and travel.', 'Note what is protected, what is unclear, what evidence is needed and which deadlines apply.', 'Save contact details for local advice services, legal clinics, unions, ombudsman routes or LGBTQ+ organisations.', 'Recheck before acting because law and policy can change quickly, especially across borders.'], links: [{ name: 'ILGA World legal maps', detail: 'ilga.org' }, { name: 'Citizens Advice discrimination', detail: 'citizensadvice.org.uk' }] },
  { title: 'Reporting Hate or Harassment', category: 'rights', summary: 'Decide whether and how to report while preserving evidence and safety.', steps: ['Move to safety first and use emergency services if there is immediate danger.', 'Write down what happened, exact words used, time, location, people present and whether identity was targeted.', 'Preserve evidence such as messages, photos, CCTV location, usernames, medical notes or witness details.', 'Choose a reporting route: police, platform, employer, school, housing provider, transport operator or specialist hate-crime service.', 'Ask for a reference number and support options, then decide what follow-up feels safe.'], links: [{ name: 'GOV.UK report hate crime', detail: 'gov.uk' }, { name: 'Citizens Advice hate crime guidance', detail: 'citizensadvice.org.uk' }] },
  { title: 'Travel Safety and Regional Rights', category: 'rights', summary: 'Prepare documents, prescriptions, contacts and risk checks before travel.', steps: ['Read official travel advice for the destination, including country-specific LGBTQ+ notes and local laws.', 'Check whether names, gender markers, passport, visas, tickets and accommodation bookings match closely enough to avoid avoidable friction.', 'Carry medication in original packaging where possible and check import rules before travelling with hormones, needles or controlled medicines.', 'Save offline copies of emergency contacts, embassy details, insurance, accommodation, prescriptions and return travel.', 'Plan privacy choices for apps, dating, social media posts and public affection based on local risk.'], links: [{ name: 'GOV.UK LGBT foreign travel advice', detail: 'gov.uk' }, { name: 'ILGA World maps', detail: 'ilga.org' }] },
  { title: 'Airport Security Preparation', category: 'rights', summary: 'Prepare documents, medications, body-scanner concerns and support contacts.', steps: ['Make sure ticket details match the ID you will use for travel, even if other documents are in transition.', 'Pack medication, letters, needles, prosthetics or medical devices so they can be explained calmly if asked.', 'Check airport and airline guidance on screening, liquids, medication, mobility aids and support services before the trip.', 'Prepare a short phrase for screening concerns, such as requesting a private screening or explaining a medical item.', 'After travel, record any incident details quickly if you need to complain or request support.'], links: [{ name: 'TSA travel tips', detail: 'tsa.gov' }, { name: 'GOV.UK travel advice', detail: 'gov.uk' }] },
  { title: 'Housing Search Safety', category: 'housing', summary: 'Screen listings, landlords, roommates and neighbourhoods before committing.', steps: ['Check listing legitimacy, deposit rules, tenancy type and whether the landlord or agent is traceable before sending money.', 'View the area at different times if possible and consider transport, lighting, access, neighbours and nearby support.', 'Ask practical roommate or landlord questions about guests, privacy, repairs, shared spaces and communication style.', 'Keep identity details private until needed and avoid sending sensitive documents through insecure channels.', 'Get agreements in writing before signing, paying or moving belongings.'], links: [{ name: 'Citizens Advice housing', detail: 'citizensadvice.org.uk' }, { name: 'GOV.UK rental discrimination guidance', detail: 'gov.uk' }] },
  { title: 'Roommate Boundaries and Privacy', category: 'housing', summary: 'Set household agreements around guests, names, privacy and shared space.', steps: ['List the household issues that need agreement: names, pronouns, visitors, bedrooms, bathrooms, post, noise, photos and shared costs.', 'Make requests specific and observable, such as quiet hours, knock-before-entering, or no photos in shared spaces without consent.', 'Put agreements in writing so later conflict is about the agreement, not your identity.', 'Agree how to raise concerns before resentment builds, including private messages or house meetings.', 'If privacy or safety is repeatedly ignored, plan support, mediation, tenancy advice or an exit route.'] },
  { title: 'Preparing for a Move', category: 'housing', summary: 'Plan documents, utilities, medication, support and moving-day safety.', steps: ['Create a moving checklist for tenancy, deposits, ID, utilities, internet, address changes, prescriptions and key dates.', 'Pack sensitive documents, medication, chargers and a first-night bag separately where you can control them.', 'Choose what name appears on labels, bookings, movers, deliveries and building entry systems.', 'Tell only trusted people the new address until you decide your privacy boundaries.', 'After moving, update emergency contacts, healthcare providers and trusted support routes.'] },
  { title: 'Emergency Housing Backup Plan', category: 'housing', summary: 'Identify temporary stays, transport, essential documents and support routes.', steps: ['List safe places you could go for one night, three nights and two weeks, including friends, shelters, hotels or community services.', 'Prepare a discreet go-bag or document folder with ID, medication, bank card, charger, keys, essential clothes and prescriptions.', 'Save transport options, taxi numbers, night bus routes, emergency funds and trusted contacts offline.', 'Check whether local LGBTQ+ or domestic-abuse organisations can advise without forcing a report.', 'If danger is immediate, leave first and use emergency services or crisis housing routes from a safer place.'] },
  { title: 'Tenant Rights Preparation', category: 'housing', summary: 'Store lease records, payment proof and local advice contacts.', steps: ['Keep your tenancy agreement, inventory, deposit protection details, rent receipts, repair requests and landlord messages in one folder.', 'Photograph condition, repairs and safety issues with dates before and after reporting them.', 'Check local rights before withholding rent, leaving early, changing locks or making formal complaints.', 'Use written repair or discrimination complaints with clear dates, impact and the outcome you want.', 'Contact local advice, council, tenant union or housing charity before deadlines or eviction steps escalate.'], links: [{ name: 'Citizens Advice tenant guidance', detail: 'citizensadvice.org.uk' }, { name: 'Shelter housing advice', detail: 'shelter.org.uk' }] },
  { title: 'Living With Family While Planning Independence', category: 'housing', summary: 'Plan privacy, documents, money and timelines while sharing a home.', steps: ['Identify what must stay private at home: documents, devices, clothes, medication, mail, journals, finances or relationships.', 'Secure essential documents and accounts first, including ID, bank access, passwords, recovery email and phone plan.', 'Build a realistic budget for deposit, rent, transport, food, medication, phone and emergency costs.', 'Choose one trusted outside contact who knows your plan and can help if the household becomes unsafe.', 'Break independence into dated steps so waiting does not feel like being stuck forever.'] },
  { title: 'Digital Privacy Audit', category: 'rights', summary: 'Review public accounts, location traces, photos and linked identities.', steps: ['Search your own name, usernames, phone number and email to see what is easy to connect.', 'Review social media privacy settings, old profile photos, tagged posts, location history and public friend lists.', 'Turn on two-step verification for important accounts and update recovery emails or phone numbers you control.', 'Separate public, professional and private identities where being linked could create risk.', 'Repeat the audit before coming out publicly, moving, dating, travelling or applying for jobs.'], links: [{ name: 'NCSC social media safety', detail: 'ncsc.gov.uk' }] },
  { title: 'Online Community Safety', category: 'social', summary: 'Join online spaces with moderation checks, privacy boundaries and exit plans.', steps: ['Check who moderates the space, what rules exist, how harassment is handled and whether screenshots or reposting are banned.', 'Use a username, profile photo and bio that match the level of identifiability you want.', 'Observe before sharing personal history, location, workplace, school, medical details or family conflict.', 'Use block, report and mute tools early when pressure, sexual comments, scams or identity invalidation appear.', 'Keep one offline support route so online conflict does not become your only source of care.'], links: [{ name: 'eSafety online LGBTQIA+ guidance', detail: 'esafety.gov.au' }, { name: 'NCSC social media safety', detail: 'ncsc.gov.uk' }] },
  { title: 'Managing Social Media Disclosure', category: 'rights', summary: 'Choose what to share, who can see it and how to protect others consent.', steps: ['Decide the audience before posting: close friends, selected list, professional network, public account or no online announcement.', 'Check tags, old posts, workplace links, family visibility and location metadata before sharing identity-related updates.', 'Write the post offline first and remove details that could expose someone else without consent.', 'Prepare moderation boundaries: who can comment, whether to block, and whether a friend can help monitor replies.', 'After posting, avoid repeatedly checking reactions if it harms your wellbeing.'] },
  { title: 'Building a Transition Budget', category: 'housing', summary: 'Estimate costs, sort priorities and find practical support routes.', steps: ['List likely one-off and recurring costs, such as appointments, travel, documents, clothing, grooming, medication, counselling or time off work.', 'Sort each cost as essential now, helpful soon, future goal or optional joy so everything does not feel equally urgent.', 'Check which costs insurance, NHS, employer benefits, student support, grants or community funds may cover.', 'Build a small emergency buffer before non-urgent purchases if housing, health or safety could be affected.', 'Review the budget monthly and update it when prices, timelines or priorities change.'] },
  { title: 'Finding Financial Support or Mutual Aid', category: 'housing', summary: 'Search for grants, community funds and support without overexposing yourself.', steps: ['Define the exact need and amount: rent gap, travel, document fee, medication, clothing, food, device or emergency stay.', 'Search local LGBTQ+, disability, student, faith, union, community foundation and mutual-aid routes before public fundraising.', 'Check eligibility, deadlines, evidence requirements and whether your identity details will be public or stored.', 'Prepare a short privacy-preserving request that explains need, amount and timing without unnecessary personal history.', 'Track applications and support received so follow-up, gratitude and future budgeting stay manageable.'] },
  { title: 'Preparing for a Family Gathering', category: 'social', summary: 'Plan transport, boundaries, ally support and recovery around gatherings.', steps: ['Decide your attendance goal: brief appearance, meaningful conversation, celebration, duty, or seeing one safer person.', 'Arrange independent transport or a clear exit time if the gathering could become hostile or exhausting.', 'Tell one ally what support looks like, such as correcting names, changing subject or walking outside with you.', 'Prepare boundary phrases for questions about identity, body, dating, politics, faith or medical care.', 'Schedule recovery afterwards instead of expecting yourself to be fine immediately.'] },
  { title: 'Creating a Personal Safety Plan', category: 'mental_health', summary: 'Map warning signs, supports, grounding actions and professional resources.', steps: ['Write your personal warning signs, including thoughts, body cues, behaviours or situations that mean support is needed.', 'List coping actions that do not rely on willpower alone: safer room, cold water, breathing, music, walk, food or grounding object.', 'Choose people and services for different levels of need: distraction, company, practical help, professional support and emergency help.', 'Reduce access to immediate means of harm where possible and ask someone trusted to help if needed.', 'Review the plan regularly and use emergency support if there is immediate danger.'], links: [{ name: 'Mind crisis support information', detail: 'mind.org.uk' }] },
  { title: 'Supporting a Partner Through Change', category: 'social', summary: 'Offer support while protecting consent, boundaries and your own wellbeing.', steps: ['Ask what support your partner wants instead of assuming: listening, logistics, affirmation, privacy, advocacy or space.', 'Clarify what can be shared with friends, family, workplaces or online so you do not out them accidentally.', 'Keep your own support network active without making your partner manage your feelings about their change.', 'Use regular check-ins about language, intimacy, public affection, appointments and emotional load.', 'Notice when specialist support, counselling or peer groups would help both of you.'], links: [{ name: 'Mind supporting someone LGBTQIA+', detail: 'mind.org.uk' }] },
  { title: 'Exploring Identity Language Privately', category: 'mental_health', summary: 'Experiment with language, labels and expression without pressure to announce.', steps: ['Create a private list of words that feel right, wrong, close, curious or not ready yet.', 'Try language in low-risk spaces such as journalling, private notes, anonymous communities or with one trusted person.', 'Separate identity language from deadlines; you do not need certainty before you deserve respect.', 'Notice body, mood and safety responses when using names, pronouns, labels or descriptions.', 'Revisit the list later and let language change without treating earlier words as failure.'], links: [{ name: 'Trevor Project LGBTQ identity resources', detail: 'thetrevorproject.org' }] },
  { title: 'Trying New Clothes or Presentation', category: 'social', summary: 'Plan low-pressure experiments in expression, fit, budget and safety.', steps: ['Choose one experiment instead of rebuilding your whole presentation at once: colour, fit, hair, accessory, scent or silhouette.', 'Set a budget and use return policies, second-hand options or supportive shopping help if money or privacy matters.', 'Try items in a setting that matches your safety level: private room, trusted friend, quiet walk, event or online order.', 'Take notes on comfort, movement, confidence, sensory needs and whether the item feels like yours.', 'Keep what helps, alter what almost works and let go of items that only serve someone else expectations.'] },
  { title: 'Faith or Cultural Community Conversations', category: 'social', summary: 'Prepare conversations where identity, culture, family and belief overlap.', steps: ['Name what you want from the conversation: understanding, boundaries, continued participation, no debate, or practical safety.', 'Choose whether to speak with one trusted person, a leader, family member, peer or outside affirming faith/cultural group first.', 'Prepare a short explanation of what support looks like without accepting pressure to defend your whole identity.', 'Set limits around theology, shame, public disclosure, conversion pressure or being used as a lesson for others.', 'Have an affirming support route ready afterwards, especially if the response affects belonging or family ties.'] },
  { title: 'School or University Chosen Name Requests', category: 'rights', summary: 'Navigate portals, staff contacts, records and privacy at school or university.', steps: ['Check official student policies for chosen name, pronouns, ID cards, email, learning platforms, housing and legal records.', 'Identify the safest first contact: tutor, student services, registrar, welfare, LGBTQ+ society or disability/support office.', 'Ask where your legal name may still appear, such as finance, exam boards, visa records, parents, accommodation or medical forms.', 'Submit requests in writing and keep screenshots of portals before and after changes.', 'Tell specific staff how to handle mistakes, class registers, group work, field trips and emergency contacts.'] },
  { title: 'Healthcare Insurance Pre-Authorisation', category: 'healthcare', summary: 'Track insurer requirements, letters, referrals and appeal options.', steps: ['Get the exact insurer or plan policy for the care requested, including diagnosis codes, letters, referral rules and covered providers.', 'Create a checklist of required documents, who must write them and whether dates or wording must match the policy.', 'Ask the clinic who submits pre-authorisation, how long review usually takes and how denials are communicated.', 'Keep copies of every letter, portal message, call reference, fax confirmation and deadline.', 'If denied, request the written reason and appeal process before paying out of pocket or abandoning care.'] },
  { title: 'Preparing an Appeal or Complaint', category: 'rights', summary: 'Organise evidence, timelines, desired outcomes and escalation contacts.', steps: ['Identify the decision or behaviour you are challenging and the specific outcome you want: apology, correction, service, refund, review or policy change.', 'Build a dated timeline with documents, messages, names, reference numbers and what each contact said.', 'Read the organisation complaint or appeal rules so your letter answers the right criteria and deadline.', 'Write clearly, include evidence, explain impact and request a written response by the stated route.', 'Escalate to an ombudsman, regulator, advice service, union, legal clinic or advocacy organisation if the first stage fails.'] },
  { title: 'Making a Rest and Recovery Routine', category: 'mental_health', summary: 'Build repeatable routines for rest, overload and emotional recovery.', steps: ['Notice the signs that you need recovery: irritability, shutdown, scrolling, body tension, tears, numbness or missed basics.', 'Choose a short routine for low-energy days: food, water, medication, hygiene, light, movement and one comforting input.', 'Reduce demands by postponing non-urgent messages, chores or decisions where possible.', 'Add identity-affirming comfort if it helps: music, clothes, voice note, community content, prayer, art or safe connection.', 'Review what restored energy and make the routine easier to repeat next time.'], links: [{ name: 'Mind LGBTQIA+ self-care', detail: 'mind.org.uk' }] },
  { title: 'Planning a Joyful Milestone', category: 'social', summary: 'Mark personal progress in a way that fits your privacy, culture and safety.', steps: ['Name the milestone in your own words, whether it is public, private, tiny, practical, spiritual or relational.', 'Choose a celebration scale that fits safety and energy: meal, photo, letter, outfit, playlist, walk, gift, ritual or gathering.', 'Decide who, if anyone, gets to know and what details stay private.', 'Record why the moment matters so future you can revisit the progress.', 'Plan gentle aftercare, because joy can still bring vulnerability, grief or tiredness.'] }
];

export const INITIAL_LIFE_GUIDES: LifeGuide[] = lifeGuideTopics.map((topic, index) => ({
  id: `g-${index + 1}`,
  title: topic.title,
  category: topic.category,
  summary: topic.summary,
  steps: topic.steps.map((step, stepIndex) => ({ id: `s${stepIndex + 1}`, text: step, completed: false })),
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
