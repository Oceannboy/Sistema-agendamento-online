-- =====================================================================
-- supabase/tests/testes_lembretes.sql
-- Testes da Etapa 6 (e-mail de confirmação e lembrete). Rode no SQL Editor
-- DEPOIS de aplicar schema.sql, seed.sql e migrations/0006_lembretes.sql.
--
-- Estes testes cobrem só o banco: as marcas confirmacao_enviada e
-- lembrete_enviado, os triggers e o agendamento do cron. O envio de e-mail
-- em si (Edge Function + Resend) se testa pelo roteiro manual do README.
-- Os dados de teste são removidos no fim.
--
-- Atenção: se os e-mails já estiverem configurados (segredos no Vault), criar
-- os agendamentos de teste aciona a Edge Function. O endereço de teste termina
-- em .invalid, então nada é entregue a ninguém; no máximo aparece uma tentativa
-- recusada nos logs da função.
-- =====================================================================

drop table if exists pg_temp.resultado_testes;
create temp table resultado_testes (n serial primary key, teste text, ok boolean, detalhe text);

delete from public.agendamentos where titulo like 'TESTE lembrete%';
delete from auth.users where id = '00000000-0000-4000-8000-0000000000e1';

insert into auth.users (id, aud, role, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-0000000000e1', 'authenticated', 'authenticated',
   'teste.lembrete@teste.invalid',
   '{"nome":"Cliente Lembrete","usuario":"teste_lembrete","telefone":"11 90000-0009"}');

-- ---------------------------------------------------------------------
-- L01 Agendamento com mais de 24h: ambas as marcas começam em "não enviado"
-- L02 Agendamento com menos de 24h: a confirmação serve de lembrete
-- (inserção direta como postgres, em horários improváveis de colidir)
-- ---------------------------------------------------------------------
do $t$
declare
  v_cli constant uuid := '00000000-0000-4000-8000-0000000000e1';
  v_serv uuid;
  v_longe public.agendamentos%rowtype;
  v_perto public.agendamentos%rowtype;
  v_ok1 boolean := false; v_ok2 boolean := false;
  v_det text;
begin
  begin
    select id into v_serv from public.servicos where nome = 'Pedicure';

    insert into public.agendamentos (cliente_id, servico_id, titulo, inicio, fim)
    values (v_cli, v_serv, 'TESTE lembrete longe',
            date_trunc('minute', now()) + interval '10 days 7 minutes',
            date_trunc('minute', now()) + interval '10 days 67 minutes')
    returning * into v_longe;

    insert into public.agendamentos (cliente_id, servico_id, titulo, inicio, fim)
    values (v_cli, v_serv, 'TESTE lembrete perto',
            date_trunc('minute', now()) + interval '5 hours 3 minutes',
            date_trunc('minute', now()) + interval '6 hours 3 minutes')
    returning * into v_perto;

    v_ok1 := not v_longe.confirmacao_enviada and not v_longe.lembrete_enviado;
    v_ok2 := not v_perto.confirmacao_enviada and v_perto.lembrete_enviado;
    v_det := format('longe: confirmacao=%s lembrete=%s | perto: confirmacao=%s lembrete=%s',
                    v_longe.confirmacao_enviada, v_longe.lembrete_enviado,
                    v_perto.confirmacao_enviada, v_perto.lembrete_enviado);
  exception when others then
    v_det := 'erro inesperado: ' || sqlstate || ' ' || sqlerrm;
  end;
  insert into resultado_testes (teste, ok, detalhe)
  values ('L01 agendamento com mais de 24h nasce sem avisos enviados', v_ok1, v_det),
         ('L02 agendamento com menos de 24h já conta o lembrete como enviado', v_ok2, v_det);
end
$t$;

-- ---------------------------------------------------------------------
-- L03 Mudar só o título NÃO zera as marcas
-- L04 Mudar o horário zera a confirmação e recalcula o lembrete
-- ---------------------------------------------------------------------
do $t$
declare
  v_id uuid;
  v_antes public.agendamentos%rowtype;
  v_titulo public.agendamentos%rowtype;
  v_horario public.agendamentos%rowtype;
  v_ok3 boolean := false; v_ok4 boolean := false;
  v_det3 text; v_det4 text;
