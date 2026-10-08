from pathlib import Path
import json, zipfile
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, white
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.utils import ImageReader
import fitz

OUT=Path('D:/Dev/Q/output/pdf/university-pack'); OUT.mkdir(parents=True,exist_ok=True)
W,H=595.28,841.89
NAVY='#102B3F'; TEAL='#006E73'; INK='#203442'
style=ParagraphStyle('body',fontName='Helvetica',fontSize=11,leading=16,textColor=HexColor(INK))
small=ParagraphStyle('small',parent=style,fontSize=9,leading=13)
pages=[]
sources=[
('NHS: urgent mental health support','https://www.nhs.uk/nhs-services/mental-health-services/where-to-get-urgent-help-for-mental-health/'),
('Samaritans: contact and 116 123','https://www.samaritans.org/how-we-can-help/contact-samaritan/'),
('NHS: help after rape and sexual assault','https://www.nhs.uk/live-well/sexual-health/help-after-rape-and-sexual-assault/'),
('Police.uk: silent 999 calls','https://www.police.uk/pu/contact-us/how-to-make-a-silent-999-call/'),
('Police.uk: reporting routes','https://www.police.uk/pu/contact-us/what-and-how-to-report/how-to-report'),
('NCSC: spotting scams','https://www.ncsc.gov.uk/collection/phishing-scams/spot-scams'),
('NCSC: two-step verification','https://www.ncsc.gov.uk/pdfs/guidance/setting-two-factor-authentication-2fa.pdf'),
('Office for Students: condition E6','https://www.officeforstudents.org.uk/for-providers/student-protection-and-choice/harassment-and-sexual-misconduct/condition-e6-harassment-and-sexual-misconduct/')]

def make_pdf(name, data):
 c=canvas.Canvas(str(OUT/name),pagesize=(W,H)); c.setTitle(name.replace('-',' ').replace('.pdf','')); c.setAuthor('Q Intelligence')
 for i,(title,subtitle,blocks) in enumerate(data,1):
  c.setFillColor(HexColor(NAVY)); c.rect(0,H-114,W,114,fill=1,stroke=0)
  c.setFillColor(white); c.setFont('Helvetica-Bold',12); c.drawString(42,H-32,'Q INTELLIGENCE  /  UNIVERSITY PACK')
  c.setFont('Helvetica-Bold',25); c.drawString(42,H-71,title)
  c.setFont('Helvetica',10); c.drawString(42,H-94,subtitle)
  y=H-141
  for heading,body in blocks:
   if heading:
    c.setFillColor(HexColor(TEAL)); c.setFont('Helvetica-Bold',13); c.drawString(42,y,heading); y-=12
   p=Paragraph(body,small if title=='Sources and sharing' else style); _,height=p.wrap(W-84,700)
   if y-height<62: raise ValueError(f'Overflow {name} page {i}: {heading}')
   p.drawOn(c,42,y-height); y-=height+23
  c.setStrokeColor(HexColor('#DCE5E8')); c.line(42,45,W-42,45)
  c.setFont('Helvetica',8); c.setFillColor(HexColor(INK)); c.drawString(42,30,'Q Intelligence | UK edition | 7 October 2026'); c.drawRightString(W-42,30,f'{i:02d} / {len(data):02d}')
  c.showPage()
 c.save()

