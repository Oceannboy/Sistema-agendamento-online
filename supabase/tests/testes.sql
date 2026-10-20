-- =====================================================================
-- supabase/tests/testes.sql
-- Testes do banco. Rode no SQL Editor do Supabase (papel postgres), de
-- preferência num projeto de desenvolvimento.
--
-- PRÉ-REQUISITOS: schema.sql e seed.sql já aplicados, e nenhum agendamento
-- real nos próximos ~10 dias (os testes usam a próxima terça-feira + 7 dias
-- e os dias vizinhos).
--
-- COMO FUNCIONA: cria 3 usuários de teste (cliente A, cliente B e admin) e
-- "vira" cada um com set local role + claims JWT, como a API do Supabase faz.
-- Ao final remove todos os dados de teste e mostra uma tabela com o resultado
-- (OK / FALHOU) de cada teste.
--
-- LIMITAÇÃO: um único script não consegue simular duas conexões ao mesmo
-- tempo. O teste T11 prova que a constraint sem_conflito recusa a sobreposição
-- no próprio banco; o teste de concorrência real (dois cliques simultâneos)
-- está no roteiro manual do README (duas abas, mesmo horário).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0) Preparação: tabelas temporárias, limpeza e usuários de teste
-- ---------------------------------------------------------------------
drop table if exists pg_temp.resultado_testes;
drop table if exists pg_temp.ctx;
create temp table resultado_testes (n serial primary key, teste text, ok boolean, detalhe text);
create temp table ctx (chave text primary key, valor text);

select set_config('request.jwt.claims', '', true);

delete from public.agendamentos
 where titulo like 'TESTE%' or cliente_nome_avulso like 'TESTE%';
delete from public.bloqueios where motivo like 'TESTE%';
delete from auth.users where id in (
  '00000000-0000-4000-8000-0000000000a1',
  '00000000-0000-4000-8000-0000000000b2',
  '00000000-0000-4000-8000-0000000000ad',
  '00000000-0000-4000-8000-0000000000c3'
);

insert into auth.users (id, aud, role, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-0000000000a1', 'authenticated', 'authenticated', 'teste.a@teste.invalid',
   '{"nome":"Cliente A","usuario":"Teste_A","telefone":"11 90000-0001"}'),
  ('00000000-0000-4000-8000-0000000000b2', 'authenticated', 'authenticated', 'teste.b@teste.invalid',
   '{"nome":"Cliente B","usuario":"teste_b","telefone":"11 90000-0002"}'),
  ('00000000-0000-4000-8000-0000000000ad', 'authenticated', 'authenticated', 'teste.admin@teste.invalid',
   '{"nome":"Admin Teste","usuario":"teste_admin","telefone":"11 90000-0003"}');

-- promove o admin (SQL Editor é papel confiável: o trigger permite)
update public.perfis set papel = 'admin'
 where id = '00000000-0000-4000-8000-0000000000ad';

-- ---------------------------------------------------------------------
-- T01 Trigger handle_new_user: nome, usuário (normalizado) e telefone
-- ---------------------------------------------------------------------
do $t$
declare
  v_p public.perfis%rowtype;
  v_ok boolean := false;
  v_det text;
begin
  begin
    select * into v_p from public.perfis where id = '00000000-0000-4000-8000-0000000000a1';
    v_ok := found and v_p.usuario = 'teste_a' and v_p.nome = 'Cliente A'
            and v_p.telefone = '11 90000-0001' and v_p.papel = 'cliente';
    v_det := format('usuario=%s nome=%s telefone=%s papel=%s', v_p.usuario, v_p.nome, v_p.telefone, v_p.papel);
  exception when others then
    v_ok := false; v_det := 'erro inesperado: ' || sqlstate || ' ' || sqlerrm;
  end;
  insert into resultado_testes (teste, ok, detalhe)
  values ('T01 perfil criado pelo trigger com metadados do cadastro', v_ok, v_det);
end
$t$;

-- ---------------------------------------------------------------------
-- T02 Usuário é único (sem diferenciar maiúsculas de minúsculas)
-- ---------------------------------------------------------------------
do $t$
declare
  v_ok boolean := false;
  v_det text;
begin
  begin
    begin
      insert into auth.users (id, aud, role, email, raw_user_meta_data) values
        ('00000000-0000-4000-8000-0000000000c3', 'authenticated', 'authenticated',
         'teste.c@teste.invalid', '{"usuario":"TESTE_A"}');
      v_ok := false; v_det := 'usuário duplicado foi aceito';
    exception when unique_violation then
      v_ok := true; v_det := 'usuário duplicado recusado';
    end;
  exception when others then
    v_ok := false; v_det := 'erro inesperado: ' || sqlstate || ' ' || sqlerrm;
  end;
  insert into resultado_testes (teste, ok, detalhe)
  values ('T02 usuário único (case-insensitive)', v_ok, v_det);
end
$t$;

-- ---------------------------------------------------------------------
-- T03 criar_agendamento: fim e status definidos no servidor
-- (cria a base usada pelos testes seguintes)
--   terça (hoje + 7 ou mais): A = Pedicure 09:00-10:00 | B = Pedicure 11:00-12:00
--   => vão livre de exatamente 60 min entre 10:00 e 11:00
-- ---------------------------------------------------------------------
do $t$
declare
  v_a   constant uuid := '00000000-0000-4000-8000-0000000000a1';
  v_b   constant uuid := '00000000-0000-4000-8000-0000000000b2';
  v_pedi uuid;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_terca date;
  v_ra public.agendamentos%rowtype;
  v_rb public.agendamentos%rowtype;
  v_ok boolean := false;
  v_det text;
