-- =====================================================================
-- seed.sql
-- Dados de exemplo. Pode rodar mais de uma vez (não duplica).
-- Rode DEPOIS do schema.sql. Ajuste nomes, preços e durações à realidade
-- da loja (valores abaixo são fictícios).
--
-- Para tornar a dona do negócio administradora (depois que ela se cadastrar):
--   update public.perfis set papel = 'admin' where usuario = 'usuario_dela';
-- =====================================================================

-- Configurações (a linha já existe pela migration 0001; aqui só para ajuste rápido)
insert into public.configuracoes (id, antecedencia_min_minutos, prazo_cancelamento_horas, intervalo_min)
values (1, 120, 24, 30)
on conflict (id) do nothing;

-- Serviços de exemplo ------------------------------------------------------
insert into public.servicos (nome, descricao, preco, duracao_min)
select v.nome, v.descricao, v.preco, v.duracao_min
  from (values
    ('Manicure',            'Cuidado completo das unhas das mãos.', 40.00, 45),
    ('Pedicure',            'Cuidado completo das unhas dos pés.',  50.00, 60),
    ('Manicure e Pedicure', 'Mãos e pés no mesmo atendimento.',     85.00, 90)
  ) as v(nome, descricao, preco, duracao_min)
 where not exists (select 1 from public.servicos s where s.nome = v.nome);

-- Horário de funcionamento: segunda a sábado, 09:00-12:00 e 13:00-18:00 ------
-- (duas faixas por dia = intervalo de almoço das 12h às 13h; domingo fechado)
insert into public.horarios_funcionamento (dia_semana, abre, fecha)
select d, f.abre, f.fecha
  from generate_series(1, 6) as d
 cross join (values (time '09:00', time '12:00'),
                    (time '13:00', time '18:00')) as f(abre, fecha)
 where not exists (select 1 from public.horarios_funcionamento);

-- Bloqueio de exemplo: feriado do dia inteiro (fuso America/Sao_Paulo) --------
insert into public.bloqueios (inicio, fim, motivo)
select (timestamp '2026-11-20 00:00') at time zone 'America/Sao_Paulo',
       (timestamp '2026-11-21 00:00') at time zone 'America/Sao_Paulo',
       'Dia da Consciência Negra (exemplo)'
 where not exists (
   select 1 from public.bloqueios where motivo = 'Dia da Consciência Negra (exemplo)'
 );