toolkit=[
('Safe Campus Toolkit','Practical guidance for students and university teams',[
 ('A safer campus starts with clear support','Everyone deserves to study, work and socialise without harassment, intimidation or abuse. Safety is a shared responsibility. Responsibility for harmful behaviour always lies with the person causing it.'),
 ('Use this toolkit','Students: start with the help routes on page 2, then use the checklists and contact planner. University teams: use the response guide on page 6 and the rollout plan in the companion pack.'),
 ('Inside','02  Get help now<br/>03  Everyday campus safety<br/>04  Harassment, consent and sexual violence<br/>05  Wellbeing and digital safety<br/>06  Responding to a disclosure<br/>07  Your campus contact planner<br/>08  Sources and sharing'),
 ('About this edition','UK-focused guidance, with NHS pathways on page 2 specifically labelled for England. Local services and university procedures vary. This toolkit supports awareness and planning; use qualified services for individual medical, safeguarding or legal decisions.'),
 ('Share with care','The general toolkit can be shared as supplied. Complete and verify local contacts before presenting it as your university\'s guide. Keep completed personal worksheets private.')]),
('Get help now','Save this page somewhere you can find it quickly',[
 ('Immediate danger or serious injury: 999','Call 999 for an emergency. Give your location and follow the operator\'s instructions. Contact campus security when safe, but do not delay emergency help. [4, 5]'),
 ('Unable to speak on a mobile 999 call','Listen to the operator. If prompted, press 55 to be connected to police. A silent call does not automatically send help; provide your location if you can. This instruction applies to mobile calls. [4]'),
 ('Urgent mental health help','In England, call NHS 111 and select the mental health option. If someone\'s life is at risk or you cannot keep yourself or someone else safe, call 999 or go to A&amp;E. Elsewhere in the UK, use your local NHS or HSC urgent mental health route. [1]'),
 ('Someone to talk to: 116 123','Samaritans is free to call, day or night. You can call when you are struggling or need someone to listen. It does not replace emergency services. [2]'),
 ('Sexual assault support','A sexual assault referral centre (SARC) can offer specialist medical and practical support. You can seek support without first reporting to police. Use the NHS source on page 8 to find help; local arrangements and safeguarding limits may apply. [3]'),
 ('Police and campus concerns','For non-emergency police matters, call 101 or use the relevant police online reporting route. For university concerns, contact your wellbeing team, safeguarding service or reporting service. [5]')]),
('Everyday campus safety','Small preparations that make support easier to reach',[
 ('Before you go','Save campus security and wellbeing contacts. Know building exits and accessible routes. Plan travel home and a backup option. Agree a check-in with someone you trust if useful; sharing your location is your choice.'),
 ('Travel, accommodation and late study','Choose routes and spaces that feel safe and accessible to you. Use available university transport or escorts. Keep entry codes private and report broken locks, lighting or access barriers. If you feel followed, go to a staffed place and ask for help.'),
 ('Social events','Respect boundaries. Agree how friends will find each other and get home. If someone becomes unexpectedly unwell or you suspect spiking, seek urgent help, tell venue staff and stay with them if safe. Call 999 for an emergency; do not leave them to travel alone.'),
 ('When you see concerning behaviour','Assess your safety first. You can ask staff for help, create a distraction or check in with the person afterwards. Do not confront someone if that could increase the danger. If there is immediate danger, call 999.'),
 ('Team checklist','Check lighting, transport information, accessible help points and out-of-hours support. Include commuters, postgraduate researchers, disabled students, international students and students living away from halls. Invite feedback without asking people to disclose personal harm.')]),
('Respect, consent and reporting','Support should be available before someone decides to report',[
 ('Consent and boundaries','Sexual activity needs freely given agreement. Agreement to one activity is not agreement to another, and consent can be withdrawn. Do not assume consent because of a relationship, silence or previous activity. If someone cannot choose freely or communicate agreement, stop.'),
 ('Recognise a concern','Unwanted sexual attention, threats, coercion, repeated unwanted contact, discriminatory abuse and misuse of power can all be reasons to seek advice. Online behaviour matters too. You do not need to decide which legal label fits before asking for support.'),
 ('If something happened to you','Get to a safer place if you can. You can ask a trusted person to stay with you. For sexual assault, contact a SARC promptly for advice about care and time-sensitive options. Seek help even if you have washed, changed clothes or are unsure about reporting. [3]'),
 ('Your options','Ask about confidential advice, university reporting, police reporting and practical adjustments such as accommodation or teaching changes. Ask who will see information and what happens next. Anonymous routes may limit the action a university can take. Support and formal reporting are different processes.'),
 ('Keep records only if safe','You may note dates, locations and what happened, or keep relevant messages securely. Avoid forwarding sensitive material widely or using shared group chats. You can seek help without having a complete record.'),
 ('For university teams in England','OfS condition E6 came into force on 1 August 2025 for registered providers. Review the official requirements, including published information, support, reporting and training. This toolkit is not a compliance assessment. [8]')]),
('Wellbeing and digital safety','Support your health, relationships and online life',[
 ('Notice when you need support','Persistent distress, isolation or difficulties managing daily life are reasons to reach out. You do not have to wait for a crisis. Contact student wellbeing, a GP or a trusted support service. Use page 2 when help is urgent.'),
 ('Support a friend','Listen without judgment. Ask what would help and offer to contact support together. Do not promise secrecy if someone may be in immediate danger. If you cannot keep them safe, use emergency help. You can also ask for support for yourself.'),
 ('Protect your accounts','Use a unique password for each account, ideally managed with a password manager. Enable two-step verification, especially for email. Keep devices updated and locked. Do not share login codes or approve unexpected sign-in requests. [7]'),
 ('Pause before paying or clicking','Unexpected messages about fees, accommodation, jobs or account suspension can be scams. Verify requests through a known official website or contact, rather than the message\'s link or phone number. Report suspicious university messages to IT. [6]'),
 ('Online harassment and intimate images','If safe, keep relevant messages and account details before blocking or reporting. Use platform reporting tools and university support. Never redistribute intimate images. If a device or account may be monitored, use a safer device to seek advice before changing settings.'),
 ('Make support accessible','Ask for an interpreter, accessible format, communication adjustment or a support person if needed. University teams should publish how students can request these adjustments and what out-of-hours options exist.')]),
('Responding to a disclosure','A first-response guide for staff and student leaders',[
 ('1. Listen and check immediate safety','Find a private, accessible space. Say: "Thank you for telling me. You deserve support." Ask whether urgent medical or emergency help is needed. Do not investigate, test the account or ask why the person did not act differently.'),
 ('2. Explain your role and privacy limits','Before taking details, explain what you can do, what you must share and with whom. Do not promise absolute confidentiality. Follow your institution\'s safeguarding process, including any child or adult safeguarding duties. If unsure, seek designated advice with minimal identifying information where possible.'),
 ('3. Offer choices and practical help','Ask what they need now. Explain support and reporting options without pressure. Offer a warm referral with permission: help make the call or connect them to the right team. Do not contact an alleged perpetrator or attempt mediation yourself.'),
 ('4. Record only what is necessary','Use the approved secure system. Separate the person\'s words from your observations. Record agreed actions, consent and any required escalation. Restrict access; follow retention policies. Do not put sensitive details into personal email, public AI tools or student group chats.'),
 ('5. Agree the next contact','Confirm who will follow up, how and when it is safe to contact the person. Explain what will happen if risk increases. Follow through on agreed actions and seek supervision for your own wellbeing.'),
 ('Practice prompt','A student says: "Something happened at a society event, but I do not want to report it." Practise explaining support options, privacy limits and immediate safety checks while respecting their choice. Use fictional examples in training.')]),
('Your campus contact planner','A private worksheet: complete it using verified university information',[
 ('Emergency reminder','UK emergency: 999 | Non-emergency police: 101 | Samaritans: 116 123<br/>England urgent mental health: NHS 111, mental health option. [1, 2, 5]'),
 ('University contacts','University / campus: ______________________________________<br/>Security number and hours: _________________________________<br/>Wellbeing contact and hours: _______________________________<br/>Safeguarding contact: _____________________________________<br/>Reporting page / office: ____________________________________<br/>Out-of-hours support: ______________________________________'),
 ('Independent and practical support','Students\' union advice: _____________________________________<br/>Local sexual assault support / SARC: _________________________<br/>Local urgent mental health route: ____________________________<br/>Accessibility / disability support: ____________________________<br/>Accommodation / emergency transport: ______________________'),
 ('My choices','A trusted person I can contact: ______________________________<br/>A safer place I can go: _____________________________________<br/>My backup journey home: __________________________________<br/>Safe way and time to contact me: ____________________________'),
 ('Before you use or share this sheet','Check numbers, links, hours and eligibility. Record the date checked: __________<br/>A completed sheet can contain sensitive information. Store it privately. Share only the details needed to obtain support; use a blank copy for wider distribution.')]),
('Sources and sharing','Source information checked on 7 October 2026',[
 ('Official support and guidance','<br/><br/>'.join(f'[{i}] <a href="{url}" color="#006E73">{label}</a><br/>{url}' for i,(label,url) in enumerate(sources,1))),
 ('Use and adaptation','Q Intelligence grants permission to share and print this pack for educational and campus awareness purposes. Keep the source list and edition date. Adaptations should identify their editor and revision date. No affiliation or endorsement by the listed organisations is implied.'),
 ('Local review','University teams should verify local routes and obtain appropriate safeguarding and accessibility review before adopting an adapted edition. Review links and contacts each term and after service changes. E6 is an England-specific regulatory reference. NHS pathways vary across UK nations.')])]

