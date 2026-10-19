export type RoleGroupKey = 'leadership-governance' | 'product-design' | 'technology-it' | 'content-community' | 'customer-platform-support' | 'data-improvement';

export type RoleGroupCourse = {
  key: RoleGroupKey;
  title: string;
  roles: string[];
  purpose: string;
  contribution: string;
  responsibilities: string[];
  boundaries: string[];
  priorities: string[];
  userPractice: string[];
  dataPractice: string[];
  securityPractice: string[];
  workflow: string[];
  partners: string[];
  risks: string[];
  scenario: string;
  quality: string[];
};

export type RoleGroupLesson = {
  title: string;
  summary: string;
  points: string[];
  discussion: string[];
  activity: string;
};

export const roleGroupCourses: RoleGroupCourse[] = [
  {
    key: 'leadership-governance', title: 'Leadership & Governance', roles: ['Founder or Director', 'Operations Lead', 'Privacy or Data Protection Lead', 'Safeguarding Lead'],
    purpose: 'Set direction, accountabilities and safeguards so Q can serve its community reliably and responsibly.', contribution: 'Turn Q’s mission into clear priorities, resourcing, oversight and timely decisions.',
    responsibilities: ['Set priorities, ownership and decision routes.', 'Review service, risk and delivery information.', 'Maintain clear governance and escalation paths.'],
    boundaries: ['Make decisions only within delegated authority.', 'Separate oversight from specialist legal, clinical or safeguarding determinations.', 'Record approvals and conflicts through the approved process.'],
    priorities: ['Balance user wellbeing, service reliability and organisational capacity.', 'Use agreed impact and risk criteria.', 'Revisit decisions when evidence or risk changes.'],
    userPractice: ['Consider how decisions affect LGBTQ+ users and allies.', 'Check accessibility and inclusion impacts.', 'Use proportionate safeguards and clear accountability.'],
    dataPractice: ['Use aggregated or minimum necessary information for oversight.', 'Limit access to personal and sensitive information.', 'Route privacy requests and incidents to the designated owner.'],
    securityPractice: ['Review access and accountability controls.', 'Use approved channels for sensitive decisions.', 'Escalate suspected compromise promptly.'],
    workflow: ['Define owner, decision, due point and evidence.', 'Keep governance records accurate and retrievable.', 'Review agreed actions until they are closed.'],
    partners: ['Work with product, technology, support, community and data leads.', 'Share decisions with affected teams.', 'Keep the rationale and next steps clear.'],
    risks: ['Unclear ownership, unmanaged conflicts, privacy exposure, safeguarding concerns and unresolved service risks.'],
    scenario: 'A new feature is ready for launch, but a privacy question and an unresolved support risk remain. Agree who decides, who advises, what evidence is needed and what should happen next.',
    quality: ['Decisions have an accountable owner.', 'Risks and trade-offs are documented.', 'Actions have a clear follow-up route.'],
  },
  {
    key: 'product-design', title: 'Product & Design', roles: ['Product Manager', 'UX/UI Designer', 'Product Researcher'],
    purpose: 'Shape useful, accessible product experiences that support Q’s mission and respect user trust.', contribution: 'Translate user needs and evidence into clear product priorities, designs and testable outcomes.',
    responsibilities: ['Understand user needs through approved research.', 'Define scope, requirements and acceptance criteria.', 'Design, test and improve product journeys.'],
    boundaries: ['Do not treat research as clinical assessment.', 'Do not promise a feature or outcome before approval.', 'Escalate privacy, safety and accessibility concerns early.'],
    priorities: ['Use evidence, user impact, feasibility and risk.', 'Make assumptions explicit and test them.', 'Balance learning with a manageable release scope.'],
    userPractice: ['Use inclusive, accessible research and design methods.', 'Avoid asking for unnecessary sensitive disclosures.', 'Give participants a clear purpose and choice.'],
    dataPractice: ['Collect the minimum research data needed.', 'Use approved consent, storage and retention processes.', 'Separate research notes from identifying details where required.'],
    securityPractice: ['Use approved research and design tools.', 'Protect prototypes, accounts and unreleased information.', 'Request access through the authorised process.'],
    workflow: ['Move from brief and evidence to design, review, testing and release hand-off.', 'Keep requirements and decisions traceable.', 'Record issues and follow-up actions.'],
    partners: ['Work with engineering, QA, support, community and governance colleagues.', 'Share decisions and changes before hand-off.', 'Include support and operational readiness in release planning.'],
    risks: ['Unvalidated assumptions, inaccessible journeys, privacy surprises, unsafe content and unclear requirements.'],
    scenario: 'Research suggests a new onboarding question could improve personalisation, but it asks for sensitive information. Decide what to test, how to minimise collection and which teams must review the proposal.',
    quality: ['User needs and assumptions are clear.', 'Designs meet agreed accessibility and privacy checks.', 'Acceptance criteria and hand-offs are usable.'],
  },
  {
    key: 'technology-it', title: 'Technology & IT', roles: ['Software Engineer', 'QA Tester', 'IT Support Staff', 'Security or Systems Administrator'],
    purpose: 'Build, test and maintain the technology and workplace systems that Q relies on.', contribution: 'Deliver secure, reliable services and support colleagues through controlled, well-documented work.',
    responsibilities: ['Build or configure systems to approved requirements.', 'Test changes and record defects.', 'Support accounts, devices and service incidents within role permissions.'],
    boundaries: ['Use least privilege and individual accounts.', 'Do not bypass controls or make unapproved production changes.', 'Escalate security and privacy concerns through the designated route.'],
    priorities: ['Consider service impact, security risk and user need.', 'Use agreed release and support priorities.', 'Avoid risky shortcuts under time pressure.'],
    userPractice: ['Explain technical steps in plain language.', 'Use accessible support and testing practices.', 'Avoid inspecting personal content beyond the support purpose.'],
    dataPractice: ['Use approved environments and test data.', 'Keep secrets and personal information out of routine records.', 'Follow retention and incident procedures.'],
    securityPractice: ['Protect credentials, devices, code and configuration.', 'Review dependencies and access using approved controls.', 'Report suspicious activity or exposure promptly.'],
    workflow: ['Use documented request, review, test, change and recovery steps.', 'Record what changed and how it was verified.', 'Keep ticket or work ownership clear.'],
    partners: ['Coordinate with product, operations, support and governance.', 'Share dependencies and release risks early.', 'Provide a clear hand-off and support notes.'],
    risks: ['Unauthorised access, insecure changes, data exposure, service disruption and unresolved defects.'],
    scenario: 'A release is nearly ready when QA finds a defect that could expose information and support reports sign-in failures. Triage the risk, identify the decision owner and plan a safe response.',
    quality: ['Changes follow review and testing steps.', 'Issues and security risks are escalated promptly.', 'Work records let another colleague continue safely.'],
  },
  {
    key: 'content-community', title: 'Content & Community', roles: ['Social Media Officer', 'Content Writer', 'Community Manager', 'Partnerships or Marketing Lead'],
    purpose: 'Communicate Q’s work clearly and build respectful, safe connections with its community.', contribution: 'Create accurate, inclusive content and respond to people using approved guidance and channels.',
    responsibilities: ['Plan, draft and review content.', 'Publish through authorised accounts and workflows.', 'Moderate and route community queries as assigned.'],
    boundaries: ['Do not make unapproved product, clinical or policy claims.', 'Do not ask people to share sensitive details publicly.', 'Escalate safety, privacy, legal and media concerns.'],
    priorities: ['Use the approved content plan and audience purpose.', 'Check accuracy, accessibility and risk before publishing.', 'Respond according to the agreed moderation process.'],
    userPractice: ['Use affirming and accessible language.', 'Avoid assumptions about identity or experience.', 'Protect people from unnecessary exposure or stigma.'],
    dataPractice: ['Do not copy private messages or posts into unapproved tools.', 'Keep moderation records factual and minimal.', 'Use consent and asset permissions as required.'],
    securityPractice: ['Use assigned accounts and approved scheduling tools.', 'Check audience, links, assets and access before posting.', 'Report suspicious account activity promptly.'],
    workflow: ['Move from brief through drafting, approval, scheduling and review.', 'Track the published version and response actions.', 'Hand off unresolved queries with clear ownership.'],
    partners: ['Coordinate with product, support, leadership and community colleagues.', 'Confirm claims with the accountable subject owner.', 'Tell relevant teams when an issue needs their response.'],
    risks: ['Unverified claims, privacy exposure, inaccessible content, harmful replies and account compromise.'],
    scenario: 'A post is scheduled while a community member reports a safety concern and a product detail in the draft appears outdated. Pause the post, protect the user’s information and route both issues.',
    quality: ['Content is accurate, accessible and approved.', 'Replies stay within role boundaries.', 'Moderation and hand-offs follow current procedures.'],
  },
  {
    key: 'customer-platform-support', title: 'Customer & Platform Support', roles: ['Customer Service Agent', 'Support Lead', 'Platform Operations Specialist'],
    purpose: 'Help users and colleagues resolve platform questions with clear, respectful and reliable support.', contribution: 'Guide people through approved workflows, keep service records useful and route complex issues safely.',
    responsibilities: ['Understand the request and provide approved guidance.', 'Maintain accurate case or service records.', 'Monitor platform operations and coordinate hand-offs as assigned.'],
    boundaries: ['Do not diagnose, counsel or interpret private wellbeing content.', 'Do not request passwords, one-time codes or private entries.', 'Escalate safety, privacy, security and legal concerns.'],
    priorities: ['Use Q’s service criteria and escalation route.', 'Keep the user informed with confirmed information.', 'Check ownership and current status before acting.'],
    userPractice: ['Listen without judgement and use plain language.', 'Ask only for details needed to support the request.', 'Respect user choice and privacy.'],
    dataPractice: ['Use minimum approved identifiers.', 'Separate verified facts from user statements.', 'Keep sensitive content out of routine notes unless procedure requires it.'],
    securityPractice: ['Verify identity as required.', 'Use approved systems and role permissions.', 'Report suspected account compromise or disclosure promptly.'],
    workflow: ['Triage, assign, respond, record and follow up through the approved process.', 'Distinguish internal notes from user-facing messages.', 'Confirm sent or completed status before retrying.'],
    partners: ['Coordinate with product, IT, community and privacy contacts.', 'Send concise handovers with owner and next action.', 'Share recurring issues through approved reporting.'],
    risks: ['Unverified access, unsafe advice, duplicate work, privacy exposure and unresolved support incidents.'],
    scenario: 'A user cannot access their account and includes private wellbeing details in the request. Respond to the access issue without repeating the sensitive details, verify identity and escalate any risk.',
    quality: ['Responses are respectful and based on current guidance.', 'Records contain only relevant facts.', 'Cases have clear ownership, status and next action.'],
  },
  {
    key: 'data-improvement', title: 'Data & Improvement', roles: ['Data or Insights Analyst', 'Quality & Compliance Coordinator'],
    purpose: 'Turn reliable evidence into useful learning while protecting the people represented in the data.', contribution: 'Measure service and product performance, check quality and support sound improvement decisions.',
    responsibilities: ['Define measures and data requirements.', 'Check data quality, context and limitations.', 'Share findings and track agreed improvement actions.'],
    boundaries: ['Do not infer sensitive traits or individual outcomes without authority.', 'Do not present correlation as proof of cause.', 'Escalate data protection, quality and safeguarding concerns.'],
    priorities: ['Start with the decision or question the analysis must support.', 'Balance usefulness, reliability and privacy.', 'Make assumptions, gaps and uncertainty visible.'],
    userPractice: ['Consider who may be missing or misrepresented.', 'Use appropriate aggregation and accessibility.', 'Avoid stigmatising or deficit-based interpretations.'],
    dataPractice: ['Use approved datasets and access permissions.', 'Minimise, aggregate or de-identify data where appropriate.', 'Follow retention, sharing and correction procedures.'],
    securityPractice: ['Store and share outputs in approved locations.', 'Limit access to the intended audience.', 'Report suspected data exposure promptly.'],
    workflow: ['Define source, method and checks before analysis.', 'Keep a reproducible record of transformations.', 'Review output with the accountable subject owner before use.'],
    partners: ['Work with product, support, leadership and privacy colleagues.', 'Confirm definitions with the people who own the process.', 'Translate results into clear actions and limitations.'],
    risks: ['Poor data quality, re-identification, misleading metrics, unfair comparison and unsupported conclusions.'],
    scenario: 'A dashboard shows a change in support outcomes, but the underlying categories recently changed and some groups have small counts. Decide what can safely be reported and what needs further checking.',
    quality: ['Sources and definitions are clear.', 'Privacy and quality checks are documented.', 'Findings state limitations and lead to owned actions.'],
  },
];

