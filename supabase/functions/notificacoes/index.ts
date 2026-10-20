/**
 * Edge Function "notificacoes": e-mail de confirmação e lembrete 24h antes.
 *
 * Quem chama:
 *  - o trigger do banco (tarefa "confirmacoes"), logo depois que um
 *    agendamento é criado ou muda de horário;
 *  - o cron de hora em hora (tarefa "tudo"): envia os lembretes e também as
 *    confirmações que ainda estejam pendentes (rede de segurança).
 *
 * Segurança: a função é publicada SEM verificação de JWT e confere um segredo
 * próprio no cabeçalho "x-notificacoes-segredo" (o mesmo guardado no Vault).
 *
 * Idempotência: cada aviso é "reivindicado" com um UPDATE condicional
 * (confirmacao_enviada / lembrete_enviado = false -> true) antes do envio.
 * Duas execuções ao mesmo tempo nunca enviam o mesmo e-mail duas vezes. Se o
 * envio falhar, a marca é desfeita e o cron tenta de novo na próxima hora.
 *
 * Deploy:
 *   supabase functions deploy notificacoes --no-verify-jwt
 *   supabase secrets set --env-file supabase/functions/notificacoes/.env
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const FUSO = "America/Sao_Paulo";
const LOTE = 40; // máximo de e-mails por tipo em cada execução
const PAUSA_MS = 600; // o Resend aceita ~2 envios por segundo

type Tipo = "confirmacao" | "lembrete";

type LinhaAgendamento = {
  id: string;
  titulo: string | null;
  inicio: string;
  fim: string;
  cliente_id: string | null;
  servicos: { nome: string } | null;
  cliente: { nome: string } | null;
};

type Resumo = { enviados: number; falhas: number; ignorados: number };

const urlSupabase = Deno.env.get("SUPABASE_URL") ?? "";
const chaveServico =
  Deno.env.get("SUPABASE_SECRET_KEY") ??
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  "";
const segredoEsperado = Deno.env.get("NOTIFICACOES_SEGREDO") ?? "";
const chaveResend = Deno.env.get("RESEND_API_KEY") ?? "";
const remetente = Deno.env.get("EMAIL_REMETENTE") ?? "";
const nomeEmpresa = Deno.env.get("NOME_EMPRESA") ?? "Agenda";
const urlSite = (Deno.env.get("SITE_URL") ?? "").replace(/\/+$/, "");

const admin = createClient(urlSupabase, chaveServico, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function json(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Comparação em tempo constante (não vaza o segredo pelo tempo de resposta). */
function iguais(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  let diferenca = ea.length ^ eb.length;
  const maior = Math.max(ea.length, eb.length);
  for (let i = 0; i < maior; i++) diferenca |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return diferenca === 0;
}

function escapar(texto: string): string {
  return texto
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const pausa = (ms: number) => new Promise((resolver) => setTimeout(resolver, ms));

function formatarQuando(inicio: string, fim: string) {
  const data = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: FUSO,
  }).format(new Date(inicio));
  const hora = (iso: string) =>
    new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      timeZone: FUSO,
    }).format(new Date(iso));
  return { data, de: hora(inicio), ate: hora(fim) };
}

function montarEmail(
  tipo: Tipo,
  linha: LinhaAgendamento,
  prazoHoras: number,
): { assunto: string; html: string; texto: string } {
  const servico = linha.servicos?.nome ?? "Serviço";
  const titulo = linha.titulo?.trim() || servico;
  const primeiroNome = (linha.cliente?.nome ?? "").trim().split(/\s+/)[0] || "";
  const { data, de, ate } = formatarQuando(linha.inicio, linha.fim);

  const saudacao = primeiroNome ? `Olá, ${primeiroNome}!` : "Olá!";
  const abertura =
    tipo === "confirmacao"
      ? "Seu horário está confirmado."
      : "Passando para lembrar do seu horário.";
  const assunto =
    tipo === "confirmacao"
      ? `Horário confirmado: ${data}, às ${de}`
      : `Lembrete do seu horário: ${data}, às ${de}`;

  const regra =
    prazoHoras > 0
      ? `Se precisar cancelar ou remarcar, faça isso pelo app até ${prazoHoras} hora${prazoHoras === 1 ? "" : "s"} antes; depois desse prazo, fale com a loja.`
      : "Se precisar cancelar ou remarcar, acesse o app.";
  const link = urlSite ? `${urlSite}/agenda` : "";

  const texto = [
    saudacao,
    "",
    abertura,
    "",
    `Serviço: ${servico}`,
    ...(titulo !== servico ? [`Título: ${titulo}`] : []),
    `Dia: ${data}`,
    `Horário: ${de} às ${ate}`,
    "",
    regra,
    ...(link ? [`Seus horários: ${link}`] : []),
    "",
    nomeEmpresa,
  ].join("\n");

  const html = `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;padding:24px 12px;background:#f6f6f6;font-family:Poppins,Arial,sans-serif;color:#4e4add;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;">
      <tr><td style="background:#3c38cf;background-image:linear-gradient(180deg,#7a74ff,#3c38cf);border-radius:16px 16px 0 0;padding:22px 24px;color:#ffffff;font-size:18px;">
        Agenda ${escapar(nomeEmpresa)}
      </td></tr>
      <tr><td style="background:#ffffff;border-radius:0 0 16px 16px;padding:24px;font-size:15px;line-height:1.5;">
        <p style="margin:0 0 4px;font-size:16px;">${escapar(saudacao)}</p>
        <p style="margin:0 0 16px;">${escapar(abertura)}</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border:2px solid #4e4add;border-radius:12px;">
          <tr><td style="padding:14px 16px;">
            <div style="font-size:16px;font-weight:600;">${escapar(titulo)}</div>
            ${titulo !== servico ? `<div style="font-size:13px;color:#8e8aee;">${escapar(servico)}</div>` : ""}
            <div style="margin-top:8px;">${escapar(data)}</div>
            <div>${escapar(de)} às ${escapar(ate)}</div>
          </td></tr>
        </table>
        <p style="margin:16px 0 0;font-size:13px;">${escapar(regra)}</p>
        ${
          link
            ? `<p style="margin:16px 0 0;"><a href="${escapar(link)}" style="display:inline-block;background:#3c38cf;color:#ffffff;text-decoration:none;border-radius:12px;padding:12px 22px;font-size:14px;">Ver meus horários</a></p>`
            : ""
        }
        <p style="margin:20px 0 0;font-size:12px;color:#8e8aee;">${escapar(nomeEmpresa)}</p>
      </td></tr>
    </table>
  </body>
</html>`;

  return { assunto, html, texto };
}

