import "server-only";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { AgendamentoLista, StatusAgendamento } from "@/types";

type LinhaBanco = {
  id: string;
  titulo: string | null;
  inicio: string;
  fim: string;
  status: StatusAgendamento;
  servico_id: string;
  cliente_nome_avulso: string | null;
  cliente_telefone_avulso: string | null;
  servicos: { nome: string } | null;
  cliente: { nome: string; telefone: string | null } | null;
};

/**
 * Agendamentos FUTUROS e ATIVOS, em ordem crescente.
 * O RLS decide o que cada pessoa enxerga: a cliente vê só os seus, a admin vê
 * todos (com nome e telefone da cliente).
 *
 * "cliente:perfis!cliente_id(...)" indica qual chave estrangeira usar, porque
 * agendamentos também se liga a perfis por cancelado_por.
 */
export async function obterAgendamentosFuturos(): Promise<AgendamentoLista[]> {
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("agendamentos")
    .select(
      "id, titulo, inicio, fim, status, servico_id, cliente_nome_avulso, cliente_telefone_avulso, servicos(nome), cliente:perfis!cliente_id(nome, telefone)",
    )
    .in("status", ["pendente", "confirmado"])
    .gte("inicio", new Date().toISOString())
    .order("inicio", { ascending: true })
    .limit(100);

  if (error) throw new Error("Não foi possível carregar os horários.");

  return ((data ?? []) as unknown as LinhaBanco[]).map((linha) => ({
    id: linha.id,
    titulo: linha.titulo,
    inicio: linha.inicio,
    fim: linha.fim,
    status: linha.status,
    servicoId: linha.servico_id,
    servicoNome: linha.servicos?.nome ?? "Serviço",
    clienteNome: linha.cliente?.nome || linha.cliente_nome_avulso,
    clienteTelefone: linha.cliente?.telefone ?? linha.cliente_telefone_avulso,
  }));
}

export type AgendamentoParaEdicao = {
  id: string;
  titulo: string | null;
  inicio: string;
  status: StatusAgendamento;
  servicoId: string;
};

/** Um agendamento pelo id (o RLS garante que é da usuária ou que ela é admin). */
export async function obterAgendamentoPorId(
  id: string,
): Promise<AgendamentoParaEdicao | null> {
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("agendamentos")
    .select("id, titulo, inicio, status, servico_id")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error("Não foi possível carregar o horário.");
  if (!data) return null;

  return {
    id: data.id,
    titulo: data.titulo,
    inicio: data.inicio,
    status: data.status as StatusAgendamento,
    servicoId: data.servico_id,
  };
}
