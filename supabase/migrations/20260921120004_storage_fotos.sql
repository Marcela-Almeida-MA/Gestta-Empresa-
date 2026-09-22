-- =====================================================================
-- MIGRATION 4 · STORAGE (FOTOS DOS PRODUTOS)
--
-- Bucket PRIVADO: as fotos só são acessadas por URL assinada (temporária).
-- Caminho dos arquivos:  {empresa_id}/{produto_id}/{nome-do-arquivo}
-- O primeiro trecho do caminho (a pasta) é o id da empresa e é ele que
-- define quem pode acessar o arquivo.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'produtos-fotos',
  'produtos-fotos',
  false,                                              -- privado
  5242880,                                            -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- Ver as fotos: qualquer membro da empresa dona da pasta.
create policy "fotos: membros leem"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'produtos-fotos'
    and (storage.foldername(name))[1] in (
      select e.id::text from public.empresas_do_usuario() as e(id)
    )
  );

-- Enviar, trocar e apagar fotos: somente admin da empresa dona da pasta.
create policy "fotos: admin envia"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'produtos-fotos'
    and (storage.foldername(name))[1] in (
      select e.id::text from public.empresas_do_usuario() as e(id)
       where public.eh_admin_da_empresa(e.id)
    )
  );

create policy "fotos: admin altera"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'produtos-fotos'
    and (storage.foldername(name))[1] in (
      select e.id::text from public.empresas_do_usuario() as e(id)
       where public.eh_admin_da_empresa(e.id)
    )
  )
  with check (
    bucket_id = 'produtos-fotos'
    and (storage.foldername(name))[1] in (
      select e.id::text from public.empresas_do_usuario() as e(id)
       where public.eh_admin_da_empresa(e.id)
    )
  );

create policy "fotos: admin apaga"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'produtos-fotos'
    and (storage.foldername(name))[1] in (
      select e.id::text from public.empresas_do_usuario() as e(id)
       where public.eh_admin_da_empresa(e.id)
    )
  );
