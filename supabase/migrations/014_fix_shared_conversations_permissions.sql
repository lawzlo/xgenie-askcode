-- Grant permissions to service_role for shared_conversations
GRANT ALL ON public.shared_conversations TO service_role;
GRANT ALL ON public.audit_logs TO service_role;

-- Also grant to authenticated users
GRANT SELECT, INSERT, DELETE ON public.shared_conversations TO authenticated;
GRANT SELECT ON public.audit_logs TO authenticated;
