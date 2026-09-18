# Q Platform: Purpose, Capabilities, Audience and Community Impact

**Prepared:** 18 September 2026  
**Basis:** Review of the source code and documentation in this repository.  
**Scope:** Product and community-impact report. Features described below are represented in the repository; this review does not establish their current production availability, independently audit security, or demonstrate measured wellbeing outcomes.

## 1. Executive overview

Q, also described as **Q Intelligence**, is a privacy-conscious wellbeing, personal-reflection and life-guidance platform designed around LGBT+ experiences. It brings together an AI assistant, practical life guides, journalling, mood tracking, lived-experience content, structured personal-development programmes and access to crisis-support information.

Its central purpose is to help someone move from an uncertain or difficult situation towards a manageable next step. A person might use Q to find words for a boundary, prepare questions for an appointment, reflect on their identity, plan a conversation at work, or explore ways to build supportive friendships.

Q's potential value comes from combining these activities in one place. A conversation can lead to a practical guide, a journal reflection and an action that the person revisits later. This creates continuity between understanding a situation and doing something about it.

The platform's design also recognises that privacy is part of usefulness. Local AI processing, a discreet Notes interface, app-lock controls and optional cloud continuity give users choices about how they interact with sensitive material. These controls have specific limits, explained below.

Q could improve users' lives by supporting confidence, self-understanding, everyday decision-making and access to appropriate support. These are plausible benefits of its design, rather than outcomes already proven by this repository. Q is a self-help and guidance tool, not a clinical treatment service or emergency responder.

## 2. Who Q is for

### Primary audience

The principal audience is LGBT+ adults, including lesbian, gay, bisexual, trans, queer, non-binary and other people whose identities or experiences sit within the wider community. People questioning their identity may also find its reflective tools useful. The repository's Terms require users to be **at least 18 or the age of majority in their jurisdiction**; Q should therefore not be presented as a service for children.

| Audience or situation | What the person may want | How Q could help |
| --- | --- | --- |
| Adults exploring identity or expression | Space to reflect without needing an immediate label or public disclosure | Private writing, conversational prompts and relevant guides |
| People considering coming out | Help thinking through timing, language and personal boundaries | Conversation preparation, checklists and boundary exercises |
| Trans and non-binary adults | Support with everyday identity-related situations | Content addressing pronouns, chosen names, workplace conversations and appointment preparation |
| People experiencing isolation or moving to a new area | A manageable route towards connection | Friendship guidance, relatable stories and a structured connection programme |
| People managing difficult family or workplace interactions | A way to organise feelings and plan responses | Journalling, practical scripts and reflection on what feels safe and achievable |
| People who need discretion | Control over what appears on screen and where information is processed | Notes mode, app lock and a choice of local or hosted AI |
| People building regular wellbeing habits | A lightweight way to notice changes and recognise progress | Mood check-ins, journal history and optional longer-term insights |

These audiences overlap. Q should allow people to define what matters to them without assuming that a particular identity means they have particular problems. Joy, relationships, creativity and achievement belong alongside support through difficult experiences.

### Potential organisational audience

LGBT+ charities, community groups, university adult-support services and workplace LGBT+ networks could potentially signpost eligible adults to Q as a supplementary self-help resource. These are prospective uses, not established partnerships evidenced by this review.

An organisation's involvement should not be taken to imply access to a person's journals or conversations. The repository contains customer-support and administration tools; those tools do not establish a clinical case-management service or an institutional wellbeing-monitoring product.

## 3. What the platform does

### Q Intelligence: conversational guidance

The assistant provides a conversational entry point for questions, reflection and planning. For example, someone could ask for help drafting a respectful boundary or organising questions before a difficult conversation.

Q supports two processing modes:

- **Private local AI:** The default provider runs a language model inside a compatible browser using WebLLM and WebGPU. Local generation avoids sending the prompt to an AI inference API.
- **Hosted AI:** An explicitly selected option sends context through Q's server to OpenAI. The implementation requires an authenticated account and active subscription, with authorised role exceptions and usage controls.

Users can opt into context memory. With that setting enabled, user-authored chat input can be saved as account memory and relevant entries retrieved for later conversations. This is broader than manually saving each individual fact: the setting permits the application to persist user input after successful responses. Assistant-generated answers are not automatically saved as memory facts.

