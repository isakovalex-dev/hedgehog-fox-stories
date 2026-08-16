-- This browser-facing display RPC must not be callable with server-only
-- credentials. The server never needs it: paid endpoints reserve quota via
-- separate service-role-only functions.
revoke execute on function public.get_current_usage() from service_role;
