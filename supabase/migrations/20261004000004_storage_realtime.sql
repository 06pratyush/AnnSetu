-- Photo buckets (public read) and live order updates.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('produce-images', 'produce-images', true, 2097152, array['image/webp', 'image/jpeg', 'image/png']),
  ('avatars', 'avatars', true, 1048576, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

-- Uploads go to <bucket>/<user id>/<file>; users may only write inside their own folder.
create policy "photos: owners upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('produce-images', 'avatars')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "photos: owners update" on storage.objects
  for update to authenticated
  using (bucket_id in ('produce-images', 'avatars') and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id in ('produce-images', 'avatars') and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "photos: owners delete" on storage.objects
  for delete to authenticated
  using (bucket_id in ('produce-images', 'avatars') and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Realtime: farmers get new orders live, buyers get status changes. RLS still applies per subscriber.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.orders;
    exception when duplicate_object then
      null;
    end;
  end if;
end;
$$;