Hosted mode can also request information from a vetted-knowledge service for relevant topics. Its usefulness depends on the quality, coverage and currency of the underlying material; this review did not verify a deployed knowledge collection.

### Life Guides: practical steps

The Life Guides section provides structured content and checklists that users can revisit and mark as completed. Bundled topics include finding affirming healthcare, workplace coming out and name updates, travel and regional rights, and building queer friendship and community.

The benefit is practical organisation: a broad concern becomes a sequence of smaller tasks. For example, preparing for an appointment can begin with writing down questions and identifying what the person wants to discuss. Any externally dependent information, particularly rights or service availability, still needs current verification.

### Journalling and mood tracking

Users can record reflections and mood check-ins, building a history they can review over time. This can make it easier to recognise positive experiences, express difficult feelings and remember what they wanted to revisit.

Premium journal insights summarise 30-, 90- or 365-day periods using dates, mood ratings and tags. The documented implementation sends those fields for calculation rather than sending journal prose or using an AI provider. It excludes unrecorded days, gives recorded days equal weight in the headline average and applies minimum-record requirements to tag summaries.

These summaries describe recorded patterns. They cannot diagnose a condition, establish the cause of a mood change, or represent days the person did not record.

### Guided programmes

Three premium programmes each contain four sessions:

| Programme | Focus | Example practical output |
| --- | --- | --- |
| Boundaries that feel like you | Recognising needs, finding words and reviewing an interaction | A boundary statement and a chosen next step |
| Building a sense of connection | Identifying supportive people, interests and settings | An introduction or a plan to explore a group |
| Confidence programme | Structured reflection and manageable action | A personally meaningful step and a reflection on progress |

Users can move between sessions, record optional reflections, mark completion and revisit exercises. The programmes allow pausing or choosing to wait; progress should not depend on disclosing an identity or taking an action that feels unsafe. They are self-paced exercises, not therapy.

### Lived-experience content

The lived-experience section contains searchable stories covering family, housing, identity, healthcare, relationships, community and other everyday situations. Users can save content and add a reflection.

There is an important implementation distinction: the current section loads bundled seed stories and stores added reflections in browser storage. Its upvote interaction updates component state. This does **not** establish a shared, moderated community network, published submissions or verified community endorsement. The origin and consent status of bundled narratives would need separate editorial verification before describing them as authenticated testimonials.

Its present value is a library of relatable perspectives and reflection material. A future shared community would require additional publishing, moderation, reporting and consent arrangements.

### Crisis-support signposting

Q checks for crisis-related language before normal AI inference and can open a country-specific support directory. The directory is bundled with the client, so once the relevant application resources are available it does not require a successful AI response to show contacts. Country selection uses settings or browser locale, with a manual choice and international fallback.

This creates a shorter route to external help. It does not mean Q monitors emergencies, guarantees detection or provides a staffed helpline. Contacting a listed service may still require a telephone or internet connection, and directory entries need regular review.

### Discretion, backup and continuity

Q includes a neutral, functional Notes interface that changes the visible presentation and browser title, alongside app-lock and local-data controls. These features can reduce casual on-screen exposure. They do not erase all browser history, downloads or network records, and an app PIN does not encrypt stored content.

Users can export and restore backups. Premium continuity offers opt-in cloud snapshots for selected categories, including journals, moods, guides, chat, programme progress and preferences. Each browser opts in separately. If device and cloud copies conflict, the user chooses which copy to use; Q does not automatically merge every entry.

## 4. How Q works

### The user's journey

1. **Access and account:** The person enters the application and signs in through the account system. Public access also depends on deployment and launch settings.
2. **Preferences:** They choose how much profile context to provide, their language and appearance preferences, and whether to enable memory or continuity.
3. **Support:** They use the assistant, a guide, stories, a programme or the journal according to their immediate need.
4. **Action:** They identify a manageable step, save a reflection or record progress.
5. **Review:** They return to saved material and, where enabled, use insights or continuity to pick up later.

This journey is flexible. Someone may use only the journal or guides, without making AI conversation the centre of their experience.

### Technical structure