export function getRoleGroupLessons(course: RoleGroupCourse): RoleGroupLesson[] {
  return [
    { title: 'Role group purpose', summary: course.purpose, points: [course.contribution, `Roles in this group: ${course.roles.join(', ')}.`], discussion: ['Explain how this group supports Q’s mission and where its work begins and ends.', 'Make role ownership visible so colleagues know who to ask or involve.'], activity: `Ask learners to map one current responsibility to the group’s purpose. Use this example: ${course.scenario}` },
    { title: 'Q’s mission and values', summary: 'Apply trust, privacy and wellbeing to everyday work.', points: ['Support people at their own pace.', 'Make support available when it is needed.', 'Put trust, privacy and user wellbeing at the centre.'], discussion: ['Connect Q’s values to the decisions and work products this group owns.', 'Ask which value could be overlooked under time pressure.'], activity: `Choose one value and apply it to this group’s work: ${course.contribution}` },
    { title: 'Responsibilities and boundaries', summary: 'Know what the group owns, what needs review and what must be escalated.', points: course.responsibilities, discussion: course.boundaries, activity: 'Sort three fictional requests into: handle within role, check with an owner, or escalate. Explain the evidence for each choice.' },
    { title: 'Planning and priorities', summary: 'Use impact, evidence and agreed criteria to decide what comes first.', points: course.priorities, discussion: ['Do not invent deadlines, service levels or approval rules.', 'Pause when the available evidence is not enough to make a safe decision.'], activity: 'Rank a fictional set of competing requests using the current Q priority guide. Name the decision owner and the next update.' },
    { title: 'Design for the people Q serves', summary: 'Make decisions with inclusion, accessibility and user trust in view.', points: course.userPractice, discussion: ['Ask whose needs are represented and whose may be missing.', 'Use plain language and avoid assumptions about identity or experience.'], activity: 'Review a fictional work item for accessibility, inclusion and privacy. Suggest one concrete improvement before it proceeds.' },
    { title: 'Privacy and information handling', summary: 'Use only the information needed for an authorised purpose.', points: course.dataPractice, discussion: ['Public, internal or sensitive data each require care and an approved purpose.', 'Route rights requests and privacy questions to the designated contact.'], activity: 'Edit a fictional record or work sample to remove unnecessary personal information while keeping what the next owner needs.' },
    { title: 'Security and safe systems', summary: 'Protect accounts, assets, content and work records.', points: course.securityPractice, discussion: ['Use individual accounts, assigned permissions and approved tools.', 'Report suspicious activity promptly; do not bypass safeguards to save time.'], activity: 'Identify the safe next step in a fictional access or security concern. Follow Q’s current reporting procedure.' },
    { title: 'Tools, workflows and records', summary: 'Use approved tools and leave work traceable for colleagues.', points: course.workflow, discussion: ['Demonstrate the local workflow and identify the required evidence at each hand-off.', 'Keep records factual, concise and in the approved system.'], activity: 'Complete a mock work record with purpose, owner, status, evidence checked and next action.' },
    { title: 'Collaboration and communication', summary: 'Coordinate work clearly across teams and with the people affected.', points: course.partners, discussion: ['Share changes and dependencies early with the right colleagues.', 'Use confirmed information and make ownership clear.'], activity: 'Write a short handover for a fictional cross-team request: issue, actions taken, current status and next owner/action.' },
    { title: 'Risk, escalation and incidents', summary: 'Recognise when normal work must pause for review or escalation.', points: course.risks, discussion: ['Use the designated Q route for safety, privacy, security, legal or high-impact concerns.', 'Do not investigate beyond role or make promises outside authority.'], activity: `Discuss this group-specific scenario and decide who must be involved: ${course.scenario}` },
    { title: 'Practice, assessment and sign-off', summary: 'Demonstrate careful, accurate work before taking on independent responsibilities.', points: course.quality, discussion: ['Assess observable behaviours and evidence, not speed alone.', 'Give one strength and one specific coaching point; follow the authorised sign-off process.'], activity: `Run the integrated scenario: ${course.scenario} Observe whether learners apply the group’s quality criteria and name a safe next step.` },
  ];
}
