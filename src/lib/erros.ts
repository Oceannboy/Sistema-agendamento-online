/**
 * Traduz os erros do banco (RPCs de agendamento, migration 0003) e do
 * Supabase para mensagens em PT-BR.
 *
 * As RPCs lançam SQLSTATE próprio (AG001...) e uma mensagem curta
 * (ex.: "horario_conflito"). O PostgREST devolve { code, message }.
 */

type ErroSupabase = { code?: string | null; message?: string | null };

const POR_CODIGO: Record<string, string> = {
  AG001: "Esse horário acabou de ser reservado, escolha outro.",
  AG002: "Esse horário está fora do expediente. Escolha outro.",
  AG003: "Esse dia ou horário está bloqueado. Escolha outro.",
  AG004: "Escolha um horário no futuro.",
  AG005: "Esse serviço não está disponível no momento.",
  AG006:
    "O prazo para cancelar ou remarcar esse horário já passou. Fale com a loja.",
  AG007: "Agendamento não encontrado.",
  AG008: "Esse agendamento não está mais ativo.",
  AG009: "Sua sessão expirou. Entre novamente.",
  AG010: "Confira os dados informados e tente de novo.",
  AG011: "Esse horário exige mais antecedência. Escolha um horário mais à frente.",
  AG012: "Você não tem permissão para fazer isso.",
  AG013: "Você não tem permissão para fazer isso.",
  "42501": "Você não tem permissão para fazer isso.",
};

/** Mensagens mais específicas, pela mensagem curta da RPC (têm prioridade). */
const POR_MENSAGEM: Record<string, string> = {
  titulo_invalido: "O título pode ter no máximo 60 caracteres.",
  cliente_nao_informado: "Informe a cliente (com conta ou nome e telefone).",
  cliente_invalido: "Cliente não encontrada.",
};

export const MENSAGEM_ERRO_GENERICA =
  "Algo deu errado. Tente novamente em instantes.";

export function mensagemDeErro(erro: ErroSupabase | null | undefined): string {
  if (!erro) return MENSAGEM_ERRO_GENERICA;
  if (erro.message && POR_MENSAGEM[erro.message]) {
    return POR_MENSAGEM[erro.message];
  }
  if (erro.code && POR_CODIGO[erro.code]) return POR_CODIGO[erro.code];
  return MENSAGEM_ERRO_GENERICA;
}

/** O erro é de conflito de horário? (para recarregar os horários livres) */
export function ehConflitoDeHorario(erro: ErroSupabase | null | undefined) {
  return erro?.code === "AG001";
}
