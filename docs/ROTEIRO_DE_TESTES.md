# Roteiro de testes manuais

Percorra este roteiro **antes do piloto** e de novo **no site publicado**. Marque cada item. Se algum
resultado for diferente do esperado, anote o passo e a mensagem na tela e envie para correção.

Os testes automáticos do banco (`supabase/tests/testes.sql`) já cobrem a segurança e as regras de
agendamento; este roteiro confere o **app de ponta a ponta**, no celular e no computador.

## Preparação

- **3 pessoas de teste:** cliente **A**, cliente **B** e a **dona (admin)**. Crie A e B pelo
  cadastro do app e torne a dona admin (README, seção 5.1).
- **2 navegadores ou perfis diferentes** (ex.: Chrome e uma janela anônima) para A e B ao mesmo tempo.
- Um **celular Android** e um **iPhone**, se possível.
- Banco com o `seed.sql` aplicado (serviços de exemplo, seg-sáb 9h-12h e 13h-18h).
- Anote uma **terça-feira próxima** (a "terça de teste") para os testes de horário.

Legenda: ☐ = ainda não testado.

---

## A. Acesso e conta

| # | Passos | Resultado esperado | ✓ |
|---|---|---|---|
| A1 | Abrir o site sem estar logada | Tela de boas-vindas em gradiente roxo com "Agenda [nome]" e botão **Acessar** | ☐ |
| A2 | **Acessar** | Tela de login com **Usuário:** e **Senha:**; no rodapé "faça o **cadastro**" (não "login") | ☐ |
| A3 | Cadastro deixando campos em branco | O navegador não deixa enviar e indica o campo que falta | ☐ |
| A3b | Cadastro com usuário `ma ria` (com espaço) e telefone `123`, o resto correto | A tela mostra, abaixo dos campos, "Use de 3 a 20 caracteres: letras, números, ponto ou _ (sem espaços)." e "Informe o telefone com DDD."; nada é criado | ☐ |
| A4 | Cadastro correto (nome, usuário `maria`, e-mail, telefone com DDD, senha de 8+ caracteres) | Cai direto em **Horários Marcados** (lista vazia). O telefone fica formatado `(DD) NNNNN-NNNN` | ☐ |
| A5 | Sair e tentar cadastrar de novo o usuário **`MARIA`** (maiúsculas) com outro e-mail | "Esse usuário já está em uso." | ☐ |
| A6 | Login com o **usuário** e a senha certa | Entra em Horários Marcados | ☐ |
| A7 | Login com o **e-mail** e a senha certa | Entra em Horários Marcados | ☐ |
| A8 | Login com senha errada; depois com usuário que não existe | **A mesma mensagem nos dois casos:** "Usuário ou senha inválidos." | ☐ |
| A9 | Login com usuário ou senha em branco | O navegador não deixa enviar e indica o campo que falta | ☐ |
| A10 | Logada, recarregar a página e abrir o endereço raiz `/` | Vai direto para Horários Marcados (sem passar pela boas-vindas) | ☐ |
| A11 | Menu do perfil (⋮) > **Sair** | Volta para o login | ☐ |
| A12 | Sem login, abrir `/agenda`, `/agenda/novo` e `/admin` direto no endereço | Sempre redireciona para o login | ☐ |

## B. Horários marcados (tela 3)

