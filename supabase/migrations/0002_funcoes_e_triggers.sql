-- =====================================================================
-- 0002_funcoes_e_triggers.sql
-- Funções auxiliares e triggers.
-- Todas as funções security definer têm search_path fixo.
-- Os GRANT/REVOKE de execução ficam na migration 0004.
-- =====================================================================

-- ---------------------------------------------------------------------
-- is_admin(): o usuário logado é administrador?
-- ---------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.perfis
    where id = auth.uid() and papel = 'admin'
  );
$$;

-- ---------------------------------------------------------------------
-- Normalização de perfis: usuário sempre minúsculo, textos sem espaços nas pontas.
-- ---------------------------------------------------------------------
create or replace function public.perfis_normaliza()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.usuario  := lower(trim(new.usuario));
  new.nome     := trim(coalesce(new.nome, ''));
  new.telefone := nullif(trim(coalesce(new.telefone, '')), '');
  return new;
end;
$$;

create trigger perfis_normaliza
before insert or update on public.perfis
for each row execute function public.perfis_normaliza();

-- ---------------------------------------------------------------------
-- Proteção contra escalada de privilégio:
-- a usuária NÃO altera o próprio papel (nem o id). Só admin altera papel.
--
-- A função é SECURITY INVOKER de propósito: current_user é o papel real da
-- sessão. Quem chega pela API (anon/authenticated) precisa ser admin;
-- SQL Editor (postgres) e service_role são confiáveis.
-- ---------------------------------------------------------------------
create or replace function public.perfis_protege_campos()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.id is distinct from old.id then
    raise exception 'campo_protegido' using errcode = 'AG013';
  end if;

  if new.papel is distinct from old.papel then
    if current_user in ('anon', 'authenticated') and not public.is_admin() then
      raise exception 'papel_protegido' using errcode = 'AG013';
    end if;
  end if;

  return new;
end;
$$;

create trigger perfis_protege_campos
before update on public.perfis
for each row execute function public.perfis_protege_campos();

-- ---------------------------------------------------------------------
-- handle_new_user: cria o perfil quando alguém se cadastra no Supabase Auth.
-- Lê nome, usuario e telefone dos metadados do cadastro
-- (auth.signUp({ options: { data: { nome, usuario, telefone } } })).
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario text;
begin
  v_usuario := lower(trim(coalesce(new.raw_user_meta_data->>'usuario', '')));

  if v_usuario = '' then
    -- Usuário criado fora do app (ex.: painel do Supabase): usuário provisório.
    v_usuario := 'u' || substr(replace(new.id::text, '-', ''), 1, 10);
  end if;

  insert into public.perfis (id, nome, usuario, telefone)
  values (
    new.id,
    left(trim(coalesce(new.raw_user_meta_data->>'nome', '')), 80),
    v_usuario,
    left(nullif(trim(coalesce(new.raw_user_meta_data->>'telefone', '')), ''), 20)
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- define_fim: o fim do atendimento é calculado no servidor a partir da
-- duração do serviço (nunca vem da tela). Recalcula só quando início ou
-- serviço mudam, para não alterar agendamentos antigos se a duração mudar.
-- ---------------------------------------------------------------------
create or replace function public.define_fim()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  select new.inicio + make_interval(mins => s.duracao_min)
    into new.fim
    from public.servicos s
   where s.id = new.servico_id;
  return new;
end;
$$;

create trigger trg_define_fim
before insert or update of inicio, servico_id on public.agendamentos
for each row execute function public.define_fim();

-- ---------------------------------------------------------------------
-- usuario_disponivel: usada só pelo servidor (service_role) no cadastro.
-- ---------------------------------------------------------------------
create or replace function public.usuario_disponivel(p_usuario text)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select not exists (
    select 1 from public.perfis where usuario = lower(trim(p_usuario))
  );
$$;
