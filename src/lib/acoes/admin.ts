"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { chaveDia, paraInstante, somarDias } from "@/lib/datas";
import { obterPerfil } from "@/lib/dados/perfil";
import { mensagemDeErro } from "@/lib/erros";
import { criarClienteServidor } from "@/lib/supabase/server";
import {
  errosPorCampo,
  esquemaAgendamentoManual,
  esquemaBloqueio,
  esquemaConfiguracoes,
  esquemaFaixa,
  esquemaId,
  esquemaServico,
  formatarTelefone,
} from "@/lib/validacao";
import type { EstadoForm } from "./tipos";

/**
 * Ações do painel admin. Cada uma confere o papel (conforto de mensagem) e,
 * de qualquer forma, o banco só obedece admin: RLS nas tabelas e verificação
 * de papel dentro das RPCs.
 */

type Resultado = { erro?: string };

const SEM_PERMISSAO = "Você não tem permissão para fazer isso.";
const ERRO_GENERICO = "Não foi possível salvar agora. Tente novamente.";

function texto(formData: FormData, campo: string): string {
  const valor = formData.get(campo);
  return typeof valor === "string" ? valor : "";
}

async function contextoAdmin() {
  const perfil = await obterPerfil();
  if (!perfil || perfil.papel !== "admin") return null;
  return { supabase: await criarClienteServidor() };
}

function atualizarTelas() {
  revalidatePath("/admin", "layout");
  revalidatePath("/agenda", "layout"); // serviços e horários também aparecem para as clientes
}

function primeiroErro(erros: Record<string, string>): string {
  return Object.values(erros)[0] ?? "Confira os dados e tente novamente.";
}

/* ----------------------------- agenda ---------------------------------- */

/** Confirmar, concluir, cancelar ou reabrir um agendamento. */
export async function alterarStatusAgendamento(
  _estado: EstadoForm,
  formData: FormData,
): Promise<EstadoForm> {
  const ctx = await contextoAdmin();
  if (!ctx) return { erro: SEM_PERMISSAO };

  const id = esquemaId.safeParse(texto(formData, "id"));
  const status = texto(formData, "status");
  if (!id.success || !["pendente", "confirmado", "cancelado", "concluido"].includes(status)) {
    return { erro: "Agendamento não encontrado." };
  }

  const { error } = await ctx.supabase.rpc("alterar_status_agendamento", {
    p_id: id.data,
    p_status: status,
  });
  if (error) return { erro: mensagemDeErro(error) };

  atualizarTelas();
  return { sucesso: "ok" };
}

/** Agendamento manual: cliente com conta ou avulsa (chamou no WhatsApp). */
export async function adminCriarAgendamento(
  _estado: EstadoForm,
  formData: FormData,
): Promise<EstadoForm> {
  const ctx = await contextoAdmin();
  if (!ctx) return { erro: SEM_PERMISSAO };

  const bruto = {
    tipo: texto(formData, "tipo"),
    cliente: texto(formData, "cliente") || undefined,
    nome: texto(formData, "nome"),
    telefone: texto(formData, "telefone"),
    servico: texto(formData, "servico"),
    inicio: texto(formData, "inicio"),
    titulo: texto(formData, "titulo"),
  };
  const valores = {
    nome: bruto.nome,
    telefone: bruto.telefone,
    titulo: bruto.titulo,
  };

  const dados = esquemaAgendamentoManual.safeParse(bruto);
  if (!dados.success) {
    const erros = errosPorCampo(dados.error);
    return { erro: primeiroErro(erros), erros, valores };
  }

  const d = dados.data;
  const digitos = (d.telefone ?? "").replace(/\D/g, "");
  const telefone =
    digitos.length === 10 || digitos.length === 11
      ? formatarTelefone(digitos)
      : d.telefone || null;

  const { error } = await ctx.supabase.rpc("admin_criar_agendamento", {
    p_servico: d.servico,
    p_inicio: d.inicio,
    p_titulo: d.titulo ?? "",
    p_cliente: d.tipo === "conta" ? d.cliente : null,
    p_nome_avulso: d.tipo === "avulso" ? d.nome : null,
    p_telefone_avulso: d.tipo === "avulso" ? telefone : null,
  });
  if (error) return { erro: mensagemDeErro(error), valores };

  atualizarTelas();
  redirect(`/admin?data=${chaveDia(d.inicio)}`);
}