| # | Passos | Resultado esperado | ✓ |
|---|---|---|---|
| B1 | Cliente nova, lista vazia | Aviso "Você ainda não tem horários marcados." com instrução; campo "Adicionar novo horário…" visível | ☐ |
| B2 | Digitar `Horário 1` no campo e tocar em **+** | Abre a tela 4 (modo criação) com o Título **já preenchido** | ☐ |
| B3 | Criar 3 agendamentos em dias/horas diferentes (fora de ordem de criação) | Lista em **ordem crescente de data**; cada card mostra título, serviço e "Hora 14:30 dia 20 de outubro" | ☐ |
| B4 | Cancelar um dos agendamentos | Ele **some da lista** (só futuros e ativos aparecem) | ☐ |
| B5 | **Estado de erro.** No SQL Editor rode `revoke select on public.agendamentos from authenticated;` e recarregue a tela 3 | "Não foi possível carregar agora." com **Tentar de novo** e **Sair**. **Desfaça em seguida:** `grant select on public.agendamentos to authenticated;` e toque em Tentar de novo: a lista volta | ☐ |
| B6 | Recarregar com internet lenta (DevTools > Network > Slow 3G) | Aparecem blocos "pulsando" (carregando) antes da lista | ☐ |
| B7 | Tocar no botão quadrado de editar de um card | Abre a tela 4 em **modo edição** com dia, horário, serviço e título atuais | ☐ |

## C. Criar e editar horário (tela 4)

| # | Passos | Resultado esperado | ✓ |
|---|---|---|---|
| C1 | Abrir `/agenda/novo` | Barra "Novo horário:"; cabeçalho "Ano / Mês"; calendário DOM-SAB; dias de outros meses esmaecidos | ☐ |
| C2 | Setas de mês | Avança até 12 meses; **não volta antes do mês atual** | ☐ |
| C3 | Chevron do cabeçalho | **Recolhe** e **expande** o calendário | ☐ |
| C4 | Dias passados e domingos | Desabilitados (não dá para tocar) | ☐ |
| C5 | Dia em que A já tem agendamento | **Ponto vermelho** sob o número | ☐ |
| C6 | Dia bloqueado (ex.: 20/11/2026 do seed) ou dia totalmente ocupado | **Ponto cinza**; ao selecionar, o seletor diz que não há horários livres | ☐ |
| C7 | Selecionar um dia e tocar na caixa **Horário:** | Janela com **só os horários livres** (de 30 em 30 min) para o serviço escolhido | ☐ |
| C8 | Trocar o **Tipo de Trabalho** (Manicure, Pedicure, Manicure e Pedicure) | Aparecem duração e preço; a lista de horários e os pontos do calendário **se recalculam** (serviço mais longo = menos horários) | ☐ |
| C9 | **Salvar** sem escolher dia/horário | Botão desabilitado e dica "Escolha o dia no calendário…" | ☐ |
| C10 | Salvar com **Título vazio** | Cria; na lista o título é o **nome do serviço** | ☐ |
| C11 | Editar um agendamento: abrir a lista de horários do **mesmo dia** | O **horário atual aparece como livre** (dá para manter ou trocar) | ☐ |
| C12 | Trocar o horário e salvar | Volta para a lista com o novo horário | ☐ |
| C13 | Em edição, **Cancelar agendamento** > **Voltar** | Nada acontece | ☐ |
| C14 | Em edição, **Cancelar agendamento** > **Sim, cancelar** (agendamento além do prazo) | Volta para a lista; o horário sumiu e voltou a ficar livre para outras pessoas | ☐ |
| C15 | Pelo perfil, tocar num chip de favorito | Abre a tela 4 em criação com o **serviço já selecionado** | ☐ |

## D. Regras de agendamento (Fase 9.1 da proposta)

