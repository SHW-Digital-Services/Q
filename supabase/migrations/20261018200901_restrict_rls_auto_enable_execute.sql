-- This zero-argument helper is invoked by the ensure_rls DDL event trigger.
-- It is an internal schema-maintenance utility, not an application RPC.
-- Keep existing trusted grants (for example, service_role) unchanged.
revoke execute on function public.rls_auto_enable()
  from authenticated, anon, public;
