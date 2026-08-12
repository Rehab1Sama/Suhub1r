REVOKE EXECUTE ON FUNCTION public.can_record_academic(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_record_academic(uuid, uuid) TO authenticated;