| # | Cenário | Como testar | Resultado esperado | ✓ |
|---|---|---|---|---|
| D1 | Mesmo horário, um depois do outro | A agenda a terça de teste às 09:00. Em seguida B escolhe esse horário em tela que já estava aberta (abra a tela 4 de B **antes** de A salvar) | B vê "**Esse horário acabou de ser reservado, escolha outro.**", a escolha é limpa e a lista de horários é recarregada sem o 09:00 | ☐ |
| D2 | **Dois cliques simultâneos** | Veja o procedimento detalhado na seção D2 abaixo | Só um grava; o outro recebe o aviso; **nunca** dois agendamentos no mesmo intervalo | ☐ |
| D3 | Serviço de 90 min em vão de 60 min | A agenda Pedicure (60 min) terça 09:00; B agenda Pedicure terça 11:00 (vão livre de 10:00 às 11:00). Uma terceira pessoa (ou A) abre **Manicure e Pedicure** (90 min) na mesma terça | Os horários **10:00 e 10:30 não aparecem**; o de 13:00 aparece | ☐ |
| D4 | Dia bloqueado | Painel > Bloqueios > bloquear um dia inteiro. A (cliente) abre esse dia na tela 4 | Ponto cinza; **nenhum horário** livre | ☐ |
| D5 | Fora do expediente / domingo | Na tela 4, procurar horário de 12:00 a 12:30 (almoço), antes das 9h, depois das 17:30 e em domingo | Nenhum desses horários é oferecido; domingo vem desabilitado | ☐ |
| D6 | Bloqueio depois de escolher (tela "velha") | A abre a tela 4, escolhe dia e horário e **não salva**. A dona bloqueia aquele dia. A clica em **Salvar** | Mensagem "Esse dia ou horário está bloqueado. Escolha outro." e nada é criado | ☐ |
| D7 | Prazo de cancelamento | Painel > Horários > **Prazo para cancelar** = `720` (30 dias). A tenta cancelar e remarcar um agendamento | "O prazo para cancelar ou remarcar esse horário já passou. Fale com a loja." Depois volte o prazo para o valor real (ex.: 24) e repita: cancela normalmente | ☐ |
| D8 | Antecedência mínima | Painel > Horários > **Antecedência mínima** = `10080` (7 dias). A abre a tela 4 | Os dias da próxima semana ficam sem horários (cinza). Depois volte para o valor real (ex.: 120) | ☐ |
| D9 | A não acessa o agendamento de B | Pegue o id de um agendamento de B no SQL Editor (`select id, titulo from public.agendamentos;`). Logada como A, abra `/agenda/ID_DE_B` | Tela "Horário não encontrado." | ☐ |
| D10 | Fuso | No aparelho (ou DevTools > More tools > Sensors > Timezone), mude o fuso para outro (ex.: UTC ou Lisboa) e abra a lista e a tela 4 | Os horários continuam os de **São Paulo** (09:00 continua 09:00) | ☐ |
| D11 | Intervalo configurável | Painel > Horários > **Intervalo** = `60`. Abra a tela 4 | Horários de hora em hora. Depois volte para `30` | ☐ |

### D2. Dois cliques simultâneos (procedimento)

**Teste 1: pelo app (duas pessoas ao mesmo tempo)**

1. Em dois navegadores, entre como A e como B.
2. Nos dois: `/agenda/novo`, **mesmo serviço, mesmo dia e mesmo horário livre** (escolha o horário,
   **sem clicar em Salvar**).
3. Combinem uma contagem ("3, 2, 1, já!") e cliquem em **Salvar** nos dois ao mesmo tempo.
4. **Esperado:** um grava e volta para a lista; o outro vê "Esse horário acabou de ser reservado,
   escolha outro." e o horário some da seleção.
5. Repita algumas vezes em horários diferentes (é difícil acertar o instante exato).
6. Confira no SQL Editor que nunca há sobreposição:

   ```sql
   select a.id, p.usuario, a.inicio, a.fim, a.status
     from public.agendamentos a join public.perfis p on p.id = a.cliente_id
    where a.status <> 'cancelado'
    order by a.inicio;
   ```

**Teste 2: direto no banco (determinístico)**

Precisa de duas conexões ao mesmo tempo: use o `psql` em **dois terminais** com a connection string
do projeto (Supabase > **Connect**). Troque a data por uma data **futura**.

Terminal 1:

```sql
begin;
insert into public.agendamentos (cliente_id, servico_id, titulo, inicio, fim)
select p.id, s.id, 'TESTE corrida',
       timestamptz '2026-12-01 09:00-03', timestamptz '2026-12-01 10:00-03'
  from public.perfis p, public.servicos s
 where s.nome = 'Pedicure' limit 1;
-- NÃO dê commit ainda
```

