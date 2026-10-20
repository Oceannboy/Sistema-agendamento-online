-- =====================================================================
-- 0006_lembretes.sql  (OPCIONAL: e-mail de confirmação e lembrete 24h antes)
--
-- Como funciona:
--  1. Colunas confirmacao_enviada e lembrete_enviado em agendamentos
--     (cada aviso é enviado uma única vez).
--  2. Trigger BEFORE: quando um agendamento nasce ou muda de horário/serviço,
--     as marcas voltam ao zero. Quem agenda com menos de 24h de antecedência
--     já recebe a confirmação, então o lembrete é marcado como enviado.
--  3. Trigger AFTER: avisa a Edge Function "notificacoes" (via pg_net,
--     assíncrono, depois do commit). Se a chamada falhar, o agendamento NÃO
--     é afetado: o erro vira apenas um aviso no log.
--  4. Cron de hora em hora (pg_cron): chama a mesma função, que envia os
--     lembretes e também as confirmações que, por algum motivo, ainda
--     estejam pendentes (rede de segurança).
--
-- Segredos (NUNCA escreva aqui): ficam no Vault. Veja o README e o
-- cabeçalho de supabase/functions/notificacoes/index.ts:
--   select vault.create_secret('https://SEU-PROJETO.supabase.co/functions/v1/notificacoes', 'notificacoes_url');
--   select vault.create_secret('um-segredo-longo-e-aleatorio', 'notificacoes_segredo');
-- Sem esses dois segredos o sistema funciona normalmente, só não envia e-mails.
-- =====================================================================

create extension if not exists pg_net;
create extension if not exists pg_cron;   -- cria o próprio schema "cron"

-- ---------------------------------------------------------------------
-- 1) Colunas (idempotente: só roda a carga inicial na primeira vez)
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name = 'agendamentos'
       and column_name = 'confirmacao_enviada'
  ) then
    alter table public.agendamentos
      add column confirmacao_enviada boolean not null default false,
      add column lembrete_enviado    boolean not null default false;

    -- Agendamentos que já existiam não recebem confirmação retroativa;
    -- os futuros ainda recebem o lembrete.
    update public.agendamentos
       set confirmacao_enviada = true,
           lembrete_enviado    = (inicio <= now());
  end if;
end
$$;

-- Acelera a busca do que está pendente de aviso.
create index if not exists agendamentos_pendentes_aviso_idx
  on public.agendamentos (inicio)
  where status = 'confirmado' and (not confirmacao_enviada or not lembrete_enviado);

-- ---------------------------------------------------------------------
-- 2) BEFORE: zera as marcas quando o horário ou o serviço mudam
-- ---------------------------------------------------------------------
create or replace function public.agendamento_marca_notificacoes()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT'
     or new.inicio     is distinct from old.inicio
     or new.servico_id is distinct from old.servico_id then
    new.confirmacao_enviada := false;
    -- menos de 24h para o atendimento: a confirmação já serve de lembrete
    new.lembrete_enviado := (new.inicio <= now() + interval '24 hours');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_agendamento_notificacoes_marcas on public.agendamentos;
create trigger trg_agendamento_notificacoes_marcas
before insert or update of inicio, servico_id on public.agendamentos
for each row execute function public.agendamento_marca_notificacoes();

-- ---------------------------------------------------------------------
-- 3) AFTER: avisa a Edge Function (assíncrono; nunca derruba o agendamento)
-- ---------------------------------------------------------------------
create or replace function public.agendamento_avisa_notificacoes()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_url      text;
  v_segredo  text;
begin
  if new.status <> 'confirmado' then
    return null;
  end if;
  if tg_op = 'UPDATE'
     and new.inicio     is not distinct from old.inicio
     and new.servico_id is not distinct from old.servico_id then
    return null;
  end if;

  begin
    select decrypted_secret into v_url
      from vault.decrypted_secrets where name = 'notificacoes_url';
    select decrypted_secret into v_segredo
      from vault.decrypted_secrets where name = 'notificacoes_segredo';

    if v_url is null or v_segredo is null then
      return null;   -- e-mails ainda não configurados
    end if;

    perform net.http_post(
      url                  := v_url,
      headers              := jsonb_build_object(
                                'Content-Type', 'application/json',
                                'x-notificacoes-segredo', v_segredo),
      body                 := jsonb_build_object('tarefa', 'confirmacoes'),
      timeout_milliseconds := 5000
    );
  exception when others then
    raise warning 'notificacoes: falha ao avisar a função (%): %', sqlstate, sqlerrm;
  end;

  return null;
end;
$$;

drop trigger if exists trg_agendamento_notificacoes_aviso on public.agendamentos;
create trigger trg_agendamento_notificacoes_aviso
after insert or update of inicio, servico_id on public.agendamentos
for each row execute function public.agendamento_avisa_notificacoes();

-- Funções de trigger: ninguém chama pela API.
revoke execute on function public.agendamento_marca_notificacoes()
  from public, anon, authenticated, service_role;
revoke execute on function public.agendamento_avisa_notificacoes()
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- 4) Cron de hora em hora (UTC: o minuto 0 é o mesmo em qualquer fuso)
-- ---------------------------------------------------------------------
select cron.unschedule(jobid) from cron.job where jobname = 'notificacoes-agenda';

select cron.schedule(
  'notificacoes-agenda',
  '0 * * * *',
  $cron$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'notificacoes_url'),
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-notificacoes-segredo',
                 (select decrypted_secret from vault.decrypted_secrets where name = 'notificacoes_segredo')),
    body    := jsonb_build_object('tarefa', 'tudo'),
    timeout_milliseconds := 60000
  )
  where exists (select 1 from vault.decrypted_secrets where name = 'notificacoes_url')
    and exists (select 1 from vault.decrypted_secrets where name = 'notificacoes_segredo');
  $cron$
);
