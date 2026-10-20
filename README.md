# Agenda: sistema de agendamento online

Sistema de agendamento para pequenos negócios de serviços com hora marcada (ex.: manicure).
A cliente cria conta, entra com **usuário e senha**, vê os horários marcados, agenda, remarca ou
cancela escolhendo dia, horário e tipo de trabalho, e tem um perfil com agendamentos favoritos.
A dona do negócio administra tudo em um painel (`/admin`).

- **Front-end:** Next.js 16 (App Router) + TypeScript + Tailwind CSS 4, PWA instalável, mobile-first
  (coluna de até 430px no desktop).
- **Back-end:** Supabase (PostgreSQL, Auth, RLS, funções SQL/RPC, Storage; Edge Function só para
  e-mails).
- **Hospedagem:** Vercel.

> **Leia antes.** Este código foi escrito sem poder ser executado no ambiente de criação (sem
> internet para instalar pacotes nem banco para testar). Foi revisado por leitura, e a sintaxe de
> todos os arquivos foi validada, mas **o primeiro `npm run build` e o `testes.sql` são o teste de
> verdade**. Siga o passo a passo, rode os testes da seção 6 e, se algo falhar, a seção 9 lista os
> problemas mais prováveis.

---

## Sumário

1. [Requisitos](#1-requisitos)
2. [Estrutura do projeto](#2-estrutura-do-projeto)
3. [Criar o projeto no Supabase e rodar o SQL](#3-criar-o-projeto-no-supabase-e-rodar-o-sql)
4. [Variáveis de ambiente e rodar localmente](#4-variáveis-de-ambiente-e-rodar-localmente)
5. [Tornar a dona administradora e cadastrar os dados reais](#5-tornar-a-dona-administradora-e-cadastrar-os-dados-reais)
6. [Testes](#6-testes)
7. [Deploy na Vercel](#7-deploy-na-vercel)
8. [E-mails de confirmação e lembrete (opcional)](#8-e-mails-de-confirmação-e-lembrete-opcional)
9. [Solução de problemas](#9-solução-de-problemas)
10. [Segurança, LGPD e produção](#10-segurança-lgpd-e-produção)
11. [Limitações conhecidas e próximos passos](#11-limitações-conhecidas-e-próximos-passos)

O roteiro de testes manuais completo está em
[`docs/ROTEIRO_DE_TESTES.md`](docs/ROTEIRO_DE_TESTES.md).

---

## 1. Requisitos

| Item | Para quê | Observação |
|---|---|---|
| Node.js **20.9 ou mais novo** | rodar o app | `node -v` |
| Conta no [Supabase](https://supabase.com) | banco, login, arquivos | o plano Free serve para desenvolvimento e piloto |
| Conta no GitHub e na [Vercel](https://vercel.com) | publicar o site | confira os termos do plano gratuito da Vercel para uso comercial |
| Conta no [Resend](https://resend.com) | e-mails (só se fizer a seção 8) | opcional |
| [Supabase CLI](https://supabase.com/docs/guides/cli) | publicar a Edge Function (só seção 8) | opcional |

## 2. Estrutura do projeto

```
agenda/
├─ .env.example                 # modelo das variáveis (copie para .env.local)
├─ package.json · tsconfig.json · next.config.ts · postcss.config.mjs
├─ public/icons/                # ícones do PWA
├─ docs/ROTEIRO_DE_TESTES.md    # roteiro de testes manuais
├─ supabase/
│  ├─ schema.sql                # banco completo (migrations 0001 a 0005 juntas)
│  ├─ seed.sql                  # serviços de exemplo, horários seg-sáb, bloqueio de exemplo
│  ├─ migrations/0001..0005     # as mesmas partes, separadas
│  ├─ migrations/0006_lembretes.sql      # OPCIONAL: e-mails (seção 8)
│  ├─ tests/testes.sql          # testes do banco
│  ├─ tests/testes_lembretes.sql         # testes da parte de e-mails
│  ├─ functions/notificacoes/   # Edge Function de e-mails (opcional)
│  └─ email-templates/confirmar-cadastro.html
└─ src/
   ├─ proxy.ts                  # renova a sessão e protege /agenda e /admin
   ├─ app/                      # telas: / · /login · /cadastro · /agenda · /agenda/novo
   │                            #        /agenda/[id] · /admin/* · /auth/confirm
   ├─ components/               # ui · auth · agenda · admin
   └─ lib/                      # supabase (clientes), acoes (Server Actions),
                                # dados (consultas), datas (fuso), validacao (zod), erros
```

## 3. Criar o projeto no Supabase e rodar o SQL

### 3.1 Criar o projeto

1. Entre em [supabase.com](https://supabase.com), clique em **New project**.
2. Escolha a região mais próxima das clientes (**South America (São Paulo)**) e **guarde a senha do
   banco**.
3. Aguarde o projeto ficar pronto.

### 3.2 Anotar URL e chaves

Em **Project Settings** (ou o botão **Connect**), anote:

- **Project URL** (`https://xxxx.supabase.co`);
- **Publishable key** (`sb_publishable_...`), a chave pública. Em projetos antigos aparece como
  **anon key**; o app aceita as duas;
- **Secret key** (`sb_secret_...`), a chave secreta. Em projetos antigos é a **service_role key**.
  **Ela nunca vai para o front-end nem para o GitHub.**

### 3.3 Rodar o SQL

1. No menu, abra **SQL Editor** > **New query**.
2. Cole **todo** o conteúdo de `supabase/schema.sql` e clique em **Run**. Isso cria tabelas,
   gatilhos, funções, regras de segurança (RLS) e os buckets de arquivos.
3. Abra uma nova consulta, cole `supabase/seed.sql` e rode. Isso cria 3 serviços de exemplo
   (Manicure, Pedicure, Manicure e Pedicure), o horário seg-sáb das 9h às 12h e das 13h às 18h, e
   um bloqueio de exemplo em 20/11/2026.
4. **Confira:** em **Table Editor** devem aparecer `perfis`, `servicos`, `horarios_funcionamento`,
   `bloqueios`, `configuracoes`, `agendamentos` e `servicos_favoritos`; em **Storage**, os buckets
   `servicos-fotos` e `avatares`.

> O `schema.sql` **não é idempotente**: rode-o uma única vez em projeto novo. Para recomeçar do
> zero, crie outro projeto ou apague o schema `public` (cuidado: apaga tudo).
>
> Prefere a linha de comando? Com a Supabase CLI instalada, rode `supabase init`, ligue o projeto
> (`supabase link`) e use `supabase db push` com os arquivos de `supabase/migrations/`.

### 3.4 Rodar os testes do banco (recomendado)

Cole `supabase/tests/testes.sql` no SQL Editor e rode. No final aparece uma tabela com **OK** ou
**FALHOU** para cada teste e uma linha de resumo. Ele cria usuários de teste, simula cada um e
**apaga tudo ao terminar**. Se algum teste falhar, **não prossiga**: me mande a linha com o
`detalhe`.

### 3.5 Configurar o login (Authentication)

> Os nomes dos menus do painel do Supabase mudam de tempos em tempos (por exemplo,
> "Providers" pode aparecer como "Sign In / Providers"). Procure pela função descrita.

1. **Authentication > Providers > Email:** deixe **Enable Email provider** ligado e
   **desligue "Confirm email"** (para a cliente entrar logo depois do cadastro). Se quiser a
   confirmação por e-mail, veja a seção 8.5.
2. **Authentication > URL Configuration:** em **Site URL**, coloque `http://localhost:3000` por
   enquanto (depois troque pelo endereço do site, seção 7).

## 4. Variáveis de ambiente e rodar localmente

```bash
cd agenda
npm install
cp .env.example .env.local      # no Windows (PowerShell): copy .env.example .env.local
```

Edite o `.env.local`:

| Variável | Valor | Pode ir para o navegador? |
|---|---|---|
| `NEXT_PUBLIC_NOME_EMPRESA` | nome que aparece em "Agenda [nome]" | sim |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL | sim |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | chave pública (ou use `NEXT_PUBLIC_SUPABASE_ANON_KEY`) | sim |
| `SUPABASE_SECRET_KEY` | chave secreta (ou `SUPABASE_SERVICE_ROLE_KEY`) | **NÃO. Só servidor** |

Depois, rode:

```bash
npm run typecheck     # confere os tipos (se acusar erro, me envie a mensagem)
npm run dev           # abre em http://localhost:3000
```

O `.gitignore` já impede que `.env.local` vá para o GitHub. Confira com `git status` antes do
primeiro `git add .`.

**O que você deve ver:** a tela de boas-vindas em gradiente roxo com "Agenda [nome]" e o botão
**Acessar**. Crie uma conta em **faça o cadastro** e entre: você deve cair em **Horários
Marcados** (vazia).

## 5. Tornar a dona administradora e cadastrar os dados reais

### 5.1 Tornar a dona admin

1. A dona se cadastra normalmente pelo app (**Acessar > faça o cadastro**).
2. No **SQL Editor**, rode (troque pelo usuário que ela escolheu):

   ```sql
   update public.perfis set papel = 'admin' where usuario = 'usuario_da_dona';
   ```

   Só o SQL Editor (ou a chave secreta) consegue mudar o papel. Nenhuma cliente altera o próprio
   papel, nem pelo app nem pela API (o banco bloqueia).
3. A dona sai e entra de novo. Aparece **Painel da loja** no topo de Horários Marcados e no menu ⋮
   do perfil.

### 5.2 Cadastrar os dados reais (pelo painel)

No **Painel da loja**:

- **Serviços:** edite os de exemplo (nome, descrição, preço, duração) ou crie os reais; desative os
  que não existem. Adicione fotos.
- **Horários:** ajuste os dias e as faixas de atendimento (duas faixas no mesmo dia = intervalo de
  almoço). Em **Regras de agendamento**, defina a antecedência mínima, o prazo de cancelamento e o
  intervalo entre os horários.
- **Bloqueios:** apague o de exemplo (20/11/2026) se não valer para a loja e cadastre feriados e
  folgas reais.

### 5.3 Personalizar

- **Nome da empresa:** `NEXT_PUBLIC_NOME_EMPRESA` (na Vercel, também; exige novo deploy).
- **Ilustração do esmalte:** é um SVG provisório em `src/components/ui/IlustracaoEsmalte.tsx`.
  Para usar o arquivo final, troque o conteúdo desse componente (mesma assinatura).
- **Ícones do PWA:** arquivos em `public/icons/` (192, 512, maskable e apple-touch).
- **Cores:** estão em `src/app/globals.css`, no bloco `@theme`.

## 6. Testes

| Onde | O que cobre | Quando |
|---|---|---|
| `supabase/tests/testes.sql` | segurança (RLS), regras de agendamento, conflito, bloqueio, expediente, fuso | depois do passo 3.3 e a cada mudança no banco |
| `supabase/tests/testes_lembretes.sql` | marcas e gatilhos dos e-mails | depois da seção 8 |
| `docs/ROTEIRO_DE_TESTES.md` | o app de ponta a ponta, no celular e no desktop, incluindo **dois cliques simultâneos** | antes do piloto e antes de publicar |

## 7. Deploy na Vercel

1. **Antes de publicar**, rode localmente:

   ```bash
   npm run typecheck
   npm run build
   ```

   O build baixa as fontes (Poppins e Quicksand) do Google, então precisa de internet.
2. Suba o código para o GitHub (repositório **privado** é o mais indicado). Confirme que o
   `.env.local` **não** está no repositório.
3. Na Vercel: **Add New > Project**, escolha o repositório. O framework (Next.js) é detectado
   sozinho. Se o projeto estiver numa subpasta do repositório, defina **Root Directory** como
   `agenda`.
4. Em **Environment Variables**, cadastre as mesmas do `.env.local`:
   `NEXT_PUBLIC_NOME_EMPRESA`, `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` e `SUPABASE_SECRET_KEY` (marque esta como
   **Sensitive**). As `NEXT_PUBLIC_*` são embutidas no build: ao alterá-las, faça um novo deploy.
5. Clique em **Deploy**. Anote o endereço (`https://seu-projeto.vercel.app`).
6. No Supabase, em **Authentication > URL Configuration**, troque **Site URL** pelo endereço do
   site e adicione-o em **Redirect URLs** (e o domínio próprio, quando houver).
7. **Domínio próprio:** registre um `.com.br` e aponte-o na Vercel (**Settings > Domains**). O HTTPS
   é emitido automaticamente. Depois atualize o **Site URL** no Supabase de novo.
8. Faça um **piloto** de 1 a 2 semanas com clientes de confiança antes de divulgar o link, e
   percorra o roteiro de testes no site publicado.

## 8. E-mails de confirmação e lembrete (opcional)

Sem esta seção o sistema funciona normalmente, só não envia e-mails. Com ela, a cliente recebe:

- **confirmação** quando o horário é marcado ou muda de horário;
- **lembrete** cerca de 24 horas antes (verificado de hora em hora).

### 8.1 Resend

1. Crie a conta no [Resend](https://resend.com), em **Domains** verifique o domínio de e-mail da
   loja (ou, só para testar, use `onboarding@resend.dev`, que entrega apenas para o e-mail dono da
   conta Resend).
2. Em **API Keys**, crie uma chave.

### 8.2 Banco: migration, cron e segredos

1. No SQL Editor, rode `supabase/migrations/0006_lembretes.sql`. Ela cria as colunas
   `confirmacao_enviada` e `lembrete_enviado`, os gatilhos e o cron `notificacoes-agenda`
   (de hora em hora).
2. Guarde os dois segredos no **Vault** (troque os valores; o segundo é uma senha longa e
   aleatória que só você conhece):

   ```sql
   select vault.create_secret('https://SEU-PROJETO.supabase.co/functions/v1/notificacoes', 'notificacoes_url');
   select vault.create_secret('SEGREDO-LONGO-E-ALEATORIO', 'notificacoes_segredo');
   ```

### 8.3 Edge Function

Na pasta `agenda`, com a Supabase CLI:

```bash
supabase login
supabase link --project-ref SEU-PROJETO          # o "ref" é a parte antes de .supabase.co
cp supabase/functions/notificacoes/.env.example supabase/functions/notificacoes/.env
# edite o .env: NOTIFICACOES_SEGREDO (o MESMO do Vault), RESEND_API_KEY,
# EMAIL_REMETENTE, NOME_EMPRESA e SITE_URL
supabase secrets set --env-file supabase/functions/notificacoes/.env
supabase functions deploy notificacoes --no-verify-jwt
```

`--no-verify-jwt` é intencional: a função confere o próprio segredo
(`x-notificacoes-segredo`). Não suba o `.env` da função para o GitHub.

### 8.4 Testar

Siga a seção "E-mails" do [roteiro de testes](docs/ROTEIRO_DE_TESTES.md) e rode
`supabase/tests/testes_lembretes.sql`.

### 8.5 Confirmação de e-mail no cadastro (opcional)

1. **Authentication > Emails > SMTP Settings:** configure um SMTP próprio (o Resend oferece). O
   envio embutido do Supabase é limitado e serve só para testes.
2. **Authentication > Email Templates > Confirm signup:** cole o conteúdo de
   `supabase/email-templates/confirmar-cadastro.html`. O link dele aponta para `/auth/confirm` do
   seu site (rota já incluída).
3. **Authentication > Providers > Email:** ligue **Confirm email**.

## 9. Solução de problemas

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| "Variáveis do Supabase ausentes" | `.env.local` faltando ou servidor não reiniciado | confira os nomes das variáveis e reinicie o `npm run dev` |
| "Chave secreta do Supabase ausente" ao entrar ou cadastrar | falta `SUPABASE_SECRET_KEY` | preencha no `.env.local` (e na Vercel) |
| Login responde sempre "Usuário ou senha inválidos" | senha errada, ou "Confirm email" ligado e e-mail não confirmado | teste com a senha certa; veja a seção 3.5 |
| Cadastro: "Esse usuário já está em uso" para um usuário novo | usuário já existe (o banco guarda em minúsculas) | escolha outro |
| Cadastro dá erro genérico | trigger `handle_new_user` ausente (SQL não rodou inteiro) | rode `schema.sql` num projeto novo e confira a seção 3.3 |
| "permission denied for function ..." | `schema.sql` rodou pela metade (faltam os `grant`) | rode o `testes.sql` (T27) e reaplique em projeto novo |
| Calendário sem pontos ou horários nunca aparecem | RPC falhando ou sem faixas de funcionamento | veja o console do navegador; confira **Horários** no painel |
| Foto não aparece | bucket ausente, ou host do Supabase diferente do `NEXT_PUBLIC_SUPABASE_URL` | confira a seção 3.3 (Storage) e a URL |
| Mudei uma tabela e o app não enxerga | cache do esquema da API | espere alguns segundos ou rode `notify pgrst, 'reload schema';` |
| `next build` falha ao baixar fontes | sem internet no ambiente de build | rode onde haja internet (a Vercel tem) |
| Erro de tipos no `npm run typecheck` | o código nunca foi compilado no ambiente de criação | me envie a mensagem completa |
| App some depois de 1 semana sem uso | plano Free do Supabase pausa por inatividade | retome o projeto no painel; em produção use o plano Pro |
| E-mail não chega | segredos ausentes no Vault, função sem deploy, remetente sem domínio verificado | veja a seção "E-mails" do roteiro de testes |

**Registros úteis:** Supabase > Edge Functions > `notificacoes` > **Logs**; SQL:
`select * from net._http_response order by created desc limit 5;` (respostas das chamadas do banco
à função) e `select * from cron.job_run_details order by start_time desc limit 5;` (execuções do
cron).

## 10. Segurança, LGPD e produção

**Já implementado**

- A chave secreta só existe no servidor (módulo `server-only`) e nunca vai para o navegador nem
  para o repositório (`.env*` está no `.gitignore`).
- RLS ativa em **todas** as tabelas. Cada cliente só enxerga os próprios dados; a dona enxerga nome
  e telefone das clientes; serviços e horários têm leitura pública e escrita só admin.
- A cliente **não escreve direto** na tabela de agendamentos: tudo passa por funções que validam
  serviço ativo, expediente, bloqueio, conflito, futuro, antecedência e prazo. A constraint
  `sem_conflito` é a proteção final contra dois cliques simultâneos.
- Escalada de privilégio bloqueada: ninguém altera o próprio papel.
- Login por usuário sem enumerar contas: o erro é sempre o mesmo e o tempo de resposta é
  equalizado.
- Cabeçalhos de segurança básicos (`next.config.ts`).

**Antes de abrir para o público**

- [ ] **Política de Privacidade e Termos de Uso** em linguagem simples (finalidade, compartilhamento,
      prazo de guarda). Não incluí aviso de consentimento no cadastro por depender desse texto; é
      um parágrafo a acrescentar no formulário quando ele existir. Peça revisão a um profissional.
- [ ] **Direitos do titular (exclusão, acesso e correção):** não há botão no app. Enquanto isso,
      informe um e-mail de contato. Para excluir uma conta, a dona (ou você) usa o SQL Editor:
      `delete from auth.users where id = '...';` (apaga também o perfil, os agendamentos e os
      favoritos da pessoa).
- [ ] **Plano Pro do Supabase:** sem pausa por inatividade e com **backups diários**. Teste a
      restauração.
- [ ] **E-mail próprio** configurado (SMTP) se ligar a confirmação de cadastro.
- [ ] Rodar o roteiro de testes completo no site publicado, no Android e no iPhone.

## 11. Limitações conhecidas e próximos passos

**Limitações**

- O código e o SQL nunca foram executados no ambiente de criação (veja o aviso no topo).
- As janelas sobrepostas (perfil, seleção de horário, cancelamento) fecham com Esc e travam a
  rolagem, mas não têm "armadilha de foco" completa para leitores de tela.
- Quando a dona remarca pela tela 4, os pontos vermelhos do calendário mostram os dias com
  agendamento **dela**, não os da cliente.
- Criar um bloqueio **não** cancela agendamentos já marcados no período: o painel apenas avisa.
- E-mail permanentemente recusado pelo provedor é tentado de novo a cada hora até o dia do horário.
- Não há tela de lista de clientes com histórico, e-mail de cancelamento, Realtime na agenda do
  painel, nem limite de tentativas de login além do que o Supabase já aplica.
- Um único profissional. A evolução para vários está comentada junto da constraint `sem_conflito`
  em `0001_tabelas.sql`.

**Evoluções previstas na proposta (Seção 12):** vários profissionais, lista de espera, pacotes e
combos, avaliações e fidelidade, relatórios, integração com Google Agenda, pagamento de sinal por
Pix e versão multiloja.