Terminal 2 (um horário que **sobrepõe**: 09:30 às 10:30):

```sql
insert into public.agendamentos (cliente_id, servico_id, titulo, inicio, fim)
select p.id, s.id, 'TESTE corrida 2',
       timestamptz '2026-12-01 09:30-03', timestamptz '2026-12-01 10:30-03'
  from public.perfis p, public.servicos s
 where s.nome = 'Pedicure' limit 1;
-- este comando fica ESPERANDO o terminal 1
```

Volte ao terminal 1 e rode `commit;`. **Esperado:** o comando do terminal 2 falha com
`conflicting key value violates exclusion constraint "sem_conflito"`. Limpe:

```sql
delete from public.agendamentos where titulo like 'TESTE corrida%';
```

## E. Perfil (tela 5)

| # | Passos | Resultado esperado | ✓ |
|---|---|---|---|
| E1 | Tocar no botão circular de usuário (canto inferior direito) | Sheet "Perfil do Usuário" sobe com fundo escurecido; mostra avatar, nome, telefone, e-mail e favoritos | ☐ |
| E2 | Fechar pelo chevron, tocando no fundo escuro e com a tecla Esc | Fecha nos três casos | ☐ |
| E3 | O botão de perfil também aparece na tela 4 | Abre o mesmo sheet | ☐ |
| E4 | ⋮ > **Editar perfil**: trocar nome e telefone > Salvar | Dados atualizados no sheet; telefone inválido mostra "Informe o telefone com DDD." | ☐ |
| E5 | **Trocar foto** com uma foto grande (vários MB) do celular | Envia e aparece no avatar (a foto é reduzida antes de subir) | ☐ |
| E6 | **Trocar foto** com um PDF ou arquivo que não é imagem | "Use uma imagem JPG, PNG ou WebP." | ☐ |
| E7 | **Remover foto** | Volta ao avatar padrão (silhueta) | ☐ |
| E8 | Tocar num chip vazio **[…]** | Lista de serviços; escolher um o adiciona aos favoritos | ☐ |
| E9 | ⋮ > **Editar favoritos** > tocar num chip | Aparece "×" nos chips e o toque **remove** o favorito; **Concluir edição** sai do modo | ☐ |
| E10 | Favoritos: nova cliente | Grade de 3 colunas com no mínimo 6 posições (chips vazios "[…]") | ☐ |
| E11 | Desativar um serviço no painel que A tinha como favorito | Some dos favoritos de A; A continua vendo o nome nos agendamentos antigos | ☐ |

## F. Painel da dona (`/admin`)