companion=[
('Campus quick guide','Print for noticeboards or share digitally alongside the toolkit',[
 ('Need urgent help?','Immediate danger or serious injury: <b>999</b>.<br/>Unable to speak on a mobile 999 call: listen and press <b>55 if prompted</b> for police. A silent call does not automatically send help.<br/>England urgent mental health: <b>111</b>, select the mental health option.<br/>Someone to talk to: <b>Samaritans 116 123</b>, free, day or night.<br/>Non-emergency police: <b>101</b>.'),
 ('If someone has harmed you','You deserve support. You can ask for help before deciding whether to make a formal report. After sexual assault, a SARC can offer specialist care without a prior police report. Find guidance at <a href="https://www.nhs.uk/live-well/sexual-health/help-after-rape-and-sexual-assault/" color="#006E73">nhs.uk - help after rape and sexual assault</a>.'),
 ('Help someone safely','Listen. Check immediate safety. Ask what they need. Help them reach support. Do not pressure them to report, promise secrecy or confront the person involved.'),
 ('Local contacts - complete before campus distribution','Campus / university: ______________________________________<br/>Security and hours: _______________________________________<br/>Wellbeing and hours: ______________________________________<br/>Reporting link: ___________________________________________<br/>Out-of-hours help: ________________________________________<br/>Verified by / date: ________________________________________'),
 ('Read alongside the Safe Campus Toolkit','Sources: NHS, Samaritans and Police.uk; full clickable references are on toolkit page 8. UK edition. England NHS route shown; use local urgent mental health routes elsewhere in the UK.')]),
('30-day campus rollout','A suggested implementation plan for university teams',[
 ('Days 1-7 | Name an owner and verify routes','Assign a lead and deputy. Map security, wellbeing, safeguarding, reporting, students\' union advice and independent support. Check opening hours, accessibility and out-of-hours cover. Complete the contact sheet. Have relevant specialists review the content.'),
 ('Days 8-14 | Test the student journey','With volunteers and fictional scenarios, test whether someone can find support on a phone, understand privacy limits and reach the correct team. Include commuter, international and disabled student perspectives. Fix broken links, unclear language and inaccessible formats.'),
 ('Days 15-21 | Prepare staff and student leaders','Run a short disclosure-response briefing using toolkit page 6. Explain escalation, secure records and referral boundaries. Agree who handles follow-up. Brief society and accommodation teams without turning peers into investigators.'),
 ('Days 22-30 | Share and check uptake','Publish the verified local pack through induction, the student portal, accommodation and societies. Pair print notices with an accessible HTML or text version. Explain who to contact for corrections. Gather optional feedback about clarity and ease of finding support.'),
 ('Measure useful outcomes','Track contact-link availability, training coverage and whether users can find the right route. Use aggregate feedback. Do not interpret fewer reports as evidence of less harm or collect sensitive disclosures in general surveys.'),
 ('Keep it current','Review each term and after service changes. Record the owner, revision date and next review. This is a suggested plan; local policy and safeguarding arrangements determine implementation.')]),
('Briefing and share copy','Ready-to-adapt material for staff, societies and student communications',[
 ('20-minute introduction','0-3 minutes: explain purpose, emergency routes and participation choices.<br/>3-8 minutes: locate verified campus support routes together.<br/>8-14 minutes: practise the fictional disclosure on toolkit page 6.<br/>14-18 minutes: discuss safe bystander choices and digital boundaries.<br/>18-20 minutes: show where to find help and how to suggest corrections.'),
 ('Facilitator preparation','Give a content notice for discussion of harassment and sexual violence. Allow participants to step out without explanation. Do not ask for personal experiences. Provide support contacts at the start and end, and have a private route for someone who needs help afterwards.'),
 ('Suggested student announcement','Everyone deserves to feel safe and supported at university. Our Safe Campus Toolkit explains how to find help, support a friend, recognise concerning behaviour and protect your digital life. You can access support before deciding whether to make a formal report. Read the toolkit and save the verified campus contacts. In an emergency, call 999.'),
 ('Publication checklist','[ ] Local contacts and operating hours verified<br/>[ ] Safeguarding lead has reviewed referral guidance<br/>[ ] Accessible digital alternative available<br/>[ ] Report and support links tested on mobile<br/>[ ] Owner and review date published<br/>[ ] Sources and UK / England scope retained'),
 ('Approval record','Pack owner: ______________________________________________<br/>Reviewed by: _____________________________________________<br/>Local edition date / next review: _____________________________<br/>Distribution channels: _____________________________________')])]