| Layer | Repository implementation | Purpose |
| --- | --- | --- |
| Browser interface | React, TypeScript and Tailwind CSS | Presents the application and interactive tools |
| Local inference | WebLLM, WebGPU and a Web Worker | Runs the local model separately from the main interface work |
| Application server | Node.js and Express | Handles hosted AI, premium access, billing and administrative operations |
| Account and cloud services | Supabase Auth and PostgreSQL | Provides identity and persistent account records, with access controls defined in code and migrations |
| Local persistence | Browser storage and JSON backups | Retains device content and supports export/import |
| Payments | PayPal integration | Supports subscription checkout and entitlement workflows |
| Operations | Native CRM and staff/admin routes | Supports customer records, account-related tasks and communications |

The source contains a native CRM backed by Q's database. Some older documentation still describes Zoho Bigin as the principal CRM, so those passages should not be treated as the authoritative description of the current implementation.

### What privacy means in practice

Q offers useful choices, but “local AI” should not be interpreted as “nothing ever leaves this device”. Account authentication, opted-in memory, selected continuity categories and hosted processing can involve network services.

Local AI also needs a compatible device and an initial model download. The README estimates approximately 900 MB of assets, with actual requirements varying. Cached generation can work without another inference API request, but that does not establish that every part of Q works offline.

Hosted requests apply personal-information masking and sanitisation controls. These reduce some exposure but cannot guarantee anonymity, particularly where free text or contextual details can identify someone. Optional memory context can also form part of a hosted prompt.

Browser copies and JSON exports are not encrypted by Q. Cloud continuity is not end-to-end encrypted. Database ownership policies and authenticated server checks are represented in the implementation, but their presence is not proof that every production policy and configuration has been verified.

## 5. How Q could improve LGBT+ people's lives

The impact pathways below explain why the features may matter. They are product hypotheses to evaluate with users, not clinical effectiveness claims.

| Potential improvement | How Q could contribute | What success could look like |
| --- | --- | --- |
| Greater self-understanding | Writing and reflection help someone articulate needs, feelings and priorities | The person can explain what matters to them more clearly |
| More confidence in everyday situations | Guides and programmes turn uncertainty into a rehearsed or written next step | A prepared question, boundary or conversation plan |
| A stronger sense of recognition | Relevant stories and language reflect experiences the person recognises | The person reports feeling understood by the content |
| Progress towards human connection | Friendship guidance and connection exercises support manageable outreach | Exploring a group or contacting someone the person trusts |
| Better awareness of personal patterns | Mood and journal history make recorded experiences easier to review | Identifying a routine or situation worth exploring further |
| Greater control over disclosure | Processing choices, optional context and discreet presentation support user agency | Choosing deliberately what to share and where to save it |
| Easier navigation to external support | Guides and crisis resources make possible next contacts easier to find | Finding an appropriate organisation or preparing to seek help |

Q's contribution would be strongest when it helps users exercise their own judgement and build support beyond the application. It cannot remove discrimination, create housing or healthcare capacity, or replace trusted relationships. Its role is to make reflection, preparation and the next useful action more accessible.

### Illustrative situations

**Preparing for a workplace conversation.** An adult wants to discuss a chosen name with a manager. They use a guide to organise the issues, ask Q to help draft wording, and save a private reflection about what they feel ready to say. The potential benefit is preparation and agency; employer behaviour is outside Q's control.

**Finding connection after moving.** Someone reads a relevant story and works through the connection programme. They identify an interest, explore a group and draft an introduction. The useful outcome is a manageable route towards real contact, rather than a promise that app use alone resolves loneliness.

**Recognising progress through a difficult period.** A user records moods and reflections, then reviews the days they logged. They notice moments of enjoyment and choose an activity to revisit. The value is a more concrete personal record, without treating the pattern as a diagnosis.

**Reflecting discreetly.** A person prefers not to display LGBT+ content openly on a shared screen. They use Notes mode when necessary and make deliberate choices about local storage, backups and cloud features. The interface offers discretion, while shared-device and storage risks remain relevant.

## 6. Inclusion, access and sustainability

Q contains interface translations for English, Spanish, French, German, Portuguese, Italian, Polish, Arabic, Hindi and Simplified Chinese, including right-to-left layout handling for Arabic. This broadens interface access, but does not establish complete translation of guides, detailed help or safety content. The language implementation explicitly identifies material that remains in English pending review.