| # | Passos | Resultado esperado | ✓ |
|---|---|---|---|
| F1 | Como **A (cliente)**, abrir `/admin` no endereço | Volta para Horários Marcados (não vê o painel) | ☐ |
| F2 | Como **dona**: o atalho "Painel da loja" aparece no topo de Horários Marcados e no menu ⋮ do perfil | Abre o painel; A e B **não** veem o atalho | ☐ |
| F3 | Agenda, visão **Dia**: navegar para outros dias e **Hoje** | Cada card mostra horário, título/serviço, **nome e telefone** da cliente e **status** | ☐ |
| F4 | Visão **Semana** | Domingo a sábado, com os agendamentos de cada dia e "Sem horários." nos dias vazios | ☐ |
| F5 | Telefone e **WhatsApp** de um card | O telefone abre a discagem e o WhatsApp abre a conversa com o número da cliente | ☐ |
| F6 | **Confirmar / Concluir / Cancelar / Reativar / Reabrir** | O status muda e o card se atualiza; um cancelado fica esmaecido | ☐ |
| F7 | **Reativar** um cancelado cujo horário já foi ocupado por outra pessoa | "Esse horário acabou de ser reservado, escolha outro." | ☐ |
| F8 | **Remarcar** um agendamento (abre a tela 4) e salvar | Volta para o **painel** (não para a lista da cliente) | ☐ |
| F9 | **Novo agendamento** > cliente **com conta** | Cria; aparece na agenda do dia; a cliente vê na tela dela | ☐ |
| F10 | **Novo agendamento** > **sem conta (WhatsApp)** com nome e telefone | Cria; aparece com o nome e o telefone informados | ☐ |
| F11 | Novo agendamento digitando um horário fora da grade (ex.: 10:15) | Aceita (a dona pode encaixar); mas recusa horário fora do expediente, bloqueado ou ocupado | ☐ |
| F12 | **Serviços** > Novo serviço (nome, preço `40,50`, duração 45) | Cria e abre a edição para adicionar foto | ☐ |
| F13 | Serviço: adicionar, trocar e remover a **foto** | A miniatura aparece na lista de serviços | ☐ |
| F14 | **Desativar** um serviço | Some do menu de "Tipo de Trabalho" da cliente; agendamentos antigos mantêm o nome; **Ativar** devolve | ☐ |
| F15 | **Horários**: adicionar faixa 13:00-18:00 num dia sem faixa | Aparece; a tela da cliente passa a oferecer horários nesse dia | ☐ |
| F16 | Adicionar uma faixa que **sobrepõe** outra do mesmo dia | "Essa faixa se sobrepõe a outra já cadastrada nesse dia." | ☐ |
| F17 | Remover todas as faixas de um dia | O dia mostra "Fechado" e fica desabilitado no calendário da cliente | ☐ |
| F18 | **Bloqueios**: criar bloqueio de dia inteiro e outro com horário (ex.: 14:00-16:00) | Aparecem na lista; os horários desse período somem para a cliente | ☐ |
| F19 | Criar um bloqueio num dia que **já tem agendamento** | Mensagem "Atenção: já existem N agendamento(s) nesse período…" (os agendamentos continuam marcados) | ☐ |
| F20 | **Remover bloqueio** | Os horários voltam a ficar livres | ☐ |

## G. E-mails (só se a seção 8 do README foi feita)

| # | Passos | Resultado esperado | ✓ |
|---|---|---|---|
| G1 | Cliente **com conta** agenda um horário | Em instantes chega o e-mail "Horário confirmado: …" com serviço, dia, horário e o prazo de cancelamento | ☐ |
| G2 | A remarca esse horário | Chega **nova confirmação** com o novo horário | ☐ |
| G3 | A dona agenda para cliente **sem conta** | **Nenhum e-mail** e nenhum erro na tela | ☐ |
| G4 | Mudar só o título de um agendamento (no SQL) | **Nenhum** e-mail novo | ☐ |
| G5 | **Lembrete** (procedimento abaixo) | Chega "Lembrete do seu horário: …"; uma segunda execução **não reenvia** | ☐ |
| G6 | Chamar a função sem o segredo (comando abaixo) | Resposta **401** | ☐ |
| G7 | Agendar com menos de 24h de antecedência | Chega **só a confirmação** (não chega lembrete depois) | ☐ |
| G8 | Com a confirmação de cadastro ligada (README 8.5): cadastrar e clicar no link do e-mail | Cai em Horários Marcados já logada | ☐ |
| G9 | Abrir o mesmo link de confirmação uma segunda vez, **em outra janela anônima** (o link só vale uma vez; no navegador onde a cliente já está logada, o sistema a leva direto para a agenda) | Login com o aviso "Não foi possível confirmar o seu e-mail…" | ☐ |

**G5: forçar um lembrete.** Pegue o `id` de um agendamento de uma cliente **com conta e e-mail
real** e rode os **dois** comandos **juntos, numa só execução** do SQL Editor:

