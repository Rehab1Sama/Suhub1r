CREATE POLICY "tenant_logos_public_read"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'tenant-logos');

CREATE POLICY "tenant_logos_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'tenant-logos'
  AND (
    public.is_platform_owner(auth.uid())
    OR public.is_tenant_manager(auth.uid(), NULLIF(split_part(name, '/', 1), '')::uuid)
  )
);

CREATE POLICY "tenant_logos_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'tenant-logos'
  AND (
    public.is_platform_owner(auth.uid())
    OR public.is_tenant_manager(auth.uid(), NULLIF(split_part(name, '/', 1), '')::uuid)
  )
);

CREATE POLICY "tenant_logos_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'tenant-logos'
  AND (
    public.is_platform_owner(auth.uid())
    OR public.is_tenant_manager(auth.uid(), NULLIF(split_part(name, '/', 1), '')::uuid)
  )
);