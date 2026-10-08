create table public.help_articles (
 id uuid primary key default gen_random_uuid(), title text not null check(char_length(title) between 3 and 160), category text not null check(char_length(category) between 1 and 80), summary text not null check(char_length(summary) between 10 and 500), body text not null check(char_length(body) between 10 and 12000), kind text not null check(kind in ('guide','faq')), revision bigint not null default 1, publication jsonb, published_at timestamptz, archived boolean not null default false, updated_at timestamptz not null default now(), updated_by uuid references auth.users(id) on delete set null
);
create index help_articles_published_idx on public.help_articles(published_at desc,id) where publication is not null and not archived;
alter table public.help_articles enable row level security;
alter table public.help_articles force row level security;
revoke all on public.help_articles from public,anon,authenticated;
grant all on public.help_articles to service_role;
create function public.change_help_article(p_id uuid,p_actor uuid,p_action text,p_revision bigint,p_content jsonb default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare article public.help_articles;
begin
 if p_action not in ('save','publish','unpublish','archive','restore') or p_action is null then raise exception 'HELP_INVALID'; end if;
 if p_action='save' and p_revision=0 then
  insert into public.help_articles(id,title,category,summary,body,kind,updated_by) values(p_id,p_content->>'title',p_content->>'category',p_content->>'summary',p_content->>'body',p_content->>'kind',p_actor) on conflict(id) do nothing returning * into article;
  if article.id is not null then return to_jsonb(article); end if;
 end if;
 select * into article from public.help_articles where id=p_id for update;
 if article.id is null then raise exception 'HELP_NOT_FOUND'; end if;
 if p_action='save' and p_revision=0 and article.revision=1 and article.updated_by is not distinct from p_actor and jsonb_build_object('title',article.title,'category',article.category,'summary',article.summary,'body',article.body,'kind',article.kind)=p_content then return to_jsonb(article); end if;
 if p_revision is null or article.revision<>p_revision then raise exception 'HELP_STALE'; end if;
 if article.archived and p_action not in ('restore','unpublish') then raise exception 'HELP_ARCHIVED'; end if;
 if p_action='save' then update public.help_articles set title=p_content->>'title',category=p_content->>'category',summary=p_content->>'summary',body=p_content->>'body',kind=p_content->>'kind' where id=p_id;
 elsif p_action='publish' then update public.help_articles set publication=jsonb_build_object('title',title,'category',category,'summary',summary,'body',body,'kind',kind),published_at=now() where id=p_id;
 elsif p_action='unpublish' then update public.help_articles set publication=null where id=p_id;
 elsif p_action='archive' then update public.help_articles set publication=null,archived=true where id=p_id;
 else update public.help_articles set archived=false where id=p_id; end if;
 update public.help_articles set revision=revision+1,updated_at=now(),updated_by=p_actor where id=p_id returning * into article;
 return to_jsonb(article);
end $$;
revoke all on function public.change_help_article(uuid,uuid,text,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.change_help_article(uuid,uuid,text,bigint,jsonb) to service_role;

create table public.support_attachments (
 id uuid primary key, request_id uuid not null references public.contact_requests(id) on delete cascade, author_id uuid references auth.users(id) on delete set null, author_kind text not null check(author_kind in ('user','staff')), internal boolean not null default false, name text not null check(char_length(name) between 1 and 160), mime text not null check(mime in ('image/png','image/jpeg','application/pdf','text/plain')), size integer not null check(size between 1 and 2097152), sha256 text not null check(char_length(sha256)=64), object_path text not null unique, status text not null default 'pending' check(status in ('pending','ready')), created_at timestamptz not null default now()
);
create index support_attachments_request_idx on public.support_attachments(request_id,created_at,id);
create table public.support_storage_cleanup (object_path text primary key, created_at timestamptz not null default now());
alter table public.support_attachments enable row level security;
alter table public.support_attachments force row level security;
alter table public.support_storage_cleanup enable row level security;
alter table public.support_storage_cleanup force row level security;
revoke all on public.support_attachments,public.support_storage_cleanup from public,anon,authenticated;
grant all on public.support_attachments,public.support_storage_cleanup to service_role;
create function public.queue_support_file_cleanup() returns trigger language plpgsql security definer set search_path='' as $$
begin insert into public.support_storage_cleanup(object_path) values(old.object_path) on conflict do nothing;return old;end $$;
revoke all on function public.queue_support_file_cleanup() from public,anon,authenticated;
create trigger support_file_cleanup after delete on public.support_attachments for each row execute function public.queue_support_file_cleanup();
create function public.reserve_support_attachment(p_id uuid,p_request uuid,p_author uuid,p_staff boolean,p_internal boolean,p_name text,p_mime text,p_size integer,p_hash text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare item public.support_attachments;
begin
 perform id from public.contact_requests where id=p_request for update;
 if not found then raise exception 'SUPPORT_NOT_FOUND'; end if;
 select * into item from public.support_attachments where id=p_id;
 if item.id is not null then
  if item.request_id<>p_request or item.author_id is distinct from p_author or item.sha256<>p_hash or item.name<>p_name or item.mime<>p_mime or item.size<>p_size or item.internal<>p_internal or item.author_kind<>(case when p_staff then 'staff' else 'user' end) then raise exception 'SUPPORT_CONFLICT';end if;return to_jsonb(item);
 end if;
 if (select count(*) from public.support_attachments where request_id=p_request)>=10 then raise exception 'ATTACHMENT_LIMIT';end if;
 insert into public.support_attachments(id,request_id,author_id,author_kind,internal,name,mime,size,sha256,object_path) values(p_id,p_request,p_author,case when p_staff then 'staff' else 'user' end,p_internal,p_name,p_mime,p_size,p_hash,p_request::text||'/'||p_id::text) returning * into item;
 return to_jsonb(item);
end $$;
revoke all on function public.reserve_support_attachment(uuid,uuid,uuid,boolean,boolean,text,text,integer,text) from public,anon,authenticated;
grant execute on function public.reserve_support_attachment(uuid,uuid,uuid,boolean,boolean,text,text,integer,text) to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('q-support-private','q-support-private',false,2097152,array['image/png','image/jpeg','application/pdf','text/plain']) on conflict(id) do update set public=false,file_size_limit=2097152,allowed_mime_types=excluded.allowed_mime_types;
-- Restrictive guards also protect this bucket from unrelated permissive policies.
create policy support_files_no_client_read on storage.objects as restrictive for select to anon,authenticated using(bucket_id<>'q-support-private');
create policy support_files_no_client_insert on storage.objects as restrictive for insert to anon,authenticated with check(bucket_id<>'q-support-private');
create policy support_files_no_client_update on storage.objects as restrictive for update to anon,authenticated using(bucket_id<>'q-support-private') with check(bucket_id<>'q-support-private');
create policy support_files_no_client_delete on storage.objects as restrictive for delete to anon,authenticated using(bucket_id<>'q-support-private');

insert into public.help_articles(title,category,summary,body,kind,publication,published_at) values('Follow a guided programme','Life Guides','Premium programmes offer short sessions on boundaries, connection and confidence.','1. Open Life Guides and choose a Guided programme.
2. Read a session and optionally save a reflection.
3. Mark a session complete or revisit any session at your own pace.
4. Enable programme continuity in Profile if you want progress on other devices.

**Important:** Programmes are self-guided reflection tools, not therapy.','guide','{"title":"Follow a guided programme","category":"Life Guides","summary":"Premium programmes offer short sessions on boundaries, connection and confidence.","body":"1. Open Life Guides and choose a Guided programme.\n2. Read a session and optionally save a reflection.\n3. Mark a session complete or revisit any session at your own pace.\n4. Enable programme continuity in Profile if you want progress on other devices.\n\n**Important:** Programmes are self-guided reflection tools, not therapy.","kind":"guide"}'::jsonb,now());

insert into public.help_articles(title,category,summary,body,kind,publication,published_at) values('Explore advanced journal insights','Private Journal','Premium insights show recorded mood history and tag patterns.','1. Open Private Journal and find Advanced journal insights.
2. Choose 30, 90 or 365 days.
3. Review the processing disclosure and select Generate insights.
4. Explore the daily history and tags with at least three records.

**Important:** Only dates, ratings and tags go to Q for calculation. Journal text is not sent. Patterns are not diagnoses.','guide','{"title":"Explore advanced journal insights","category":"Private Journal","summary":"Premium insights show recorded mood history and tag patterns.","body":"1. Open Private Journal and find Advanced journal insights.\n2. Choose 30, 90 or 365 days.\n3. Review the processing disclosure and select Generate insights.\n4. Explore the daily history and tags with at least three records.\n\n**Important:** Only dates, ratings and tags go to Q for calculation. Journal text is not sent. Patterns are not diagnoses.","kind":"guide"}'::jsonb,now());

insert into public.help_articles(title,category,summary,body,kind,publication,published_at) values('Continue on another device','Account','Premium continuity synchronises only the categories you select.','1. Open Profile and choose the categories to sync.
2. Select Enable selected continuity on each device.
3. If both copies have changes, export them and choose which copy to keep.
4. Pause continuity to change categories.
5. You can export or delete your existing cloud copy after a subscription ends.

**Important:** Cloud copies are not end-to-end encrypted. Pause other devices before deleting a cloud copy to prevent re-upload.','guide','{"title":"Continue on another device","category":"Account","summary":"Premium continuity synchronises only the categories you select.","body":"1. Open Profile and choose the categories to sync.\n2. Select Enable selected continuity on each device.\n3. If both copies have changes, export them and choose which copy to keep.\n4. Pause continuity to change categories.\n5. You can export or delete your existing cloud copy after a subscription ends.\n\n**Important:** Cloud copies are not end-to-end encrypted. Pause other devices before deleting a cloud copy to prevent re-upload.","kind":"guide"}'::jsonb,now());

insert into public.help_articles(title,category,summary,body,kind,publication,published_at) values('Finding your way around Q','Getting started','Use the colourful navigation bar to move between the main areas without losing your current work.','1. Q Intelligence opens your private AI companion.
2. Life Guides contains practical saved guidance and action plans.
3. Peer Knowledge contains community-informed lived-experience content.
4. Private Journal combines journal entries and mood check-ins.
5. Profile contains account, privacy, backup, security, and subscription controls.
6. Help returns you to this knowledge base.','guide','{"title":"Finding your way around Q","category":"Getting started","summary":"Use the colourful navigation bar to move between the main areas without losing your current work.","body":"1. Q Intelligence opens your private AI companion.\n2. Life Guides contains practical saved guidance and action plans.\n3. Peer Knowledge contains community-informed lived-experience content.\n4. Private Journal combines journal entries and mood check-ins.\n5. Profile contains account, privacy, backup, security, and subscription controls.\n6. Help returns you to this knowledge base.","kind":"guide"}'::jsonb,now());

insert into public.help_articles(title,category,summary,body,kind,publication,published_at) values('Choose local or hosted AI','Q Intelligence','The processing banner always shows which mode is selected before you send a message.','1. Choose Private local AI to keep supported guidance and drafting prompts on this device.
2. Common private prompts can answer instantly without loading the larger browser model.
3. More open-ended local prompts may download and cache the private WebLLM model.
4. Choose Hosted AI only when you want the masked prompt and disclosed context sent through Q to OpenAI.
5. Hosted AI requires sign-in and has usage limits.
6. You can change modes from the provider menu above the conversation.

**Important:** Crisis-language checks happen before either AI processing route. AI is not professional or emergency advice.','guide','{"title":"Choose local or hosted AI","category":"Q Intelligence","summary":"The processing banner always shows which mode is selected before you send a message.","body":"1. Choose Private local AI to keep supported guidance and drafting prompts on this device.\n2. Common private prompts can answer instantly without loading the larger browser model.\n3. More open-ended local prompts may download and cache the private WebLLM model.\n4. Choose Hosted AI only when you want the masked prompt and disclosed context sent through Q to OpenAI.\n5. Hosted AI requires sign-in and has usage limits.\n6. You can change modes from the provider menu above the conversation.\n\n**Important:** Crisis-language checks happen before either AI processing route. AI is not professional or emergency advice.","kind":"guide"}'::jsonb,now());

insert into public.help_articles(title,category,summary,body,kind,publication,published_at) values('Ask Q and save useful answers','Q Intelligence','Type a question, use a suggested prompt, or save an AI response into your Life Guides.','1. Enter a question in the composer at the bottom of Q Intelligence.
2. Review the processing disclosure shown above the conversation.
3. Select Send and wait for the Q logo to finish pulsing.
4. Use Save to Vault beneath a useful response to create an offline Life Guide.
5. Use the reset control to clear the active chat history on this device.','guide','{"title":"Ask Q and save useful answers","category":"Q Intelligence","summary":"Type a question, use a suggested prompt, or save an AI response into your Life Guides.","body":"1. Enter a question in the composer at the bottom of Q Intelligence.\n2. Review the processing disclosure shown above the conversation.\n3. Select Send and wait for the Q logo to finish pulsing.\n4. Use Save to Vault beneath a useful response to create an offline Life Guide.\n5. Use the reset control to clear the active chat history on this device.","kind":"guide"}'::jsonb,now());

insert into public.help_articles(title,category,summary,body,kind,publication,published_at) values('Control Q Context Memory','Q Intelligence','Memory is optional and stores only user-authored context when explicitly enabled.','1. Open Memory Engine from Q Intelligence.
2. Review or update your preferred name, pronouns, and region.
3. Enable Opt-In AI Context Memory only if you want Q to recall user-authored context.
4. Save the preferences.
5. Review and remove saved memories from the Profile privacy controls.

**Important:** Q does not automatically save assistant replies as facts about you.','guide','{"title":"Control Q Context Memory","category":"Q Intelligence","summary":"Memory is optional and stores only user-authored context when explicitly enabled.","body":"1. Open Memory Engine from Q Intelligence.\n2. Review or update your preferred name, pronouns, and region.\n3. Enable Opt-In AI Context Memory only if you want Q to recall user-authored context.\n4. Save the preferences.\n5. Review and remove saved memories from the Profile privacy controls.\n\n**Important:** Q does not automatically save assistant replies as facts about you.","kind":"guide"}'::jsonb,now());

insert into public.help_articles(title,category,summary,body,kind,publication,published_at) values('Use Life Guides and action plans','Life Guides','Guides turn useful information into practical steps you can revisit.','1. Open Life Guides from navigation.
2. Browse or search by topic.
3. Open a guide to review its summary and steps.
4. Tick steps as you complete them.
5. Save selected AI answers to the Vault to create personal guides.','guide','{"title":"Use Life Guides and action plans","category":"Life Guides","summary":"Guides turn useful information into practical steps you can revisit.","body":"1. Open Life Guides from navigation.\n2. Browse or search by topic.\n3. Open a guide to review its summary and steps.\n4. Tick steps as you complete them.\n5. Save selected AI answers to the Vault to create personal guides.","kind":"guide"}'::jsonb,now());

insert into public.help_articles(title,category,summary,body,kind,publication,published_at) values('Browse peer knowledge safely','Peer Knowledge','Read community-informed experiences while remembering that individual experiences are not universal advice.','1. Open Peer Knowledge.
2. Browse the available lived-experience topics.
3. Use stories as perspective rather than verified professional advice.
4. For medical, legal, safeguarding, or crisis decisions, use verified local professional support.','guide','{"title":"Browse peer knowledge safely","category":"Peer Knowledge","summary":"Read community-informed experiences while remembering that individual experiences are not universal advice.","body":"1. Open Peer Knowledge.\n2. Browse the available lived-experience topics.\n3. Use stories as perspective rather than verified professional advice.\n4. For medical, legal, safeguarding, or crisis decisions, use verified local professional support.","kind":"guide"}'::jsonb,now());

insert into public.help_articles(title,category,summary,body,kind,publication,published_at) values('Write and manage journal entries','Private Journal','Journal entries stay account-scoped when synchronized and can also support private reflection.','1. Open Private Journal.
2. Create a new entry and add a title and reflection.
3. Use search to find previous entries.
4. Edit or delete entries you no longer need.
5. Use the PDF export option when you need a personal offline copy.

**Important:** Only export to a device and location you consider safe.','guide','{"title":"Write and manage journal entries","category":"Private Journal","summary":"Journal entries stay account-scoped when synchronized and can also support private reflection.","body":"1. Open Private Journal.\n2. Create a new entry and add a title and reflection.\n3. Use search to find previous entries.\n4. Edit or delete entries you no longer need.\n5. Use the PDF export option when you need a personal offline copy.\n\n**Important:** Only export to a device and location you consider safe.","kind":"guide"}'::jsonb,now());

insert into public.help_articles(title,category,summary,body,kind,publication,published_at) values('Record a mood check-in','Private Journal','Mood check-ins help you notice patterns without judging how you feel.','1. Open Private Journal and locate the mood area.
2. Choose the rating or label that best fits the moment.
3. Add optional notes or tags.
4. Review mood history and patterns later.
5. Use Q or professional support when a pattern concerns you.','guide','{"title":"Record a mood check-in","category":"Private Journal","summary":"Mood check-ins help you notice patterns without judging how you feel.","body":"1. Open Private Journal and locate the mood area.\n2. Choose the rating or label that best fits the moment.\n3. Add optional notes or tags.\n4. Review mood history and patterns later.\n5. Use Q or professional support when a pattern concerns you.","kind":"guide"}'::jsonb,now());

insert into public.help_articles(title,category,summary,body,kind,publication,published_at) values('Manage your profile and account','Account','Profile centralises account details and personal preferences.','1. Open Profile from navigation.
2. Review your name, pronouns, region, and privacy preferences.
3. Save changes before leaving the page.
4. Use the account actions for backup, security, subscription, or sign out.','guide','{"title":"Manage your profile and account","category":"Account","summary":"Profile centralises account details and personal preferences.","body":"1. Open Profile from navigation.\n2. Review your name, pronouns, region, and privacy preferences.\n3. Save changes before leaving the page.\n4. Use the account actions for backup, security, subscription, or sign out.","kind":"guide"}'::jsonb,now());

insert into public.help_articles(title,category,summary,body,kind,publication,published_at) values('Set a privacy lock','Privacy & safety','Protect the whole app or only the Journal with a PIN or supported lock method.','1. Open Profile, then Security settings.
2. Choose the lock type and scope.
3. Set an auto-lock delay appropriate for your situation.
4. Save and test the lock before relying on it.
5. Keep recovery limitations in mind if you forget a PIN.','guide','{"title":"Set a privacy lock","category":"Privacy & safety","summary":"Protect the whole app or only the Journal with a PIN or supported lock method.","body":"1. Open Profile, then Security settings.\n2. Choose the lock type and scope.\n3. Set an auto-lock delay appropriate for your situation.\n4. Save and test the lock before relying on it.\n5. Keep recovery limitations in mind if you forget a PIN.","kind":"guide"}'::jsonb,now());

insert into public.help_articles(title,category,summary,body,kind,publication,published_at) values('Use discreet Notes mode','Privacy & safety','Notes mode immediately replaces Q with a functional, neutral QuickNotes interface.','1. Select Disguise Mode from the lower corner, or press Alt+M.
2. Use QuickNotes normally: add, select, and edit notes.
3. Select the small Back control at the bottom of the notes sidebar to return to Q.
4. If a privacy PIN is configured, enter it to return.
5. Q returns to the same tab and in-memory state you left.

**Important:** Notes mode does not erase earlier browser history, network records, downloads, or browser-managed caches.','guide','{"title":"Use discreet Notes mode","category":"Privacy & safety","summary":"Notes mode immediately replaces Q with a functional, neutral QuickNotes interface.","body":"1. Select Disguise Mode from the lower corner, or press Alt+M.\n2. Use QuickNotes normally: add, select, and edit notes.\n3. Select the small Back control at the bottom of the notes sidebar to return to Q.\n4. If a privacy PIN is configured, enter it to return.\n5. Q returns to the same tab and in-memory state you left.\n\n**Important:** Notes mode does not erase earlier browser history, network records, downloads, or browser-managed caches.","kind":"guide"}'::jsonb,now());

insert into public.help_articles(title,category,summary,body,kind,publication,published_at) values('Back up or restore local Q data','Privacy & safety','Q exports a plaintext JSON backup. Store it in a secure or encrypted location you control.','1. Open Profile and choose Backup.
2. Review exactly which data will be included.
3. Export only to a location you trust.
4. Use Import to restore a compatible Q backup.
5. Check the restored content before removing the original copy.','guide','{"title":"Back up or restore local Q data","category":"Privacy & safety","summary":"Q exports a plaintext JSON backup. Store it in a secure or encrypted location you control.","body":"1. Open Profile and choose Backup.\n2. Review exactly which data will be included.\n3. Export only to a location you trust.\n4. Use Import to restore a compatible Q backup.\n5. Check the restored content before removing the original copy.","kind":"guide"}'::jsonb,now());

insert into public.help_articles(title,category,summary,body,kind,publication,published_at) values('Subscribe or manage billing','Subscription','Q uses PayPal for recurring monthly and yearly subscriptions.','1. Select Subscribe in the app header or Profile.
2. Choose an available monthly or yearly plan.
3. Review the complete PayPal schedule, including any introductory cycles.
4. Approve the subscription in PayPal.
5. Return to Q and allow the subscription status to verify.
6. Use PayPal and Q account controls to review or cancel billing.

**Important:** Never give Q staff card details outside a PayPal-hosted payment interface.','guide','{"title":"Subscribe or manage billing","category":"Subscription","summary":"Q uses PayPal for recurring monthly and yearly subscriptions.","body":"1. Select Subscribe in the app header or Profile.\n2. Choose an available monthly or yearly plan.\n3. Review the complete PayPal schedule, including any introductory cycles.\n4. Approve the subscription in PayPal.\n5. Return to Q and allow the subscription status to verify.\n6. Use PayPal and Q account controls to review or cancel billing.\n\n**Important:** Never give Q staff card details outside a PayPal-hosted payment interface.","kind":"guide"}'::jsonb,now());

insert into public.help_articles(title,category,summary,body,kind,publication,published_at) values('Understand where data is stored','Privacy & safety','Different Q features use browser storage, account-scoped secure cloud storage, or an explicitly selected hosted processor.','1. Local AI generation remains in the browser, although model files must be downloaded.
2. Chat history and some preferences may be stored on the device.
3. Opted-in memories and synchronized user content are protected by account-scoped row-level security.
4. Hosted AI sends the disclosed masked context to Q and Groq or OpenAI, depending on server configuration. OpenAI may also receive an embedding request for vetted context when configured.
5. Read Privacy, AI Disclaimer, Processor Register, and Third-Party Notices from the legal footer.','guide','{"title":"Understand where data is stored","category":"Privacy & safety","summary":"Different Q features use browser storage, account-scoped secure cloud storage, or an explicitly selected hosted processor.","body":"1. Local AI generation remains in the browser, although model files must be downloaded.\n2. Chat history and some preferences may be stored on the device.\n3. Opted-in memories and synchronized user content are protected by account-scoped row-level security.\n4. Hosted AI sends the disclosed masked context to Q and Groq or OpenAI, depending on server configuration. OpenAI may also receive an embedding request for vetted context when configured.\n5. Read Privacy, AI Disclaimer, Processor Register, and Third-Party Notices from the legal footer.","kind":"guide"}'::jsonb,now());

insert into public.help_articles(title,category,summary,body,kind,publication,published_at) values('Decide which AI mode is right for you','Q Intelligence','Compare privacy, compatibility, download size, speed, and usage limits before choosing a provider.','1. Choose local AI when keeping generation on the device is your priority and the browser supports WebGPU.
2. Choose hosted AI when the device cannot run the local model or you prefer server processing.
3. Read the processing banner before sending sensitive context.
4. Remember that switching mode changes future messages; it does not rewrite messages already processed.
5. Return to local mode at any time from the provider selector.','guide','{"title":"Decide which AI mode is right for you","category":"Q Intelligence","summary":"Compare privacy, compatibility, download size, speed, and usage limits before choosing a provider.","body":"1. Choose local AI when keeping generation on the device is your priority and the browser supports WebGPU.\n2. Choose hosted AI when the device cannot run the local model or you prefer server processing.\n3. Read the processing banner before sending sensitive context.\n4. Remember that switching mode changes future messages; it does not rewrite messages already processed.\n5. Return to local mode at any time from the provider selector.","kind":"guide"}'::jsonb,now());

insert into public.help_articles(title,category,summary,body,kind,publication,published_at) values('Prepare for the first local model download','Q Intelligence','The first local-AI session needs time, a stable connection, and roughly 1.5 GB of available storage.','1. Use a trusted, stable network for the first download.
2. Keep the Q tab open while the progress message is visible.
3. Avoid private-browsing modes that routinely discard large browser caches.
4. After loading completes, send a short test question.
5. Future starts should reuse the browser cache unless site data is cleared.

**Important:** Clearing browser site data can remove the downloaded model and require another download.','guide','{"title":"Prepare for the first local model download","category":"Q Intelligence","summary":"The first local-AI session needs time, a stable connection, and roughly 1.5 GB of available storage.","body":"1. Use a trusted, stable network for the first download.\n2. Keep the Q tab open while the progress message is visible.\n3. Avoid private-browsing modes that routinely discard large browser caches.\n4. After loading completes, send a short test question.\n5. Future starts should reuse the browser cache unless site data is cleared.\n\n**Important:** Clearing browser site data can remove the downloaded model and require another download.","kind":"guide"}'::jsonb,now());

insert into public.help_articles(title,category,summary,body,kind,publication,published_at) values('Understand hosted-AI usage limits','Q Intelligence','Hosted requests are rate and cost controlled to protect the service from unexpected usage.','1. Sign in before selecting Hosted AI.
2. Keep one request focused instead of sending repeated fragments.
3. If a limit message appears, wait for the stated reset period.
4. Use Private local AI while hosted access is unavailable, if your device supports it.
5. Do not attempt to bypass account or service limits.','guide','{"title":"Understand hosted-AI usage limits","category":"Q Intelligence","summary":"Hosted requests are rate and cost controlled to protect the service from unexpected usage.","body":"1. Sign in before selecting Hosted AI.\n2. Keep one request focused instead of sending repeated fragments.\n3. If a limit message appears, wait for the stated reset period.\n4. Use Private local AI while hosted access is unavailable, if your device supports it.\n5. Do not attempt to bypass account or service limits.","kind":"guide"}'::jsonb,now());

insert into public.help_articles(title,category,summary,body,kind,publication,published_at) values('Understand the PII Shield','Privacy & safety','Q masks common personal identifiers before hosted processing, but automated masking cannot guarantee that every identifying detail is removed.','1. Look for the PII Shield indicator beside the chat composer.
2. Avoid entering full names, precise addresses, account numbers, passwords, or highly identifying combinations.
3. Describe a situation in general terms where possible.
4. Review your message before selecting Send.
5. Use local AI for additional privacy when supported.

**Important:** Never paste passwords, authentication codes, payment details, or confidential third-party records into Q.','guide','{"title":"Understand the PII Shield","category":"Privacy & safety","summary":"Q masks common personal identifiers before hosted processing, but automated masking cannot guarantee that every identifying detail is removed.","body":"1. Look for the PII Shield indicator beside the chat composer.\n2. Avoid entering full names, precise addresses, account numbers, passwords, or highly identifying combinations.\n3. Describe a situation in general terms where possible.\n4. Review your message before selecting Send.\n5. Use local AI for additional privacy when supported.\n\n**Important:** Never paste passwords, authentication codes, payment details, or confidential third-party records into Q.","kind":"guide"}'::jsonb,now());

insert into public.help_articles(title,category,summary,body,kind,publication,published_at) values('Write a useful question for Q','Q Intelligence','Clear goals and a little non-identifying context usually produce more practical guidance.','1. State what you want help deciding, drafting, or planning.
2. Add your general country or region only when laws or services matter.
3. Explain important constraints such as budget, accessibility, safety, or time.
4. Ask for a checklist, draft, options, or next steps when useful.
5. Review the response critically and verify high-stakes information.','guide','{"title":"Write a useful question for Q","category":"Q Intelligence","summary":"Clear goals and a little non-identifying context usually produce more practical guidance.","body":"1. State what you want help deciding, drafting, or planning.\n2. Add your general country or region only when laws or services matter.\n3. Explain important constraints such as budget, accessibility, safety, or time.\n4. Ask for a checklist, draft, options, or next steps when useful.\n5. Review the response critically and verify high-stakes information.","kind":"guide"}'::jsonb,now());

insert into public.help_articles(title,category,summary,body,kind,publication,published_at) values('Use trusted sources shown in an answer','Q Intelligence','Some responses include links or references from Q’s vetted knowledge library.','1. Look beneath the answer for the trusted-source label.
2. Open the named source to check the original context and publication date.
3. Prefer official services for legal, medical, safeguarding, and emergency information.
4. Check whether guidance applies to your location.
5. Treat an answer without a source as general guidance, not verified fact.','guide','{"title":"Use trusted sources shown in an answer","category":"Q Intelligence","summary":"Some responses include links or references from Q’s vetted knowledge library.","body":"1. Look beneath the answer for the trusted-source label.\n2. Open the named source to check the original context and publication date.\n3. Prefer official services for legal, medical, safeguarding, and emergency information.\n4. Check whether guidance applies to your location.\n5. Treat an answer without a source as general guidance, not verified fact.","kind":"guide"}'::jsonb,now());

insert into public.help_articles(title,category,summary,body,kind,publication,published_at) values('Know the difference between clearing chat and deleting memory','Privacy & safety','Chat history and opted-in Context Memory are separate controls.','1. Use the reset control in Q Intelligence to clear the active local conversation.
2. Open the Journal memory area to review account memories.
3. Delete individual memory items you no longer want retained.
4. Turn off Context Memory to stop new user context being saved.
5. Use browser or account data controls when you need a wider deletion action.

**Important:** Clearing the visible conversation does not automatically delete separately saved memories, exported files, or backups.','guide','{"title":"Know the difference between clearing chat and deleting memory","category":"Privacy & safety","summary":"Chat history and opted-in Context Memory are separate controls.","body":"1. Use the reset control in Q Intelligence to clear the active local conversation.\n2. Open the Journal memory area to review account memories.\n3. Delete individual memory items you no longer want retained.\n4. Turn off Context Memory to stop new user context being saved.\n5. Use browser or account data controls when you need a wider deletion action.\n\n**Important:** Clearing the visible conversation does not automatically delete separately saved memories, exported files, or backups.","kind":"guide"}'::jsonb,now());

insert into public.help_articles(title,category,summary,body,kind,publication,published_at) values('A Q Intelligence response failed','Troubleshooting','Connection, provider, browser, session, or usage-limit problems can interrupt a response.','1. Copy any unsent text you do not want to lose.
2. Read the processing banner and error message.
3. Confirm the device is online for hosted AI or initial local-model loading.
4. Try one shorter request.
5. Switch provider only after reviewing the new processing disclosure.
6. Sign out and back in if the session has expired.','guide','{"title":"A Q Intelligence response failed","category":"Troubleshooting","summary":"Connection, provider, browser, session, or usage-limit problems can interrupt a response.","body":"1. Copy any unsent text you do not want to lose.\n2. Read the processing banner and error message.\n3. Confirm the device is online for hosted AI or initial local-model loading.\n4. Try one shorter request.\n5. Switch provider only after reviewing the new processing disclosure.\n6. Sign out and back in if the session has expired.","kind":"guide"}'::jsonb,now());

insert into public.help_articles(title,category,summary,body,kind,publication,published_at) values('Create a custom Life Guide','Life Guides','Build a practical action plan around a topic that matters to you.','1. Open Life Guides.
2. Choose the custom-guide option.
3. Enter a clear topic and select the closest category.
4. Generate the guide and review every suggested step.
5. Edit your approach as circumstances change and verify specialist advice.','guide','{"title":"Create a custom Life Guide","category":"Life Guides","summary":"Build a practical action plan around a topic that matters to you.","body":"1. Open Life Guides.\n2. Choose the custom-guide option.\n3. Enter a clear topic and select the closest category.\n4. Generate the guide and review every suggested step.\n5. Edit your approach as circumstances change and verify specialist advice.","kind":"guide"}'::jsonb,now());

insert into public.help_articles(title,category,summary,body,kind,publication,published_at) values('Track and save guide progress','Life Guides','Guide checkboxes and bookmarks make longer plans easier to revisit.','1. Open the guide you are working through.
2. Tick only steps you have completed.
3. Use the bookmark control to keep important guides easy to find.
4. Return later to continue from the saved state.
5. Export a backup if the progress is important to keep across devices.','guide','{"title":"Track and save guide progress","category":"Life Guides","summary":"Guide checkboxes and bookmarks make longer plans easier to revisit.","body":"1. Open the guide you are working through.\n2. Tick only steps you have completed.\n3. Use the bookmark control to keep important guides easy to find.\n4. Return later to continue from the saved state.\n5. Export a backup if the progress is important to keep across devices.","kind":"guide"}'::jsonb,now());

insert into public.help_articles(title,category,summary,body,kind,publication,published_at) values('Share an anonymous reflection','Peer Knowledge','Contribute practical lived experience without using your legal identity.','1. Open Peer Knowledge and select Share Reflection.
2. Use an alias or leave the optional author field blank.
3. Choose a category and describe what helped you.
4. Remove names, workplaces, addresses, case numbers, and identifying details.
5. Add one practical takeaway, review the entry, and publish.

**Important:** Only share your own experience. Do not identify another person or post confidential, defamatory, or unsafe material.','guide','{"title":"Share an anonymous reflection","category":"Peer Knowledge","summary":"Contribute practical lived experience without using your legal identity.","body":"1. Open Peer Knowledge and select Share Reflection.\n2. Use an alias or leave the optional author field blank.\n3. Choose a category and describe what helped you.\n4. Remove names, workplaces, addresses, case numbers, and identifying details.\n5. Add one practical takeaway, review the entry, and publish.\n\n**Important:** Only share your own experience. Do not identify another person or post confidential, defamatory, or unsafe material.","kind":"guide"}'::jsonb,now());

insert into public.help_articles(title,category,summary,body,kind,publication,published_at) values('Save or support a peer reflection','Peer Knowledge','Bookmarks keep a reflection available locally and upvotes show that it was useful.','1. Open Peer Knowledge and find a relevant reflection.
2. Select Save to keep it available in your Q data.
3. Select the thumbs-up control when it was helpful.
4. Use search and topic filters to find it again.
5. Treat peer content as lived experience rather than professional advice.','guide','{"title":"Save or support a peer reflection","category":"Peer Knowledge","summary":"Bookmarks keep a reflection available locally and upvotes show that it was useful.","body":"1. Open Peer Knowledge and find a relevant reflection.\n2. Select Save to keep it available in your Q data.\n3. Select the thumbs-up control when it was helpful.\n4. Use search and topic filters to find it again.\n5. Treat peer content as lived experience rather than professional advice.","kind":"guide"}'::jsonb,now());

insert into public.help_articles(title,category,summary,body,kind,publication,published_at) values('Use voice dictation in the Journal','Private Journal','Supported browsers can turn speech into a journal title or reflection.','1. Open or create a journal entry.
2. Select the microphone control for the field you want to dictate.
3. Allow microphone access only if you are comfortable doing so.
4. Speak clearly and stop dictation when finished.
5. Review and correct the transcription before saving.

**Important:** Browser speech recognition may use a platform speech service. Avoid dictation when others can overhear or when its processing is unsuitable for your privacy needs.','guide','{"title":"Use voice dictation in the Journal","category":"Private Journal","summary":"Supported browsers can turn speech into a journal title or reflection.","body":"1. Open or create a journal entry.\n2. Select the microphone control for the field you want to dictate.\n3. Allow microphone access only if you are comfortable doing so.\n4. Speak clearly and stop dictation when finished.\n5. Review and correct the transcription before saving.\n\n**Important:** Browser speech recognition may use a platform speech service. Avoid dictation when others can overhear or when its processing is unsuitable for your privacy needs.","kind":"guide"}'::jsonb,now());

insert into public.help_articles(title,category,summary,body,kind,publication,published_at) values('Export a journal entry as PDF','Private Journal','Create a portable copy for your own records or a trusted professional.','1. Open the journal entry you want to export.
2. Select the PDF export control.
3. Choose a safe download location.
4. Open the file and confirm it contains the intended entry.
5. Move or delete the download when it is no longer safe or needed.

**Important:** Downloaded PDFs sit outside Q’s privacy lock and may appear in browser download history.','guide','{"title":"Export a journal entry as PDF","category":"Private Journal","summary":"Create a portable copy for your own records or a trusted professional.","body":"1. Open the journal entry you want to export.\n2. Select the PDF export control.\n3. Choose a safe download location.\n4. Open the file and confirm it contains the intended entry.\n5. Move or delete the download when it is no longer safe or needed.\n\n**Important:** Downloaded PDFs sit outside Q’s privacy lock and may appear in browser download history.","kind":"guide"}'::jsonb,now());

insert into public.help_articles(title,category,summary,body,kind,publication,published_at) values('Review and remove saved Context Memory','Private Journal','The Journal provides visibility into user-authored context saved for future Q conversations.','1. Open Private Journal.
2. Find the Context Memory area.
3. Read each saved item and its date.
4. Delete anything inaccurate, outdated, or no longer wanted.
5. Refresh or revisit the area to confirm the item has gone.','guide','{"title":"Review and remove saved Context Memory","category":"Private Journal","summary":"The Journal provides visibility into user-authored context saved for future Q conversations.","body":"1. Open Private Journal.\n2. Find the Context Memory area.\n3. Read each saved item and its date.\n4. Delete anything inaccurate, outdated, or no longer wanted.\n5. Refresh or revisit the area to confirm the item has gone.","kind":"guide"}'::jsonb,now());

insert into public.help_articles(title,category,summary,body,kind,publication,published_at) values('Read the seven-day mood trend','Private Journal','The mood summary gives a simple view of recent check-ins, not a diagnosis.','1. Record mood check-ins consistently when useful.
2. Open the mood history in Private Journal.
3. Review the seven-day average and individual notes together.
4. Look for context and patterns rather than judging one number.
5. Discuss persistent concerns with an appropriate professional or trusted support person.

**Important:** Mood tracking cannot diagnose a mental-health condition or predict a crisis.','guide','{"title":"Read the seven-day mood trend","category":"Private Journal","summary":"The mood summary gives a simple view of recent check-ins, not a diagnosis.","body":"1. Record mood check-ins consistently when useful.\n2. Open the mood history in Private Journal.\n3. Review the seven-day average and individual notes together.\n4. Look for context and patterns rather than judging one number.\n5. Discuss persistent concerns with an appropriate professional or trusted support person.\n\n**Important:** Mood tracking cannot diagnose a mental-health condition or predict a crisis.","kind":"guide"}'::jsonb,now());

insert into public.help_articles(title,category,summary,body,kind,publication,published_at) values('Use Q when the connection is unreliable','Getting started','Several Q features retain local functionality, while account sync and hosted services require connectivity.','1. Use previously loaded local AI if its model remains cached.
2. Continue working with locally stored guides, journal data, and crisis-resource information.
3. Expect hosted AI, account updates, referrals, and subscription verification to wait for a connection.
4. Watch for offline or pending-sync indicators.
5. Reconnect before relying on data being available on another device.','guide','{"title":"Use Q when the connection is unreliable","category":"Getting started","summary":"Several Q features retain local functionality, while account sync and hosted services require connectivity.","body":"1. Use previously loaded local AI if its model remains cached.\n2. Continue working with locally stored guides, journal data, and crisis-resource information.\n3. Expect hosted AI, account updates, referrals, and subscription verification to wait for a connection.\n4. Watch for offline or pending-sync indicators.\n5. Reconnect before relying on data being available on another device.","kind":"guide"}'::jsonb,now());

insert into public.help_articles(title,category,summary,body,kind,publication,published_at) values('Understand sync and pending items','Account','The sync status shows whether local changes are waiting to reach supported account services.','1. Open Profile and Backup to review connection and sync status.
2. If offline, keep the app open until local saving finishes.
3. Reconnect to the internet.
4. Use the available sync action if required.
5. Confirm the pending count has reduced before changing device or clearing browser data.','guide','{"title":"Understand sync and pending items","category":"Account","summary":"The sync status shows whether local changes are waiting to reach supported account services.","body":"1. Open Profile and Backup to review connection and sync status.\n2. If offline, keep the app open until local saving finishes.\n3. Reconnect to the internet.\n4. Use the available sync action if required.\n5. Confirm the pending count has reduced before changing device or clearing browser data.","kind":"guide"}'::jsonb,now());

insert into public.help_articles(title,category,summary,body,kind,publication,published_at) values('Restore a Q backup carefully','Privacy & safety','Importing a compatible JSON backup can restore supported local Q data.','1. Make a current backup before importing another file.
2. Open Profile, then Backup and Restore.
3. Choose the Q JSON backup from a trusted location.
4. Confirm the import and allow Q to refresh.
5. Review profile, guides, journal, and other restored areas for accuracy.

**Important:** Only import a backup you created or fully trust. Keep an untouched copy until the restored data is verified.','guide','{"title":"Restore a Q backup carefully","category":"Privacy & safety","summary":"Importing a compatible JSON backup can restore supported local Q data.","body":"1. Make a current backup before importing another file.\n2. Open Profile, then Backup and Restore.\n3. Choose the Q JSON backup from a trusted location.\n4. Confirm the import and allow Q to refresh.\n5. Review profile, guides, journal, and other restored areas for accuracy.\n\n**Important:** Only import a backup you created or fully trust. Keep an untouched copy until the restored data is verified.","kind":"guide"}'::jsonb,now());

insert into public.help_articles(title,category,summary,body,kind,publication,published_at) values('Change your account password','Account','Signed-in users can update their password from Profile.','1. Open Profile and find Change password.
2. Enter a new password of at least the displayed minimum length.
3. Enter it again exactly.
4. Select Update password and wait for confirmation.
5. Store the new password in a trusted password manager.','guide','{"title":"Change your account password","category":"Account","summary":"Signed-in users can update their password from Profile.","body":"1. Open Profile and find Change password.\n2. Enter a new password of at least the displayed minimum length.\n3. Enter it again exactly.\n4. Select Update password and wait for confirmation.\n5. Store the new password in a trusted password manager.","kind":"guide"}'::jsonb,now());

insert into public.help_articles(title,category,summary,body,kind,publication,published_at) values('Create and track a referral','Subscription','Eligible accounts can share a referral link and track its status from Profile.','1. Open Profile and find Referrals.
2. Copy your personal referral link or enter the friend’s email to create one.
3. Share the link only with someone who wants it.
4. Return to Profile to view referral status and available credit.
5. Review the displayed expiry and invoice-credit rules.

**Important:** Self-referrals, refunds, disputes, and ineligible activity do not qualify for credit.','guide','{"title":"Create and track a referral","category":"Subscription","summary":"Eligible accounts can share a referral link and track its status from Profile.","body":"1. Open Profile and find Referrals.\n2. Copy your personal referral link or enter the friend’s email to create one.\n3. Share the link only with someone who wants it.\n4. Return to Profile to view referral status and available credit.\n5. Review the displayed expiry and invoice-credit rules.\n\n**Important:** Self-referrals, refunds, disputes, and ineligible activity do not qualify for credit.","kind":"guide"}'::jsonb,now());

insert into public.help_articles(title,category,summary,body,kind,publication,published_at) values('A PayPal subscription is still pending','Subscription','Q may need a short period to receive and verify PayPal’s subscription update.','1. Confirm the approval was completed on the PayPal-hosted page.
2. Return to Q using the supplied return link.
3. Keep the same Q account signed in.
4. Wait briefly and reopen the subscription area.
5. Check PayPal for the actual subscription status before attempting another purchase.
6. Contact support if Q and PayPal still disagree.','guide','{"title":"A PayPal subscription is still pending","category":"Subscription","summary":"Q may need a short period to receive and verify PayPal’s subscription update.","body":"1. Confirm the approval was completed on the PayPal-hosted page.\n2. Return to Q using the supplied return link.\n3. Keep the same Q account signed in.\n4. Wait briefly and reopen the subscription area.\n5. Check PayPal for the actual subscription status before attempting another purchase.\n6. Contact support if Q and PayPal still disagree.","kind":"guide"}'::jsonb,now());

insert into public.help_articles(title,category,summary,body,kind,publication,published_at) values('Switch between light and dark appearance','Accessibility','The theme control changes Q’s authenticated interface and remembers the choice on this browser.','1. On desktop, find the sun or moon button in the header action row.
2. Select it once to change theme.
3. Check that navigation, cards, text, and form controls have changed.
4. Select it again to return to the previous appearance.
5. If the choice is not retained, check whether the browser is clearing site storage.','guide','{"title":"Switch between light and dark appearance","category":"Accessibility","summary":"The theme control changes Q’s authenticated interface and remembers the choice on this browser.","body":"1. On desktop, find the sun or moon button in the header action row.\n2. Select it once to change theme.\n3. Check that navigation, cards, text, and form controls have changed.\n4. Select it again to return to the previous appearance.\n5. If the choice is not retained, check whether the browser is clearing site storage.","kind":"guide"}'::jsonb,now());

insert into public.help_articles(title,category,summary,body,kind,publication,published_at) values('Use Q more safely on a shared device','Privacy & safety','A few habits can reduce accidental exposure when other people use the same browser or device.','1. Use a separate protected device profile where possible.
2. Enable Q’s privacy lock and choose a short auto-lock delay.
3. Avoid saving passwords in a shared browser.
4. Use Notes mode when an immediate discreet screen is needed.
5. Sign out when finished and review downloaded exports.
6. Do not assume private browsing hides activity from device owners, networks, or monitoring software.','guide','{"title":"Use Q more safely on a shared device","category":"Privacy & safety","summary":"A few habits can reduce accidental exposure when other people use the same browser or device.","body":"1. Use a separate protected device profile where possible.\n2. Enable Q’s privacy lock and choose a short auto-lock delay.\n3. Avoid saving passwords in a shared browser.\n4. Use Notes mode when an immediate discreet screen is needed.\n5. Sign out when finished and review downloaded exports.\n6. Do not assume private browsing hides activity from device owners, networks, or monitoring software.","kind":"guide"}'::jsonb,now());

insert into public.help_articles(title,category,summary,body,kind,publication,published_at) values('Change the country shown in 24/7 support','Immediate support','The support panel uses profile country, browser locale, or a global fallback and lets you change the selection.','1. Select 24/7 Helpline.
2. Open the country selector near the top.
3. Choose the country where support is needed.
4. Review each service’s hours and contact methods.
5. Use the local emergency number immediately when there is imminent danger.','guide','{"title":"Change the country shown in 24/7 support","category":"Immediate support","summary":"The support panel uses profile country, browser locale, or a global fallback and lets you change the selection.","body":"1. Select 24/7 Helpline.\n2. Open the country selector near the top.\n3. Choose the country where support is needed.\n4. Review each service’s hours and contact methods.\n5. Use the local emergency number immediately when there is imminent danger.","kind":"guide"}'::jsonb,now());

insert into public.help_articles(title,category,summary,body,kind,publication,published_at) values('Use Q with accessibility settings','Accessibility','Q supports keyboard navigation, visible focus, responsive text, reduced motion, and semantic controls.','1. Use Tab and Shift+Tab to move through controls.
2. Press Enter or Space to activate the focused control.
3. Enable reduced motion in your device settings to stop animated spectrum effects.
4. Use browser zoom or device text scaling when needed.
5. Use the theme control to switch appearance.','guide','{"title":"Use Q with accessibility settings","category":"Accessibility","summary":"Q supports keyboard navigation, visible focus, responsive text, reduced motion, and semantic controls.","body":"1. Use Tab and Shift+Tab to move through controls.\n2. Press Enter or Space to activate the focused control.\n3. Enable reduced motion in your device settings to stop animated spectrum effects.\n4. Use browser zoom or device text scaling when needed.\n5. Use the theme control to switch appearance.","kind":"guide"}'::jsonb,now());

insert into public.help_articles(title,category,summary,body,kind,publication,published_at) values('Local AI is unavailable','Troubleshooting','Local Q Intelligence requires a WebGPU-capable browser and sufficient device storage.','1. Check the processing banner for WebGPU support information.
2. Update the browser and device graphics drivers where appropriate.
3. Ensure enough storage is available for the model download.
4. Keep the page open during the first model load.
5. Use Hosted AI if local mode is unsupported and you accept the disclosed processing.','guide','{"title":"Local AI is unavailable","category":"Troubleshooting","summary":"Local Q Intelligence requires a WebGPU-capable browser and sufficient device storage.","body":"1. Check the processing banner for WebGPU support information.\n2. Update the browser and device graphics drivers where appropriate.\n3. Ensure enough storage is available for the model download.\n4. Keep the page open during the first model load.\n5. Use Hosted AI if local mode is unsupported and you accept the disclosed processing.","kind":"guide"}'::jsonb,now());

insert into public.help_articles(title,category,summary,body,kind,publication,published_at) values('Sign-in, verification, or reset problems','Troubleshooting','Most account issues can be resolved by checking the correct email, redirect, and current session.','1. Confirm you are using the email associated with Q.
2. Check spam or junk folders for verification and reset messages.
3. Open the newest link; older links may have expired.
4. Return to https://q-ai.online/app after verification.
5. Use the password-reset request option if the normal reset flow remains unavailable.','guide','{"title":"Sign-in, verification, or reset problems","category":"Troubleshooting","summary":"Most account issues can be resolved by checking the correct email, redirect, and current session.","body":"1. Confirm you are using the email associated with Q.\n2. Check spam or junk folders for verification and reset messages.\n3. Open the newest link; older links may have expired.\n4. Return to https://q-ai.online/app after verification.\n5. Use the password-reset request option if the normal reset flow remains unavailable.","kind":"guide"}'::jsonb,now());

insert into public.help_articles(title,category,summary,body,kind,publication,published_at) values('Get immediate human support','Immediate support','Q can show country-aware crisis resources, but it is not an emergency service.','1. Select 24/7 Helpline in the app header.
2. Choose or verify your country.
3. Use the displayed official phone, text, or web resource.
4. If there is immediate danger, contact local emergency services now.
5. Move to a safer device or place if accessing support could put you at risk.','guide','{"title":"Get immediate human support","category":"Immediate support","summary":"Q can show country-aware crisis resources, but it is not an emergency service.","body":"1. Select 24/7 Helpline in the app header.\n2. Choose or verify your country.\n3. Use the displayed official phone, text, or web resource.\n4. If there is immediate danger, contact local emergency services now.\n5. Move to a safer device or place if accessing support could put you at risk.","kind":"guide"}'::jsonb,now());

INSERT INTO public.help_articles (title,category,summary,body,kind,publication,published_at) VALUES ('How can I contact support?','Support','Use Help in Q or the public Support page to start a private request.','Open **Help** in Q and choose support, or open [/support](/support). Describe the issue and include steps to reproduce it. Signed-in users can follow their requests from Help.','faq','{"title": "How can I contact support?", "category": "Support", "summary": "Use Help in Q or the public Support page to start a private request.", "body": "Open **Help** in Q and choose support, or open [/support](/support). Describe the issue and include steps to reproduce it. Signed-in users can follow their requests from Help.", "kind": "faq"}'::jsonb,now());

INSERT INTO public.help_articles (title,category,summary,body,kind,publication,published_at) VALUES ('How do I return to a guest support request?','Support','Guest support access uses the secure link sent to your email address.','Use the secure access link sent to the email address you used for your support request. Keep that link private. If access expires, request another link from [/support](/support).','faq','{"title": "How do I return to a guest support request?", "category": "Support", "summary": "Guest support access uses the secure link sent to your email address.", "body": "Use the secure access link sent to the email address you used for your support request. Keep that link private. If access expires, request another link from [/support](/support).", "kind": "faq"}'::jsonb,now());

INSERT INTO public.help_articles (title,category,summary,body,kind,publication,published_at) VALUES ('Which files can I attach to support?','Support','Support accepts screenshots, PDFs and plain text within the file limits.','Attach PNG or JPEG screenshots, PDF documents or plain text files. Each file must be no larger than **2 MB**. A request can have up to **10 files**, including staff-only files. Remove unnecessary files if you reach the limit. Files selected for upload are not retained after refreshing the page.','faq','{"title": "Which files can I attach to support?", "category": "Support", "summary": "Support accepts screenshots, PDFs and plain text within the file limits.", "body": "Attach PNG or JPEG screenshots, PDF documents or plain text files. Each file must be no larger than **2 MB**. A request can have up to **10 files**, including staff-only files. Remove unnecessary files if you reach the limit. Files selected for upload are not retained after refreshing the page.", "kind": "faq"}'::jsonb,now());

INSERT INTO public.help_articles (title,category,summary,body,kind,publication,published_at) VALUES ('Who can see my support files?','Support','Support files are private to the request and authorised support staff.','Files are stored privately and downloaded through access checks for the support request. Staff can add internal files that are visible only to authorised staff. Avoid including passwords, payment details or unnecessary personal information.','faq','{"title": "Who can see my support files?", "category": "Support", "summary": "Support files are private to the request and authorised support staff.", "body": "Files are stored privately and downloaded through access checks for the support request. Staff can add internal files that are visible only to authorised staff. Avoid including passwords, payment details or unnecessary personal information.", "kind": "faq"}'::jsonb,now());

INSERT INTO public.help_articles (title,category,summary,body,kind,publication,published_at) VALUES ('Where can I suggest a feature?','Support','Use the feedback area to suggest improvements and view the public roadmap.','Open **Help** in Q and use the feedback area to suggest an improvement. Visit [/roadmap](/roadmap) for items that staff have published to the public roadmap. Private submissions and staff drafts do not appear there.','faq','{"title": "Where can I suggest a feature?", "category": "Support", "summary": "Use the feedback area to suggest improvements and view the public roadmap.", "body": "Open **Help** in Q and use the feedback area to suggest an improvement. Visit [/roadmap](/roadmap) for items that staff have published to the public roadmap. Private submissions and staff drafts do not appear there.", "kind": "faq"}'::jsonb,now());