begin
  begin
    select id into v_id from public.agendamentos where titulo = 'TESTE lembrete longe';

    -- simula "e-mail já enviado"
    update public.agendamentos
       set confirmacao_enviada = true, lembrete_enviado = true
     where id = v_id;

    update public.agendamentos set titulo = 'TESTE lembrete longe (novo título)'
     where id = v_id returning * into v_titulo;
    v_ok3 := v_titulo.confirmacao_enviada and v_titulo.lembrete_enviado;
    v_det3 := format('depois de mudar o título: confirmacao=%s lembrete=%s',
                     v_titulo.confirmacao_enviada, v_titulo.lembrete_enviado);

    select * into v_antes from public.agendamentos where id = v_id;
    update public.agendamentos
       set inicio = v_antes.inicio + interval '1 day',
           fim    = v_antes.fim + interval '1 day'
     where id = v_id returning * into v_horario;
    v_ok4 := not v_horario.confirmacao_enviada and not v_horario.lembrete_enviado;
    v_det4 := format('depois de mudar o horário (ainda > 24h): confirmacao=%s lembrete=%s',
                     v_horario.confirmacao_enviada, v_horario.lembrete_enviado);
  exception when others then
    v_det3 := 'erro inesperado: ' || sqlstate || ' ' || sqlerrm;
    v_det4 := v_det3;
  end;
  insert into resultado_testes (teste, ok, detalhe)
  values ('L03 mudar só o título mantém as marcas de envio', v_ok3, v_det3),
         ('L04 mudar o horário zera a confirmação e recalcula o lembrete', v_ok4, v_det4);
end
$t$;

-- ---------------------------------------------------------------------
-- L05 O agendamento NUNCA falha por causa dos e-mails (trigger AFTER blindado).
-- Se o Vault tiver os segredos, o aviso é só enfileirado (pg_net, assíncrono).
-- ---------------------------------------------------------------------
do $t$
declare
  v_cli constant uuid := '00000000-0000-4000-8000-0000000000e1';
  v_serv uuid;
  v_ok boolean := false;
  v_det text;
begin
  begin
    select id into v_serv from public.servicos where nome = 'Pedicure';
    insert into public.agendamentos (cliente_id, servico_id, titulo, inicio, fim)
    values (v_cli, v_serv, 'TESTE lembrete resiliencia',
            date_trunc('minute', now()) + interval '12 days 11 minutes',
            date_trunc('minute', now()) + interval '12 days 71 minutes');
    v_ok := true;
    v_det := 'gravação concluída mesmo com o aviso de e-mail ligado ou desligado';
  exception when others then
    v_det := 'o trigger quebrou a gravação: ' || sqlstate || ' ' || sqlerrm;
  end;
  insert into resultado_testes (teste, ok, detalhe)
  values ('L05 criar agendamento nunca falha por causa do aviso de e-mail', v_ok, v_det);
end
$t$;

-- ---------------------------------------------------------------------
-- L06 Cron de hora em hora agendado; funções de trigger fechadas para a API
-- ---------------------------------------------------------------------
do $t$
declare
  v_cron text;
  v_ok boolean;
begin
  select schedule into v_cron from cron.job where jobname = 'notificacoes-agenda';
  v_ok := v_cron = '0 * * * *'
          and not has_function_privilege('authenticated', 'public.agendamento_avisa_notificacoes()', 'execute')
          and not has_function_privilege('anon', 'public.agendamento_marca_notificacoes()', 'execute');
  insert into resultado_testes (teste, ok, detalhe)
  values ('L06 cron "notificacoes-agenda" de hora em hora e triggers fechados', v_ok,
          format('agenda do cron: %s', coalesce(v_cron, 'NÃO ENCONTRADO')));
end
$t$;

-- Limpeza
delete from public.agendamentos where titulo like 'TESTE lembrete%';
delete from auth.users where id = '00000000-0000-4000-8000-0000000000e1';

select n, case when ok then 'OK' else 'FALHOU' end as resultado, teste, detalhe
  from resultado_testes
union all
select 999,
       case when bool_and(ok) then 'TUDO OK' else 'HÁ FALHAS' end,
       'RESUMO',
       format('%s de %s testes passaram', count(*) filter (where ok), count(*))
  from resultado_testes
order by n;
