alter table public.peer_knowledge_posts
  drop constraint if exists peer_knowledge_posts_status_check;

alter table public.peer_knowledge_posts
  add constraint peer_knowledge_posts_status_check
  check (status in ('pending', 'approved', 'rejected', 'changes_needed', 'escalated_for_advice', 'archived'));
