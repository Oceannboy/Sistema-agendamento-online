-- =====================================================================
-- 0005_storage.sql
-- Storage: fotos dos serviços (escrita só admin) e avatares das usuárias
-- (cada uma escreve só na própria pasta: avatares/<id_da_usuaria>/arquivo).
-- Os buckets são públicos para leitura (URL pública), mas só quem tem
-- política consegue enviar, trocar ou apagar arquivos.
-- Limite de 2 MB por arquivo e só JPEG, PNG ou WebP.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('servicos-fotos', 'servicos-fotos', true, 2097152, array['image/jpeg', 'image/png', 'image/webp']),
  ('avatares',       'avatares',       true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- servicos-fotos: só admin ----------------------------------------------
create policy "servicos-fotos: admin le"
  on storage.objects for select to authenticated
  using (bucket_id = 'servicos-fotos' and (select public.is_admin()));

create policy "servicos-fotos: admin envia"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'servicos-fotos' and (select public.is_admin()));

create policy "servicos-fotos: admin troca"
  on storage.objects for update to authenticated
  using (bucket_id = 'servicos-fotos' and (select public.is_admin()))
  with check (bucket_id = 'servicos-fotos' and (select public.is_admin()));

create policy "servicos-fotos: admin apaga"
  on storage.objects for delete to authenticated
  using (bucket_id = 'servicos-fotos' and (select public.is_admin()));

-- avatares: cada usuária na própria pasta -------------------------------
create policy "avatares: le o proprio"
  on storage.objects for select to authenticated
  using (bucket_id = 'avatares'
         and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "avatares: envia o proprio"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatares'
              and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "avatares: troca o proprio"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatares'
         and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatares'
              and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "avatares: apaga o proprio"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatares'
         and (storage.foldername(name))[1] = (select auth.uid())::text);