/* ----------------------------- serviços -------------------------------- */

/** Criar (sem id) ou editar (com id) um serviço. */
export async function salvarServico(
  _estado: EstadoForm,
  formData: FormData,
): Promise<EstadoForm> {
  const ctx = await contextoAdmin();
  if (!ctx) return { erro: SEM_PERMISSAO };

  const bruto = {
    id: texto(formData, "id") || undefined,
    nome: texto(formData, "nome"),
    descricao: texto(formData, "descricao"),
    preco: texto(formData, "preco"),
    duracao: texto(formData, "duracao"),
    ativo: formData.get("ativo") === "on",
  };
  const valores = {
    nome: bruto.nome,
    descricao: bruto.descricao,
    preco: bruto.preco,
    duracao: bruto.duracao,
  };

  const dados = esquemaServico.safeParse(bruto);
  if (!dados.success) return { erros: errosPorCampo(dados.error), valores };

  const campos = {
    nome: dados.data.nome,
    descricao: dados.data.descricao || null,
    preco: dados.data.preco,
    duracao_min: dados.data.duracao,
    ativo: dados.data.ativo,
  };

  if (dados.data.id) {
    const { error } = await ctx.supabase
      .from("servicos")
      .update(campos)
      .eq("id", dados.data.id);
    if (error) return { erro: ERRO_GENERICO, valores };
    atualizarTelas();
    return { sucesso: "Serviço salvo.", valores };
  }

  const { data, error } = await ctx.supabase
    .from("servicos")
    .insert(campos)
    .select("id")
    .single();
  if (error || !data) return { erro: ERRO_GENERICO, valores };

  atualizarTelas();
  redirect(`/admin/servicos/${data.id}?criado=1`);
}

/** Ativar ou desativar (serviços não são apagados: o histórico depende deles). */
export async function alternarServico(
  _estado: EstadoForm,
  formData: FormData,
): Promise<EstadoForm> {
  const ctx = await contextoAdmin();
  if (!ctx) return { erro: SEM_PERMISSAO };

  const id = esquemaId.safeParse(texto(formData, "id"));
  if (!id.success) return { erro: "Serviço não encontrado." };

  const { error } = await ctx.supabase
    .from("servicos")
    .update({ ativo: texto(formData, "ativo") === "true" })
    .eq("id", id.data);
  if (error) return { erro: ERRO_GENERICO };

  atualizarTelas();
  return { sucesso: "ok" };
}

function caminhoDaFoto(url: string | null, servicoId: string): string | null {
  if (!url) return null;
  const marca = "/servicos-fotos/";
  const posicao = url.indexOf(marca);
  if (posicao < 0) return null;
  const caminho = url.slice(posicao + marca.length).split("?")[0];
  return caminho.startsWith(`${servicoId}/`) ? caminho : null;
}

/** O navegador sobe a foto para o Storage (política: só admin); aqui gravamos a URL. */
export async function definirFotoServico(
  servicoId: string,
  caminho: string,
): Promise<Resultado> {
  const ctx = await contextoAdmin();
  if (!ctx) return { erro: SEM_PERMISSAO };
  if (
    !esquemaId.safeParse(servicoId).success ||
    typeof caminho !== "string" ||
    caminho.length > 200 ||
    caminho.includes("..") ||
    !caminho.startsWith(`${servicoId}/`)
  ) {
    return { erro: "Arquivo inválido." };
  }

  const { data: atual } = await ctx.supabase
    .from("servicos")
    .select("foto_url")
    .eq("id", servicoId)
    .maybeSingle();

  const { data: publico } = ctx.supabase.storage
    .from("servicos-fotos")
    .getPublicUrl(caminho);
  const { error } = await ctx.supabase
    .from("servicos")
    .update({ foto_url: publico.publicUrl })
    .eq("id", servicoId);
  if (error) return { erro: "Não foi possível salvar a foto." };

  const anterior = caminhoDaFoto(atual?.foto_url ?? null, servicoId);
  if (anterior && anterior !== caminho) {
    await ctx.supabase.storage.from("servicos-fotos").remove([anterior]);
  }
  atualizarTelas();
  return {};
}