begin
  begin
    v_terca := v_hoje + (((2 - extract(dow from v_hoje)::int) + 7) % 7) + 7;
    select id into v_pedi from public.servicos where nome = 'Pedicure';

    perform set_config('request.jwt.claims', json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
    set local role authenticated;
    select * into v_ra from public.criar_agendamento(v_pedi, (v_terca + time '09:00') at time zone 'America/Sao_Paulo', null);
    reset role;

    perform set_config('request.jwt.claims', json_build_object('sub', v_b, 'role', 'authenticated')::text, true);
    set local role authenticated;
    select * into v_rb from public.criar_agendamento(v_pedi, (v_terca + time '11:00') at time zone 'America/Sao_Paulo', 'TESTE B');
    reset role;

    perform set_config('request.jwt.claims', '', true);
    insert into ctx values ('ag_a', v_ra.id::text), ('ag_b', v_rb.id::text), ('terca', v_terca::text);

    v_ok := v_ra.cliente_id = v_a
            and v_ra.status = 'confirmado'
            and v_ra.titulo = 'Pedicure'
            and (v_ra.fim - v_ra.inicio) = interval '60 minutes'
            and v_rb.titulo = 'TESTE B';
    v_det := format('status=%s titulo=%s duracao=%s', v_ra.status, v_ra.titulo, v_ra.fim - v_ra.inicio);
  exception when others then
    v_ok := false; v_det := 'erro inesperado: ' || sqlstate || ' ' || sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  insert into resultado_testes (teste, ok, detalhe)
  values ('T03 criar_agendamento define fim, status e título no servidor', v_ok, v_det);
end
$t$;

-- ---------------------------------------------------------------------
-- T04 Cliente A não vê agendamento do cliente B (e vice-versa)
-- ---------------------------------------------------------------------
do $t$
declare
  v_a   constant uuid := '00000000-0000-4000-8000-0000000000a1';
  v_b   constant uuid := '00000000-0000-4000-8000-0000000000b2';
  v_ag_a uuid;
  v_ag_b uuid;
  n_b_ve_a int; n_b_total int; n_a_ve_b int; n_a_total int;
  v_ok boolean := false;
  v_det text;
begin
  begin
    select valor::uuid into v_ag_a from ctx where chave = 'ag_a';
    select valor::uuid into v_ag_b from ctx where chave = 'ag_b';

    perform set_config('request.jwt.claims', json_build_object('sub', v_b, 'role', 'authenticated')::text, true);
    set local role authenticated;
    select count(*) into n_b_ve_a from public.agendamentos where id = v_ag_a;
    select count(*) into n_b_total from public.agendamentos;
    reset role;

    perform set_config('request.jwt.claims', json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
    set local role authenticated;
    select count(*) into n_a_ve_b from public.agendamentos where id = v_ag_b;
    select count(*) into n_a_total from public.agendamentos;
    reset role;

    v_ok := n_b_ve_a = 0 and n_a_ve_b = 0 and n_b_total = 1 and n_a_total = 1;
    v_det := format('B vê o de A: %s | A vê o de B: %s | total de B: %s | total de A: %s',
                    n_b_ve_a, n_a_ve_b, n_b_total, n_a_total);
  exception when others then
    v_ok := false; v_det := 'erro inesperado: ' || sqlstate || ' ' || sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  insert into resultado_testes (teste, ok, detalhe)
  values ('T04 cliente A não vê agendamento do cliente B (RLS)', v_ok, v_det);
end
$t$;

-- ---------------------------------------------------------------------
-- T05 Cliente B não cancela nem altera direto o agendamento de A
-- ---------------------------------------------------------------------
do $t$
declare
  v_b   constant uuid := '00000000-0000-4000-8000-0000000000b2';
  v_ag_a uuid;
  v1 boolean := false; v2 boolean := false;
  v_ok boolean := false;
  v_det text;
begin
  begin
    select valor::uuid into v_ag_a from ctx where chave = 'ag_a';

    perform set_config('request.jwt.claims', json_build_object('sub', v_b, 'role', 'authenticated')::text, true);
    set local role authenticated;

    begin
      perform public.cancelar_agendamento(v_ag_a);
      v1 := false;
    exception when sqlstate 'AG007' then
      v1 := true;
    end;

    begin
      update public.agendamentos set titulo = 'hack' where id = v_ag_a;
      v2 := false;
    exception when insufficient_privilege then
      v2 := true;
    end;

    reset role;
    v_ok := v1 and v2;
    v_det := format('cancelar alheio recusado (AG007): %s | update direto recusado (42501): %s', v1, v2);
  exception when others then
    v_ok := false; v_det := 'erro inesperado: ' || sqlstate || ' ' || sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  insert into resultado_testes (teste, ok, detalhe)
  values ('T05 cliente não cancela/altera agendamento alheio', v_ok, v_det);
end
$t$;

-- ---------------------------------------------------------------------
-- T06 Cliente NÃO insere direto em agendamentos (só pelas RPCs)
-- ---------------------------------------------------------------------
do $t$
declare
  v_a   constant uuid := '00000000-0000-4000-8000-0000000000a1';
  v_pedi uuid;
  v_ok boolean := false;
  v_det text;
begin
  begin
    select id into v_pedi from public.servicos where nome = 'Pedicure';

    perform set_config('request.jwt.claims', json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
    set local role authenticated;
    begin
      insert into public.agendamentos (cliente_id, servico_id, inicio, fim)
      values (v_a, v_pedi, now() + interval '20 days', now() + interval '20 days 1 hour');
      v_ok := false; v_det := 'INSERT direto foi aceito';
    exception when insufficient_privilege then
      v_ok := true; v_det := 'INSERT direto recusado (42501)';
    end;
    reset role;
  exception when others then
    v_ok := false; v_det := 'erro inesperado: ' || sqlstate || ' ' || sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  insert into resultado_testes (teste, ok, detalhe)
  values ('T06 cliente não insere direto em agendamentos', v_ok, v_det);
end
$t$;

-- ---------------------------------------------------------------------
-- T07 Cliente NÃO altera o próprio papel (escalada de privilégio)
-- ---------------------------------------------------------------------
do $t$
declare
  v_a   constant uuid := '00000000-0000-4000-8000-0000000000a1';
  v_papel text;
  v1 boolean := false;
  v_ok boolean := false;
  v_det text;
begin
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
    set local role authenticated;
    begin
      update public.perfis set papel = 'admin' where id = v_a;
      v1 := false;
    exception when sqlstate 'AG013' then
      v1 := true;
    end;
    reset role;
    perform set_config('request.jwt.claims', '', true);

    select papel into v_papel from public.perfis where id = v_a;
    v_ok := v1 and v_papel = 'cliente';
    v_det := format('update recusado (AG013): %s | papel atual: %s', v1, v_papel);
  exception when others then
    v_ok := false; v_det := 'erro inesperado: ' || sqlstate || ' ' || sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  insert into resultado_testes (teste, ok, detalhe)
  values ('T07 cliente não altera o próprio papel', v_ok, v_det);
end
$t$;

-- ---------------------------------------------------------------------
-- T08 Admin consegue alterar papel (e o teste desfaz a mudança)
-- ---------------------------------------------------------------------
do $t$
declare
  v_b   constant uuid := '00000000-0000-4000-8000-0000000000b2';
  v_adm constant uuid := '00000000-0000-4000-8000-0000000000ad';
  v_n int;
  v_papel text;
  v_ok boolean := false;
  v_det text;
begin
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', v_adm, 'role', 'authenticated')::text, true);
    set local role authenticated;
    update public.perfis set papel = 'admin' where id = v_b;
    get diagnostics v_n = row_count;
    reset role;
    perform set_config('request.jwt.claims', '', true);

    select papel into v_papel from public.perfis where id = v_b;
    v_ok := v_n = 1 and v_papel = 'admin';
    v_det := format('linhas alteradas: %s | papel de B: %s', v_n, v_papel);
  exception when others then
    v_ok := false; v_det := 'erro inesperado: ' || sqlstate || ' ' || sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  update public.perfis set papel = 'cliente' where id = v_b;   -- desfaz
  insert into resultado_testes (teste, ok, detalhe)
  values ('T08 admin altera papel de outra pessoa', v_ok, v_det);
end
$t$;

-- ---------------------------------------------------------------------
-- T09 Só admin altera serviços
-- ---------------------------------------------------------------------
do $t$
declare
  v_a   constant uuid := '00000000-0000-4000-8000-0000000000a1';
  v_adm constant uuid := '00000000-0000-4000-8000-0000000000ad';
  v_manic uuid;
  v_preco numeric;
  v_n int;
  v1 boolean := false; v2 boolean := false; v3 boolean := false; v4 boolean := false;
  v_ok boolean := false;
  v_det text;
begin
  begin
    select id, preco into v_manic, v_preco from public.servicos where nome = 'Manicure';

    -- como cliente
    perform set_config('request.jwt.claims', json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
    set local role authenticated;
    update public.servicos set preco = 1 where id = v_manic;
    get diagnostics v_n = row_count;
    v1 := (v_n = 0);
    delete from public.servicos where id = v_manic;
    get diagnostics v_n = row_count;
    v2 := (v_n = 0);
    begin
      insert into public.servicos (nome, preco, duracao_min) values ('TESTE hack', 1, 10);
      v3 := false;
    exception when insufficient_privilege then
      v3 := true;
    end;
    reset role;

    -- como admin
    perform set_config('request.jwt.claims', json_build_object('sub', v_adm, 'role', 'authenticated')::text, true);
    set local role authenticated;
    update public.servicos set preco = v_preco + 1 where id = v_manic;
    get diagnostics v_n = row_count;
    v4 := (v_n = 1);
    reset role;
    perform set_config('request.jwt.claims', '', true);

    update public.servicos set preco = v_preco where id = v_manic;   -- restaura
    v_ok := v1 and v2 and v3 and v4;
    v_det := format('cliente: update 0 linhas=%s, delete 0 linhas=%s, insert recusado=%s | admin altera=%s', v1, v2, v3, v4);
  exception when others then
    v_ok := false; v_det := 'erro inesperado: ' || sqlstate || ' ' || sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  insert into resultado_testes (teste, ok, detalhe)
  values ('T09 só admin altera serviços', v_ok, v_det);
end
$t$;

-- ---------------------------------------------------------------------
-- T10 Conflito de horário pela RPC: B tenta o horário já ocupado por A
-- ---------------------------------------------------------------------
do $t$
declare
  v_b   constant uuid := '00000000-0000-4000-8000-0000000000b2';
  v_pedi uuid;
  v_terca date;
  v_ok boolean := false;
  v_det text;
begin
  begin
    select id into v_pedi from public.servicos where nome = 'Pedicure';
    select valor::date into v_terca from ctx where chave = 'terca';

    perform set_config('request.jwt.claims', json_build_object('sub', v_b, 'role', 'authenticated')::text, true);
    set local role authenticated;
    begin
      perform public.criar_agendamento(v_pedi, (v_terca + time '09:00') at time zone 'America/Sao_Paulo', null);
      v_ok := false; v_det := 'horário ocupado foi aceito';
    exception when sqlstate 'AG001' then
      v_ok := true; v_det := 'recusado com horario_conflito (AG001): ' || sqlerrm;
    end;
    reset role;
  exception when others then
    v_ok := false; v_det := 'erro inesperado: ' || sqlstate || ' ' || sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  insert into resultado_testes (teste, ok, detalhe)
  values ('T10 conflito de horário recusado pela RPC (erro identificável)', v_ok, v_det);
end
$t$;

-- ---------------------------------------------------------------------
-- T11 Proteção final: a constraint sem_conflito recusa sobreposição mesmo
-- sem passar pelas RPCs (é ela que vence quando dois cliques são simultâneos)
-- ---------------------------------------------------------------------
do $t$
declare
  v_b   constant uuid := '00000000-0000-4000-8000-0000000000b2';
  v_pedi uuid;
  v_terca date;
  v_ok boolean := false;
  v_det text;
begin
  begin
    select id into v_pedi from public.servicos where nome = 'Pedicure';
    select valor::date into v_terca from ctx where chave = 'terca';
    begin
      -- 09:30-10:30 sobrepõe o agendamento de A (09:00-10:00)
      insert into public.agendamentos (cliente_id, servico_id, titulo, inicio, fim)
      values (v_b, v_pedi, 'TESTE sobreposicao',
              (v_terca + time '09:30') at time zone 'America/Sao_Paulo',
              (v_terca + time '10:30') at time zone 'America/Sao_Paulo');
      v_ok := false; v_det := 'sobreposição foi gravada';
    exception when exclusion_violation then
      v_ok := true; v_det := 'sobreposição recusada pela constraint sem_conflito (23P01)';
    end;
  exception when others then
    v_ok := false; v_det := 'erro inesperado: ' || sqlstate || ' ' || sqlerrm;
  end;
  insert into resultado_testes (teste, ok, detalhe)
  values ('T11 constraint sem_conflito como proteção final', v_ok, v_det);
end
$t$;

-- ---------------------------------------------------------------------
-- T12 Serviço de 90 min em vão livre de 60 min não aparece nem é aceito
-- ---------------------------------------------------------------------
do $t$
declare
  v_a   constant uuid := '00000000-0000-4000-8000-0000000000a1';
  v_pedi uuid; v_mp uuid;
  v_terca date;
  n_90 int; n_60 int; n_tarde int;
  v4 boolean := false;
  v_ok boolean := false;
  v_det text;
begin
  begin
    select id into v_pedi from public.servicos where nome = 'Pedicure';
    select id into v_mp from public.servicos where nome = 'Manicure e Pedicure';
    select valor::date into v_terca from ctx where chave = 'terca';

    perform set_config('request.jwt.claims', json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
    set local role authenticated;

    select count(*) into n_90 from public.horarios_disponiveis(v_terca, v_mp) h
     where (h.inicio at time zone 'America/Sao_Paulo')::time in ('10:00', '10:30');
    select count(*) into n_60 from public.horarios_disponiveis(v_terca, v_pedi) h
     where (h.inicio at time zone 'America/Sao_Paulo')::time = '10:00';
    select count(*) into n_tarde from public.horarios_disponiveis(v_terca, v_mp) h
     where (h.inicio at time zone 'America/Sao_Paulo')::time = '13:00';

    begin
      perform public.criar_agendamento(v_mp, (v_terca + time '10:00') at time zone 'America/Sao_Paulo', null);
      v4 := false;
    exception when sqlstate 'AG001' then
      v4 := true;
    end;
    reset role;

    v_ok := n_90 = 0 and n_60 = 1 and n_tarde = 1 and v4;
    v_det := format('90min às 10:00/10:30 listados: %s (esperado 0) | 60min às 10:00 listado: %s (esperado 1) | 90min às 13:00 listado: %s (esperado 1) | criação forçada recusada: %s',
                    n_90, n_60, n_tarde, v4);
  exception when others then
    v_ok := false; v_det := 'erro inesperado: ' || sqlstate || ' ' || sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  insert into resultado_testes (teste, ok, detalhe)
  values ('T12 serviço de 90 min em vão de 60 min', v_ok, v_det);
end
$t$;

-- ---------------------------------------------------------------------
-- T13 Dia bloqueado: sem horários e criação recusada (AG003)
-- T14 (junto): cliente não cria bloqueio
-- ---------------------------------------------------------------------
do $t$
declare
  v_a   constant uuid := '00000000-0000-4000-8000-0000000000a1';
  v_adm constant uuid := '00000000-0000-4000-8000-0000000000ad';
  v_manic uuid;
  v_terca date;
  v_qua date;
  n_antes int; n_depois int;
  v1 boolean := false; v2 boolean := false; v3 boolean := false;
  v_ok boolean := false;
  v_det text;
begin
  begin
    select id into v_manic from public.servicos where nome = 'Manicure';
    select valor::date into v_terca from ctx where chave = 'terca';
    v_qua := v_terca + 1;

    -- cliente não cria bloqueio
    perform set_config('request.jwt.claims', json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
    set local role authenticated;
    begin
      insert into public.bloqueios (inicio, fim, motivo)
      values (now(), now() + interval '1 hour', 'TESTE cliente');
      v3 := false;
    exception when insufficient_privilege then
      v3 := true;
    end;
    select count(*) into n_antes from public.horarios_disponiveis(v_qua, v_manic);
    reset role;

    -- admin cria o bloqueio do dia inteiro (quarta-feira)
    perform set_config('request.jwt.claims', json_build_object('sub', v_adm, 'role', 'authenticated')::text, true);
    set local role authenticated;
    insert into public.bloqueios (inicio, fim, motivo)
    values ((v_qua + time '00:00') at time zone 'America/Sao_Paulo',
            (v_qua + 1 + time '00:00') at time zone 'America/Sao_Paulo',
            'TESTE bloqueio');
    reset role;

    -- cliente: sem horários e criação recusada
    perform set_config('request.jwt.claims', json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
    set local role authenticated;
    select count(*) into n_depois from public.horarios_disponiveis(v_qua, v_manic);
    v1 := (n_depois = 0);
    begin
      perform public.criar_agendamento(v_manic, (v_qua + time '10:00') at time zone 'America/Sao_Paulo', null);
      v2 := false;
    exception when sqlstate 'AG003' then
      v2 := true;
    end;
    reset role;
    perform set_config('request.jwt.claims', '', true);

    v_ok := n_antes > 0 and v1 and v2 and v3;
    v_det := format('horários antes do bloqueio: %s | depois: %s | criação recusada (AG003): %s | cliente criar bloqueio recusado: %s',
                    n_antes, n_depois, v2, v3);
  exception when others then
    v_ok := false; v_det := 'erro inesperado: ' || sqlstate || ' ' || sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  delete from public.bloqueios where motivo like 'TESTE%';
  insert into resultado_testes (teste, ok, detalhe)
  values ('T13 dia bloqueado sem horários; T14 só admin cria bloqueio', v_ok, v_det);
end
$t$;

-- ---------------------------------------------------------------------
-- T15 Fora do expediente (antes de abrir, almoço, passa do fechamento,
-- domingo e fora da grade de 30 min)
-- ---------------------------------------------------------------------
do $t$
declare
  v_a   constant uuid := '00000000-0000-4000-8000-0000000000a1';
  v_pedi uuid;
  v_terca date;
  v_casos timestamptz[];
  v_nomes text[] := array['08:00 (antes de abrir)', '12:30 (almoço)', '17:30 (60 min passa das 18h)',
                          'domingo 10:00', '14:10 (fora da grade)'];
  n_domingo int;
  i int;
  v_ok boolean := true;
  v_det text := '';
begin
  begin
    select id into v_pedi from public.servicos where nome = 'Pedicure';
    select valor::date into v_terca from ctx where chave = 'terca';

    v_casos := array[
      (v_terca + time '08:00') at time zone 'America/Sao_Paulo',
      (v_terca + time '12:30') at time zone 'America/Sao_Paulo',
      (v_terca + time '17:30') at time zone 'America/Sao_Paulo',
      (v_terca + 5 + time '10:00') at time zone 'America/Sao_Paulo',
      (v_terca + time '14:10') at time zone 'America/Sao_Paulo'
    ];

    perform set_config('request.jwt.claims', json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
    set local role authenticated;

    for i in 1 .. array_length(v_casos, 1) loop
      begin
        perform public.criar_agendamento(v_pedi, v_casos[i], null);
        v_ok := false;
        v_det := v_det || v_nomes[i] || ': ACEITO; ';
      exception
        when sqlstate 'AG002' then
          v_det := v_det || v_nomes[i] || ': recusado; ';
        when others then
          v_ok := false;
          v_det := v_det || v_nomes[i] || ': erro ' || sqlstate || '; ';
      end;
    end loop;

    select count(*) into n_domingo from public.horarios_disponiveis(v_terca + 5, v_pedi);
    reset role;
    v_ok := v_ok and n_domingo = 0;
    v_det := v_det || format('horários listados no domingo: %s', n_domingo);
  exception when others then
    v_ok := false; v_det := 'erro inesperado: ' || sqlstate || ' ' || sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  insert into resultado_testes (teste, ok, detalhe)
  values ('T15 fora do expediente recusado (AG002)', v_ok, v_det);
end
$t$;

-- ---------------------------------------------------------------------
-- T16 Passado (AG004) e antecedência mínima (AG011)
-- ---------------------------------------------------------------------
do $t$
declare
  v_a   constant uuid := '00000000-0000-4000-8000-0000000000a1';
  v_pedi uuid;
  v1 boolean := false; v2 boolean := false;
  v_ok boolean := false;
  v_det text;
begin
  begin
    select id into v_pedi from public.servicos where nome = 'Pedicure';

    perform set_config('request.jwt.claims', json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
    set local role authenticated;
    begin
      perform public.criar_agendamento(v_pedi, now() - interval '1 day', null);
      v1 := false;
    exception when sqlstate 'AG004' then
      v1 := true;
    end;
    begin
      perform public.criar_agendamento(v_pedi, now() + interval '30 minutes', null);
      v2 := false;
    exception when sqlstate 'AG011' then
      v2 := true;
    end;
    reset role;

    v_ok := v1 and v2;
    v_det := format('passado recusado (AG004): %s | antecedência recusada (AG011): %s', v1, v2);
  exception when others then
    v_ok := false; v_det := 'erro inesperado: ' || sqlstate || ' ' || sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  insert into resultado_testes (teste, ok, detalhe)
  values ('T16 horário no passado e antecedência mínima', v_ok, v_det);
end
$t$;

-- ---------------------------------------------------------------------
-- T17 Prazo de cancelamento: dentro do prazo recusa; admin pode
-- ---------------------------------------------------------------------
do $t$
declare
  v_a   constant uuid := '00000000-0000-4000-8000-0000000000a1';
  v_adm constant uuid := '00000000-0000-4000-8000-0000000000ad';
  v_pedi uuid;
  v_terca date;
  v_ag uuid;
  v_status text;
  v1 boolean := false; v2 boolean := false; v3 boolean := false;
  v_ok boolean := false;
  v_det text;
begin
  begin
    select id into v_pedi from public.servicos where nome = 'Pedicure';
    select valor::date into v_terca from ctx where chave = 'terca';

    -- agendamento daqui a 6 horas (dentro das 24h de prazo), inserido direto
    insert into public.agendamentos (cliente_id, servico_id, titulo, inicio, fim)
    values (v_a, v_pedi, 'TESTE prazo',
            date_trunc('minute', now()) + interval '6 hours',
            date_trunc('minute', now()) + interval '7 hours')
    returning id into v_ag;

    perform set_config('request.jwt.claims', json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
    set local role authenticated;
    begin
      perform public.cancelar_agendamento(v_ag);
      v1 := false;
    exception when sqlstate 'AG006' then
      v1 := true;
    end;
    begin
      perform public.remarcar_agendamento(v_ag, null, (v_terca + time '15:00') at time zone 'America/Sao_Paulo', null);
      v2 := false;
    exception when sqlstate 'AG006' then
      v2 := true;
    end;
    reset role;

    perform set_config('request.jwt.claims', json_build_object('sub', v_adm, 'role', 'authenticated')::text, true);
    set local role authenticated;
    select status into v_status from public.cancelar_agendamento(v_ag);
    v3 := (v_status = 'cancelado');
    reset role;

    v_ok := v1 and v2 and v3;
    v_det := format('cancelar dentro do prazo recusado: %s | remarcar recusado: %s | admin cancela: %s', v1, v2, v3);
  exception when others then
    v_ok := false; v_det := 'erro inesperado: ' || sqlstate || ' ' || sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  insert into resultado_testes (teste, ok, detalhe)
  values ('T17 prazo de cancelamento (cliente recusado, admin permitido)', v_ok, v_det);
end
$t$;

-- ---------------------------------------------------------------------
-- T18 Cancelar dentro do prazo funciona e libera o horário
-- ---------------------------------------------------------------------
do $t$
declare
  v_a   constant uuid := '00000000-0000-4000-8000-0000000000a1';
  v_pedi uuid;
  v_terca date;
  v_quinta date;
  v_row public.agendamentos%rowtype;
  n_ocupado int; n_livre int;
  v_ok boolean := false;
  v_det text;
begin
  begin
    select id into v_pedi from public.servicos where nome = 'Pedicure';
    select valor::date into v_terca from ctx where chave = 'terca';
    v_quinta := v_terca + 2;

    perform set_config('request.jwt.claims', json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
    set local role authenticated;
    select * into v_row from public.criar_agendamento(v_pedi, (v_quinta + time '15:00') at time zone 'America/Sao_Paulo', 'TESTE cancelar');
    select count(*) into n_ocupado from public.horarios_disponiveis(v_quinta, v_pedi) h
     where (h.inicio at time zone 'America/Sao_Paulo')::time = '15:00';
    select * into v_row from public.cancelar_agendamento(v_row.id);
    select count(*) into n_livre from public.horarios_disponiveis(v_quinta, v_pedi) h
     where (h.inicio at time zone 'America/Sao_Paulo')::time = '15:00';
    reset role;

    v_ok := v_row.status = 'cancelado' and v_row.cancelado_por = v_a and n_ocupado = 0 and n_livre = 1;
    v_det := format('status=%s | 15:00 listado antes: %s (esperado 0) | depois: %s (esperado 1)', v_row.status, n_ocupado, n_livre);
  exception when others then
    v_ok := false; v_det := 'erro inesperado: ' || sqlstate || ' ' || sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  insert into resultado_testes (teste, ok, detalhe)
  values ('T18 cancelamento dentro do prazo libera o horário', v_ok, v_det);
end
$t$;

-- ---------------------------------------------------------------------
-- T19 Remarcar: o próprio horário aparece livre na edição; conflito recusado
-- ---------------------------------------------------------------------
do $t$
declare
  v_a   constant uuid := '00000000-0000-4000-8000-0000000000a1';
  v_pedi uuid;
  v_terca date;
  v_ag_a uuid;
  n_sem int; n_com int;
  v_row public.agendamentos%rowtype;
  v1 boolean := false;
  v_ok boolean := false;
  v_det text;
begin
  begin
    select id into v_pedi from public.servicos where nome = 'Pedicure';
    select valor::date into v_terca from ctx where chave = 'terca';
    select valor::uuid into v_ag_a from ctx where chave = 'ag_a';

    perform set_config('request.jwt.claims', json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
    set local role authenticated;

    select count(*) into n_sem from public.horarios_disponiveis(v_terca, v_pedi) h
     where (h.inicio at time zone 'America/Sao_Paulo')::time = '09:00';
    select count(*) into n_com from public.horarios_disponiveis(v_terca, v_pedi, v_ag_a) h
     where (h.inicio at time zone 'America/Sao_Paulo')::time = '09:00';

    begin
      -- 11:00 já é de B
      perform public.remarcar_agendamento(v_ag_a, null, (v_terca + time '11:00') at time zone 'America/Sao_Paulo', null);
      v1 := false;
    exception when sqlstate 'AG001' then
      v1 := true;
    end;

    select * into v_row from public.remarcar_agendamento(
      v_ag_a, null, (v_terca + time '10:00') at time zone 'America/Sao_Paulo', 'TESTE remarcado');
    reset role;

    v_ok := n_sem = 0 and n_com = 1 and v1
            and v_row.inicio = (v_terca + time '10:00') at time zone 'America/Sao_Paulo'
            and (v_row.fim - v_row.inicio) = interval '60 minutes'
            and v_row.titulo = 'TESTE remarcado';
    v_det := format('09:00 sem ignorar: %s (esperado 0) | com ignorar: %s (esperado 1) | remarcar para horário de B recusado: %s | novo início ok: %s',
                    n_sem, n_com, v1, v_row.inicio is not null);
  exception when others then
    v_ok := false; v_det := 'erro inesperado: ' || sqlstate || ' ' || sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  insert into resultado_testes (teste, ok, detalhe)
  values ('T19 remarcar agendamento (conflito recusado, próprio horário livre)', v_ok, v_det);
end
$t$;

-- ---------------------------------------------------------------------
-- T20 Serviço inativo: criação recusada e invisível para visitante
-- ---------------------------------------------------------------------
do $t$
declare
  v_a   constant uuid := '00000000-0000-4000-8000-0000000000a1';
  v_manic uuid;
  v_terca date;
  n_anon int;
  v1 boolean := false;
  v_ok boolean := false;
  v_det text;
begin
  begin
    select id into v_manic from public.servicos where nome = 'Manicure';
    select valor::date into v_terca from ctx where chave = 'terca';

    update public.servicos set ativo = false where id = v_manic;

    perform set_config('request.jwt.claims', json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
    set local role authenticated;
    begin
      perform public.criar_agendamento(v_manic, (v_terca + time '15:00') at time zone 'America/Sao_Paulo', null);
      v1 := false;
    exception when sqlstate 'AG005' then
      v1 := true;
    end;
    reset role;

    perform set_config('request.jwt.claims', '', true);
    set local role anon;
    select count(*) into n_anon from public.servicos where id = v_manic;
    reset role;

    v_ok := v1 and n_anon = 0;
    v_det := format('criação recusada (AG005): %s | visitante enxerga o serviço inativo: %s (esperado 0)', v1, n_anon);
  exception when others then
    v_ok := false; v_det := 'erro inesperado: ' || sqlstate || ' ' || sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  update public.servicos set ativo = true where nome = 'Manicure';   -- restaura
  insert into resultado_testes (teste, ok, detalhe)
  values ('T20 serviço inativo não pode ser agendado nem é público', v_ok, v_det);
end
$t$;

-- ---------------------------------------------------------------------
-- T21 Favoritos: cada uma vê e mexe só nos seus
-- ---------------------------------------------------------------------
do $t$
declare
  v_a   constant uuid := '00000000-0000-4000-8000-0000000000a1';
  v_b   constant uuid := '00000000-0000-4000-8000-0000000000b2';
  v_pedi uuid;
  n_a int; n_b_ve int; n_del int;
  v1 boolean := false;
  v_ok boolean := false;
  v_det text;
begin
  begin
    select id into v_pedi from public.servicos where nome = 'Pedicure';

    perform set_config('request.jwt.claims', json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
    set local role authenticated;
    insert into public.servicos_favoritos (perfil_id, servico_id) values (v_a, v_pedi);
    select count(*) into n_a from public.servicos_favoritos;
    reset role;

    perform set_config('request.jwt.claims', json_build_object('sub', v_b, 'role', 'authenticated')::text, true);
    set local role authenticated;
    select count(*) into n_b_ve from public.servicos_favoritos where perfil_id = v_a;
    begin
      insert into public.servicos_favoritos (perfil_id, servico_id) values (v_a, v_pedi);
      v1 := false;
    exception when insufficient_privilege then
      v1 := true;
    end;
    reset role;

    perform set_config('request.jwt.claims', json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
    set local role authenticated;
    delete from public.servicos_favoritos where perfil_id = v_a and servico_id = v_pedi;
    get diagnostics n_del = row_count;
    reset role;

    v_ok := n_a = 1 and n_b_ve = 0 and v1 and n_del = 1;
    v_det := format('A vê %s favorito(s) | B vê os de A: %s | B inserir para A recusado: %s | A remove o seu: %s', n_a, n_b_ve, v1, n_del);
  exception when others then
    v_ok := false; v_det := 'erro inesperado: ' || sqlstate || ' ' || sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  insert into resultado_testes (teste, ok, detalhe)
  values ('T21 favoritos isolados por usuária', v_ok, v_det);
end
$t$;

-- ---------------------------------------------------------------------
-- T22 Admin enxerga nome/telefone dos clientes; cliente só o próprio perfil;
-- agendamento manual para cliente sem conta; cliente não usa RPC de admin
-- ---------------------------------------------------------------------
do $t$
declare
  v_a   constant uuid := '00000000-0000-4000-8000-0000000000a1';
  v_adm constant uuid := '00000000-0000-4000-8000-0000000000ad';
  v_manic uuid;
  v_terca date;
  n_tel int; n_agend int; n_perfis_a int;
  v_row public.agendamentos%rowtype;
  v1 boolean := false;
  v_ok boolean := false;
  v_det text;
begin
  begin
    select id into v_manic from public.servicos where nome = 'Manicure';
    select valor::date into v_terca from ctx where chave = 'terca';

    perform set_config('request.jwt.claims', json_build_object('sub', v_adm, 'role', 'authenticated')::text, true);
    set local role authenticated;
    select count(*) into n_tel from public.perfis where telefone is not null;
    select count(*) into n_agend from public.agendamentos;
    select * into v_row from public.admin_criar_agendamento(
      v_manic, (v_terca + time '16:00') at time zone 'America/Sao_Paulo',
      'TESTE avulso', null, 'TESTE Maria Avulsa', '11 90000-9999');
    reset role;

    perform set_config('request.jwt.claims', json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
    set local role authenticated;
    select count(*) into n_perfis_a from public.perfis;
    begin
      perform public.admin_criar_agendamento(
        v_manic, (v_terca + time '17:00') at time zone 'America/Sao_Paulo', 'TESTE x', null, 'TESTE Fulana', null);
      v1 := false;
    exception when sqlstate 'AG012' then
      v1 := true;
    end;
    reset role;

    v_ok := n_tel >= 3 and n_agend >= 2 and n_perfis_a = 1 and v1
            and v_row.cliente_id is null and v_row.cliente_nome_avulso = 'TESTE Maria Avulsa';
    v_det := format('admin vê %s perfis com telefone e %s agendamentos | A vê %s perfil | cliente avulso gravado: %s | cliente usar RPC de admin recusado (AG012): %s',
                    n_tel, n_agend, n_perfis_a, v_row.cliente_nome_avulso, v1);
  exception when others then
    v_ok := false; v_det := 'erro inesperado: ' || sqlstate || ' ' || sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  insert into resultado_testes (teste, ok, detalhe)
  values ('T22 admin vê nome/telefone; agendamento manual; cliente sem acesso a RPC de admin', v_ok, v_det);
end
$t$;

-- ---------------------------------------------------------------------
-- T23 Visitante (anon): vê vitrine, não vê agendamentos nem usa RPCs
-- ---------------------------------------------------------------------
do $t$
declare
  v_pedi uuid;
  n_serv int;
  v1 boolean := false; v2 boolean := false; v3 boolean := false; v4 boolean := false;
  v_ok boolean := false;
  v_det text;
begin
  begin
    select id into v_pedi from public.servicos where nome = 'Pedicure';

    perform set_config('request.jwt.claims', '', true);
    set local role anon;
    select count(*) into n_serv from public.servicos;
    begin
      perform count(*) from public.agendamentos;
      v1 := false;
    exception when insufficient_privilege then
      v1 := true;
    end;
    begin
      perform public.criar_agendamento(v_pedi, now() + interval '10 days', null);
      v2 := false;
    exception when insufficient_privilege then
      v2 := true;
    end;
    begin
      perform count(*) from public.horarios_disponiveis(current_date + 10, v_pedi);
      v3 := false;
    exception when insufficient_privilege then
      v3 := true;
    end;
    begin
      perform count(*) from public.perfis;
      v4 := false;
    exception when insufficient_privilege then
      v4 := true;
    end;
    reset role;

    v_ok := n_serv >= 1 and v1 and v2 and v3 and v4;
    v_det := format('serviços visíveis: %s | agendamentos negado: %s | criar_agendamento negado: %s | horarios_disponiveis negado: %s | perfis negado: %s',
                    n_serv, v1, v2, v3, v4);
  exception when others then
    v_ok := false; v_det := 'erro inesperado: ' || sqlstate || ' ' || sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  insert into resultado_testes (teste, ok, detalhe)
  values ('T23 visitante (anon) só vê a vitrine', v_ok, v_det);
end
$t$;

-- ---------------------------------------------------------------------
-- T24 Fuso America/Sao_Paulo: sábado abre 09:00 e o último de 60 min é 17:00
-- ---------------------------------------------------------------------
do $t$
declare
  v_a   constant uuid := '00000000-0000-4000-8000-0000000000a1';
  v_pedi uuid;
  v_terca date;
  v_min time; v_max time; n int;
  v_ok boolean := false;
  v_det text;
begin
  begin
    select id into v_pedi from public.servicos where nome = 'Pedicure';
    select valor::date into v_terca from ctx where chave = 'terca';

    perform set_config('request.jwt.claims', json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
    set local role authenticated;
    select min((h.inicio at time zone 'America/Sao_Paulo')::time),
           max((h.inicio at time zone 'America/Sao_Paulo')::time),
           count(*)
      into v_min, v_max, n
      from public.horarios_disponiveis(v_terca + 4, v_pedi) h;
    reset role;

    -- 09:00..11:00 (5 horários) + 13:00..17:00 (9 horários) = 14, de 30 em 30 min
    v_ok := v_min = time '09:00' and v_max = time '17:00' and n = 14;
    v_det := format('primeiro=%s último=%s total=%s (esperado 09:00, 17:00, 14)', v_min, v_max, n);
  exception when others then
    v_ok := false; v_det := 'erro inesperado: ' || sqlstate || ' ' || sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  insert into resultado_testes (teste, ok, detalhe)
  values ('T24 horários calculados no fuso America/Sao_Paulo', v_ok, v_det);
end
$t$;

-- ---------------------------------------------------------------------
-- T25 RLS ativa em todas as tabelas do schema public
-- ---------------------------------------------------------------------
do $t$
declare
  v_sem text;
  v_ok boolean := false;
begin
  select string_agg(c.relname, ', ')
    into v_sem
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity;
  v_ok := v_sem is null;
  insert into resultado_testes (teste, ok, detalhe)
  values ('T25 RLS ativa em todas as tabelas', v_ok,
          coalesce('tabelas SEM RLS: ' || v_sem, 'todas as tabelas de public têm RLS'));
end
$t$;

-- ---------------------------------------------------------------------
-- T26 Funções security definer têm search_path fixo
-- ---------------------------------------------------------------------
do $t$
declare
  v_sem text;
  v_ok boolean := false;
begin
  select string_agg(p.proname, ', ')
    into v_sem
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.prosecdef
     and not exists (
       select 1 from unnest(coalesce(p.proconfig, '{}'::text[])) c
        where c like 'search_path=%');
  v_ok := v_sem is null;
  insert into resultado_testes (teste, ok, detalhe)
  values ('T26 funções security definer com search_path fixo', v_ok,
          coalesce('sem search_path: ' || v_sem, 'todas com search_path fixo'));
end
$t$;

-- ---------------------------------------------------------------------
-- T27 Privilégios de execução: public/anon sem acesso, authenticated só onde deve
-- ---------------------------------------------------------------------
do $t$
declare
  v1 boolean; v2 boolean; v3 boolean; v4 boolean; v5 boolean; v6 boolean;
  v_ok boolean;
begin
  v1 := not has_function_privilege('anon', 'public.criar_agendamento(uuid, timestamptz, text)', 'execute');
  v2 := has_function_privilege('authenticated', 'public.criar_agendamento(uuid, timestamptz, text)', 'execute');
  v3 := not has_function_privilege('anon', 'public.horarios_disponiveis(date, uuid, uuid)', 'execute');
  v4 := not has_function_privilege('authenticated', 'public.handle_new_user()', 'execute');
  v5 := not has_function_privilege('authenticated', 'public.usuario_disponivel(text)', 'execute')
        and has_function_privilege('service_role', 'public.usuario_disponivel(text)', 'execute');
  v6 := not has_function_privilege('authenticated', 'public._ag_validar_janela(timestamptz, int, uuid, boolean)', 'execute');
  v_ok := v1 and v2 and v3 and v4 and v5 and v6;
  insert into resultado_testes (teste, ok, detalhe)
  values ('T27 privilégios de execução das funções', v_ok,
          format('anon sem criar: %s | authenticated com criar: %s | anon sem horarios: %s | trigger fechada: %s | usuario_disponivel só service_role: %s | helper interna fechada: %s',
                 v1, v2, v3, v4, v5, v6));
end
$t$;

-- ---------------------------------------------------------------------
-- Limpeza: remove os dados de teste (cascata: perfis, agendamentos, favoritos)
-- ---------------------------------------------------------------------
select set_config('request.jwt.claims', '', true);
delete from public.agendamentos
 where titulo like 'TESTE%' or cliente_nome_avulso like 'TESTE%';
delete from public.bloqueios where motivo like 'TESTE%';
delete from public.servicos where nome like 'TESTE%';
delete from auth.users where id in (
  '00000000-0000-4000-8000-0000000000a1',
  '00000000-0000-4000-8000-0000000000b2',
  '00000000-0000-4000-8000-0000000000ad',
  '00000000-0000-4000-8000-0000000000c3'
);

-- ---------------------------------------------------------------------
-- Resultado
-- ---------------------------------------------------------------------
select n, case when ok then 'OK' else 'FALHOU' end as resultado, teste, detalhe
  from resultado_testes
union all
select 999,
       case when bool_and(ok) then 'TUDO OK' else 'HÁ FALHAS' end,
       'RESUMO',
       format('%s de %s testes passaram', count(*) filter (where ok), count(*))
  from resultado_testes
order by n;