Device capability is another access consideration. Local AI may be unsuitable for older hardware or limited data allowances; hosted AI depends on subscription access and connectivity. Non-AI features therefore have an important role in the product's usefulness.

The subscription model supports premium hosted AI, programmes, insights and continuity. This review does not quote live prices or establish affordability. Community impact should be evaluated across paid and non-paying users, including those whose devices cannot run local AI.

Accessibility also needs evidence from actual use. The file currently named `docs/accessibility.md` contains subscription terms rather than an accessibility assessment. It cannot substantiate an accessibility-conformance claim.

## 7. How to assess real community impact

A useful evaluation should ask whether Q helps people accomplish something meaningful, rather than using time spent in the application as the main measure of success.

| Evaluation area | Suggested measure |
| --- | --- |
| Practical usefulness | Optional feedback on whether a guide or conversation helped identify a next step |
| Confidence and agency | Voluntary before/after ratings for a specific task, such as preparing a boundary |
| Connection | Optional reports of taking a desired step towards a trusted person or group |
| Reflection | Whether users find journal review useful and understandable |
| Inclusion | Task completion and feedback across languages, accessibility needs and device capabilities |
| Privacy understanding | Whether people correctly understand local AI, memory, hosted processing and continuity choices |
| Reliability | Completion of core tasks, recovery from failures and successful backup or continuity flows |
| Safety quality | Reviewed crisis scenarios, directory freshness and analysis of missed or inappropriate triggers |

Evaluation should collect the minimum necessary information and make participation optional. It need not harvest private journal prose to understand usefulness. Any later claim of improved wellbeing should be tied to a defined method, sample, timeframe and limitations.

## 8. Current position and priorities

The repository represents a substantial product spanning personal support, reflection, structured action, privacy choices and operational administration. The review also identifies boundaries that matter when presenting Q to users, partners or funders:

1. **Verify the deployed experience.** Confirm production feature access, migrations, payments, account isolation, device behaviour and continuity before claiming all repository features are live.
2. **Align public descriptions with implementation.** Clarify the local nature of story submissions, verify story provenance and update older CRM descriptions.
3. **Make privacy choices understandable.** Explain automatic memory saving when enabled, hosted context, plaintext backups and the limits of Notes mode.
4. **Validate inclusion.** Test with LGBT+ adults with varied identities, accessibility needs, languages and devices, without assuming one experience represents the whole community.
5. **Maintain content and measure benefit.** Review externally dependent information and use voluntary evaluation to establish which features actually help.

Q's strongest proposition is an LGBT+-centred space where someone can reflect, find practical guidance and choose their next step with greater confidence. Delivering that value depends on trustworthy implementation, clear expectations and ongoing input from the people it is intended to serve.

## 9. Repository evidence

The report uses the following files as its main evidence. Where older prose differs from current code, the implementation is prioritised. No production system, external service directory or clinical-outcome study was verified for this report.

| Subject | Source |
| --- | --- |
| Product overview and technical stack | [README](README.md), [package.json](package.json) |
| Application composition | [App.tsx](src/App.tsx) |
| AI selection, crisis interception and memory flow | [QAssistantView.tsx](src/components/QAssistantView.tsx), [local AI service](src/services/webLlm.ts), [AI routes](server/routes/ai.ts) |
| Bundled guides and stories | [initialData.ts](src/data/initialData.ts) |
| Story interactions and local persistence | [LivedExperiencesView.tsx](src/components/LivedExperiencesView.tsx), [storage.ts](src/services/storage.ts) |
| Programmes, insights and continuity | [premium feature documentation](docs/premium-features.md), [programme interface](src/components/GuidedProgrammes.tsx), [premium domain logic](server/premium-domain.ts), [premium routes](server/routes/premium.ts) |
| Safety and discreet presentation | [local AI and safety documentation](docs/local-ai-memory-safety.md), [camouflage hook](src/hooks/useCamouflage.ts), [crisis directory](src/data/crisisHelplines.ts) |
| Language coverage | [LanguageContext.tsx](src/contexts/LanguageContext.tsx) |
| Audience eligibility | [Terms](docs/terms.md) |
| Customer administration | [admin routes](server/routes/admin.ts) |
| Documentation limitations | [older operational guide](docs/q-user-staff-admin-guide.md), [accessibility-named document](docs/accessibility.md) |