export async function removerFotoServico(servicoId: string): Promise<Resultado> {
  const ctx = await contextoAdmin();
  if (!ctx) return { erro: SEM_PERMISSAO };
  if (!esquemaId.safeParse(servicoId).success) return { erro: "Serviço inválido." };

  const { data: atual } = await ctx.supabase
    .from("servicos")
    .select("foto_url")
    .eq("id", servicoId)
    .maybeSingle();

  const { error } = await ctx.supabase
    .from("servicos")
    .update({ foto_url: null })
    .eq("id", servicoId);
  if (error) return { erro: "Não foi possível remover a foto." };

  const anterior = caminhoDaFoto(atual?.foto_url ?? null, servicoId);
  if (anterior) await ctx.supabase.storage.from("servicos-fotos").remove([anterior]);
  atualizarTelas();
  return {};
}

/* ------------------------ horários de funcionamento -------------------- */

/** Adiciona uma faixa (ex.: 13:00 às 18:00) a um dia da semana. */
export async function adicionarFaixa(
  _estado: EstadoForm,
  formData: FormData,
): Promise<EstadoForm> {
  const ctx = await contextoAdmin();
  if (!ctx) return { erro: SEM_PERMISSAO };

  const dados = esquemaFaixa.safeParse({
    dia: texto(formData, "dia"),
    abre: texto(formData, "abre"),
    fecha: texto(formData, "fecha"),
  });
  if (!dados.success) return { erro: primeiroErro(errosPorCampo(dados.error)) };

  // o banco não impede faixas sobrepostas no mesmo dia: conferimos aqui
  const { data: existentes, error: erroConsulta } = await ctx.supabase
    .from("horarios_funcionamento")
    .select("abre, fecha")
    .eq("dia_semana", dados.data.dia);
  if (erroConsulta) return { erro: ERRO_GENERICO };

  const sobrepoe = ((existentes ?? []) as { abre: string; fecha: string }[]).some(
    (f) => dados.data.abre < f.fecha.slice(0, 5) && dados.data.fecha > f.abre.slice(0, 5),
  );
  if (sobrepoe) {
    return { erro: "Essa faixa se sobrepõe a outra já cadastrada nesse dia." };
  }

  const { error } = await ctx.supabase.from("horarios_funcionamento").insert({
    dia_semana: dados.data.dia,
    abre: dados.data.abre,
    fecha: dados.data.fecha,
  });
  if (error) return { erro: ERRO_GENERICO };

  atualizarTelas();
  return { sucesso: "Faixa adicionada." };
}

export async function removerFaixa(
  _estado: EstadoForm,
  formData: FormData,
): Promise<EstadoForm> {
  const ctx = await contextoAdmin();
  if (!ctx) return { erro: SEM_PERMISSAO };

  const id = esquemaId.safeParse(texto(formData, "id"));
  if (!id.success) return { erro: "Faixa não encontrada." };

  const { error } = await ctx.supabase
    .from("horarios_funcionamento")
    .delete()
    .eq("id", id.data);
  if (error) return { erro: ERRO_GENERICO };

  atualizarTelas();
  return { sucesso: "ok" };
}