```sql
update public.agendamentos
   set inicio = now() + interval '20 hours', fim = now() + interval '21 hours'
 where id = 'ID_DO_AGENDAMENTO';
update public.agendamentos
   set confirmacao_enviada = true, lembrete_enviado = false
 where id = 'ID_DO_AGENDAMENTO';
```

Depois dispare a função (o mesmo que o cron faz de hora em hora):

```sql
select net.http_post(
  url     := (select decrypted_secret from vault.decrypted_secrets where name = 'notificacoes_url'),
  headers := jsonb_build_object('Content-Type', 'application/json',
             'x-notificacoes-segredo',
             (select decrypted_secret from vault.decrypted_secrets where name = 'notificacoes_segredo')),
  body    := jsonb_build_object('tarefa', 'tudo'));
```

Em até um minuto chega o e-mail. Confira `select confirmacao_enviada, lembrete_enviado from
public.agendamentos where id = 'ID_DO_AGENDAMENTO';` (ambos `true`), rode o `net.http_post` outra
vez e confirme que **não chega um segundo e-mail**. Se não chegar, veja
`select * from net._http_response order by created desc limit 5;` e os logs da função.

**G6: sem segredo:**

```bash
curl -i -X POST https://SEU-PROJETO.supabase.co/functions/v1/notificacoes \
  -H "Content-Type: application/json" -d '{"tarefa":"tudo"}'
```

Esperado: `401`.

## H. PWA, celular e acessibilidade

| # | Passos | Resultado esperado | ✓ |
|---|---|---|---|
| H1 | **Android (Chrome):** menu > **Instalar app** / Adicionar à tela inicial | Ícone do esmalte na tela inicial; abre em tela cheia, sem barra do navegador | ☐ |
| H2 | **iPhone (Safari):** Compartilhar > **Adicionar à Tela de Início** | Ícone na tela inicial; abre em tela cheia | ☐ |
| H3 | Percorrer **todas** as telas no celular | Textos legíveis e **sem rolagem horizontal** | ☐ |
| H4 | Digitar nos campos (login, cadastro, título, perfil) | O teclado **não esconde** o campo digitado | ☐ |
| H5 | Topo e rodapé no iPhone com entalhe | Conteúdo não fica sob a barra de status nem sob a barra inferior | ☐ |
| H6 | Abrir no **computador** | App numa coluna centralizada de até 430px, com o botão de perfil no canto dessa coluna | ☐ |
| H7 | Navegar só com o teclado (**Tab**, Enter, Esc) | Foco visível em todos os botões e campos; Esc fecha janelas | ☐ |
| H8 | Zoom do navegador em 200% | Telas continuam usáveis | ☐ |
| H9 | Botões e itens tocáveis | Fáceis de tocar com o dedo (área mínima de 44px) | ☐ |

## I. Segurança rápida

| # | Passos | Resultado esperado | ✓ |
|---|---|---|---|
| I1 | No site publicado, DevTools > Sources > buscar (Ctrl+Shift+F) por `sb_secret` e por `service_role` | **Nenhum resultado** nos arquivos carregados no navegador | ☐ |
| I2 | `git status` / repositório no GitHub | `.env.local` e `supabase/functions/notificacoes/.env` **não** aparecem | ☐ |
| I3 | Rodar `supabase/tests/testes.sql` no banco final | Resumo **TUDO OK** | ☐ |
| I4 | Como cliente, tentar abrir `/admin` e qualquer `/admin/...` | Sempre volta para Horários Marcados | ☐ |
| I5 | Supabase > **Database > Advisors** (verificações de segurança) | Sem alerta de tabela sem RLS | ☐ |

---

### Resultado final

- [ ] Todas as seções A a F e H passaram (G e as partes opcionais só se configuradas).
- [ ] O banco passou no `testes.sql` (e no `testes_lembretes.sql`, se usar e-mails).
- [ ] Piloto de 1 a 2 semanas combinado com clientes de confiança.
- [ ] A dona foi treinada em: bloquear datas, remarcar e cancelar, cadastrar serviços e ajustar horários.