async function enviarEmail(
  para: string,
  email: { assunto: string; html: string; texto: string },
): Promise<boolean> {
  const resposta = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${chaveResend}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: remetente,
      to: [para],
      subject: email.assunto,
      html: email.html,
      text: email.texto,
    }),
  });
  if (!resposta.ok) {
    console.error("Resend recusou o envio:", resposta.status, await resposta.text());
  }
  return resposta.ok;
}

async function prazoDeCancelamento(): Promise<number> {
  const { data } = await admin
    .from("configuracoes")
    .select("prazo_cancelamento_horas")
    .eq("id", 1)
    .maybeSingle();
  return (data?.prazo_cancelamento_horas as number | undefined) ?? 0;
}

/** Processa um tipo de aviso (confirmação ou lembrete). */
async function processar(tipo: Tipo, prazoHoras: number): Promise<Resumo> {
  const coluna = tipo === "confirmacao" ? "confirmacao_enviada" : "lembrete_enviado";
  const agora = new Date();
  const em24h = new Date(agora.getTime() + 24 * 60 * 60 * 1000);

  let consulta = admin
    .from("agendamentos")
    .select(
      "id, titulo, inicio, fim, cliente_id, servicos(nome), cliente:perfis!cliente_id(nome)",
    )
    .eq("status", "confirmado")
    .eq(coluna, false)
    .gt("inicio", agora.toISOString())
    .order("inicio", { ascending: true })
    .limit(LOTE);
  if (tipo === "lembrete") consulta = consulta.lte("inicio", em24h.toISOString());

  const { data, error } = await consulta;
  if (error) {
    console.error(`Falha ao buscar ${tipo}:`, error.message);
    return { enviados: 0, falhas: 1, ignorados: 0 };
  }

  const resumo: Resumo = { enviados: 0, falhas: 0, ignorados: 0 };

  for (const linha of (data ?? []) as unknown as LinhaAgendamento[]) {
    // 1) reivindica o aviso: só uma execução consegue marcar false -> true
    const { data: reivindicado } = await admin
      .from("agendamentos")
      .update({ [coluna]: true })
      .eq("id", linha.id)
      .eq(coluna, false)
      .select("id");
    if (!reivindicado || reivindicado.length === 0) {
      resumo.ignorados++;
      continue;
    }

    // 2) cliente sem conta (agendada pela dona): não há e-mail para avisar
    if (!linha.cliente_id) {
      resumo.ignorados++;
      continue;
    }
    const { data: usuario } = await admin.auth.admin.getUserById(linha.cliente_id);
    const email = usuario?.user?.email;
    if (!email) {
      resumo.ignorados++;
      continue;
    }

    // 3) envia; se falhar, desfaz a marca para tentar de novo na próxima hora
    let ok = false;
    try {
      ok = await enviarEmail(email, montarEmail(tipo, linha, prazoHoras));
    } catch (erro) {
      console.error("Erro ao enviar e-mail:", erro);
    }
    if (ok) {
      resumo.enviados++;
    } else {
      resumo.falhas++;
      await admin.from("agendamentos").update({ [coluna]: false }).eq("id", linha.id);
    }
    await pausa(PAUSA_MS);
  }

  return resumo;
}

Deno.serve(async (requisicao) => {
  if (requisicao.method !== "POST") return json({ erro: "Método não permitido." }, 405);

  const recebido = requisicao.headers.get("x-notificacoes-segredo") ?? "";
  if (!segredoEsperado || !iguais(recebido, segredoEsperado)) {
    return json({ erro: "Não autorizado." }, 401);
  }

  if (!urlSupabase || !chaveServico || !chaveResend || !remetente) {
    console.error("Configuração incompleta (SUPABASE_*, RESEND_API_KEY, EMAIL_REMETENTE).");
    return json({ erro: "Função não configurada." }, 500);
  }

  const corpo = await requisicao.json().catch(() => ({}));
  const tudo = corpo?.tarefa === "tudo";

  const prazoHoras = await prazoDeCancelamento();
  const confirmacoes = await processar("confirmacao", prazoHoras);
  const lembretes = tudo
    ? await processar("lembrete", prazoHoras)
    : { enviados: 0, falhas: 0, ignorados: 0 };

  return json({ confirmacoes, lembretes });
});