/** Regras: antecedência mínima, prazo de cancelamento e intervalo dos horários. */
export async function salvarConfiguracoes(
  _estado: EstadoForm,
  formData: FormData,
): Promise<EstadoForm> {
  const ctx = await contextoAdmin();
  if (!ctx) return { erro: SEM_PERMISSAO };

  const bruto = {
    antecedencia: texto(formData, "antecedencia"),
    prazo: texto(formData, "prazo"),
    intervalo: texto(formData, "intervalo"),
  };
  const dados = esquemaConfiguracoes.safeParse(bruto);
  if (!dados.success) return { erros: errosPorCampo(dados.error), valores: bruto };

  const { error } = await ctx.supabase
    .from("configuracoes")
    .update({
      antecedencia_min_minutos: dados.data.antecedencia,
      prazo_cancelamento_horas: dados.data.prazo,
      intervalo_min: dados.data.intervalo,
    })
    .eq("id", 1);
  if (error) return { erro: ERRO_GENERICO, valores: bruto };

  atualizarTelas();
  return { sucesso: "Regras salvas.", valores: bruto };
}

/* ------------------------------ bloqueios ------------------------------ */

/** Cria um bloqueio (feriado, folga, imprevisto) de dia(s) inteiro(s) ou com horário. */
export async function criarBloqueio(
  _estado: EstadoForm,
  formData: FormData,
): Promise<EstadoForm> {
  const ctx = await contextoAdmin();
  if (!ctx) return { erro: SEM_PERMISSAO };

  const bruto = {
    dataInicio: texto(formData, "dataInicio"),
    dataFim: texto(formData, "dataFim"),
    diaInteiro: formData.get("diaInteiro") === "on",
    horaInicio: texto(formData, "horaInicio"),
    horaFim: texto(formData, "horaFim"),
    motivo: texto(formData, "motivo"),
  };
  const valores = {
    dataInicio: bruto.dataInicio,
    dataFim: bruto.dataFim,
    horaInicio: bruto.horaInicio,
    horaFim: bruto.horaFim,
    motivo: bruto.motivo,
  };

  const dados = esquemaBloqueio.safeParse(bruto);
  if (!dados.success) return { erros: errosPorCampo(dados.error), valores };

  const d = dados.data;
  const inicio = d.diaInteiro
    ? paraInstante(d.dataInicio, "00:00")
    : paraInstante(d.dataInicio, d.horaInicio ?? "00:00");
  const fim = d.diaInteiro
    ? paraInstante(somarDias(d.dataFim, 1), "00:00")
    : paraInstante(d.dataFim, d.horaFim ?? "00:00");

  if (fim.getTime() <= inicio.getTime()) {
    return { erros: { horaFim: "O fim precisa ser depois do início." }, valores };
  }

  const { error } = await ctx.supabase.from("bloqueios").insert({
    inicio: inicio.toISOString(),
    fim: fim.toISOString(),
    motivo: d.motivo || null,
  });
  if (error) return { erro: ERRO_GENERICO, valores };

  // avisa se já existem agendamentos ativos dentro do período bloqueado
  const { count } = await ctx.supabase
    .from("agendamentos")
    .select("id", { count: "exact", head: true })
    .in("status", ["pendente", "confirmado"])
    .lt("inicio", fim.toISOString())
    .gt("fim", inicio.toISOString());

  atualizarTelas();
  return {
    sucesso:
      count && count > 0
        ? `Bloqueio criado. Atenção: já existem ${count} agendamento(s) nesse período. Eles continuam marcados: avise as clientes ou remarque.`
        : "Bloqueio criado.",
  };
}

export async function removerBloqueio(
  _estado: EstadoForm,
  formData: FormData,
): Promise<EstadoForm> {
  const ctx = await contextoAdmin();
  if (!ctx) return { erro: SEM_PERMISSAO };

  const id = esquemaId.safeParse(texto(formData, "id"));
  if (!id.success) return { erro: "Bloqueio não encontrado." };

  const { error } = await ctx.supabase.from("bloqueios").delete().eq("id", id.data);
  if (error) return { erro: ERRO_GENERICO };

  atualizarTelas();
  return { sucesso: "ok" };
}