make_pdf('Safe-Campus-Toolkit.pdf',toolkit)
make_pdf('Campus-Quick-Guide.pdf',[companion[0]])
make_pdf('Campus-Contact-Planner.pdf',[toolkit[6]])
make_pdf('30-Day-Campus-Rollout-Plan.pdf',[companion[1]])
make_pdf('Campus-Briefing-and-Share-Pack.pdf',[companion[2]])
text=[]
for label,data in [('Safe Campus Toolkit',toolkit),('University Pack Companion',companion)]:
 text.append('# '+label)
 for title,subtitle,blocks in data:
  text.extend(['\n## '+title,subtitle])
  for heading,body in blocks: text.extend(['\n### '+heading,body.replace('<br/>','\n')])
(OUT/'University-Pack-Editable-Source.md').write_text('\n'.join(text),encoding='utf-8')
qa=[]
for file in OUT.glob('*.pdf'):
 doc=fitz.open(file)
 for p in doc:
  qa.append({'file':file.name,'page':p.number+1,'words':len(p.get_text().split())})
  p.get_pixmap(matrix=fitz.Matrix(0.8,0.8)).save(str(OUT/f'{file.stem}-review-{p.number+1}.png'))
(OUT/'quality-check.json').write_text(json.dumps(qa,indent=2))
with zipfile.ZipFile(OUT/'Q-Intelligence-University-Pack.zip','w',zipfile.ZIP_DEFLATED) as z:
 for name in ['Safe-Campus-Toolkit.pdf','Campus-Quick-Guide.pdf','Campus-Contact-Planner.pdf','30-Day-Campus-Rollout-Plan.pdf','Campus-Briefing-and-Share-Pack.pdf','University-Pack-Editable-Source.md']: z.write(OUT/name,arcname=name)
print(json.dumps(qa))
