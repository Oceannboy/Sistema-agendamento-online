import "server-only";
import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/server";
import { obterPerfil } from "@/lib/dados/perfil";
import type {
  AgendamentoLista,
  Bloqueio,
  ClienteResumo,
  Configuracoes,
  FaixaHorario,
  PerfilUsuario,
  ServicoAdmin,
  StatusAgendamento,
} from "@/types";

/**
 * Garante que quem está vendo a página é admin. É conforto de navegação:
 * a segurança real continua no RLS e nas RPCs do banco (um cliente que
 * burlasse isto não leria nem alteraria nada).
 * Não redireciona para /login quando falta o perfil (o proxy mandaria de
 * volta para /agenda e formaria um ciclo): lança erro.
 */
export async function exigirAdmin(): Promise<PerfilUsuario> {
  const perfil = await obterPerfil();
  if (!perfil) throw new Error("Perfil não encontrado. Saia e entre novamente.");
  if (perfil.papel !== "admin") redirect("/agenda");
  return perfil;
}

type LinhaAgenda = {
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

/** Agenda de um período (todos os status), do mais cedo ao mais tarde. */
export async function obterAgendaAdmin(
  inicioISO: string,
  fimISO: string,
): Promise<AgendamentoLista[]> {
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("agendamentos")
    .select(
      "id, titulo, inicio, fim, status, servico_id, cliente_nome_avulso, cliente_telefone_avulso, servicos(nome), cliente:perfis!cliente_id(nome, telefone)",
    )
    .gte("inicio", inicioISO)
    .lt("inicio", fimISO)
    .order("inicio", { ascending: true })
    .limit(500);

  if (error) throw new Error("Não foi possível carregar a agenda.");

  return ((data ?? []) as unknown as LinhaAgenda[]).map((linha) => ({
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

const COLUNAS_SERVICO = "id, nome, descricao, preco, duracao_min, ativo, foto_url";

/** Todos os serviços (ativos primeiro). Só admin enxerga os inativos (RLS). */
export async function obterServicosAdmin(): Promise<ServicoAdmin[]> {
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("servicos")
    .select(COLUNAS_SERVICO)
    .order("ativo", { ascending: false })
    .order("duracao_min", { ascending: true })
    .order("nome", { ascending: true });

  if (error) throw new Error("Não foi possível carregar os serviços.");
  return (data ?? []) as ServicoAdmin[];
}

export async function obterServicoAdmin(id: string): Promise<ServicoAdmin | null> {
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("servicos")
    .select(COLUNAS_SERVICO)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error("Não foi possível carregar o serviço.");
  return (data as ServicoAdmin | null) ?? null;
}

/** Faixas de funcionamento (HH:MM:SS do banco viram HH:MM). */
export async function obterFaixas(): Promise<FaixaHorario[]> {
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("horarios_funcionamento")
    .select("id, dia_semana, abre, fecha")
    .order("dia_semana", { ascending: true })
    .order("abre", { ascending: true });

  if (error) throw new Error("Não foi possível carregar os horários.");
  return ((data ?? []) as FaixaHorario[]).map((f) => ({
    ...f,
    abre: f.abre.slice(0, 5),
    fecha: f.fecha.slice(0, 5),
  }));
}

export async function obterConfiguracoes(): Promise<Configuracoes> {
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("configuracoes")
    .select("antecedencia_min_minutos, prazo_cancelamento_horas, intervalo_min")
    .eq("id", 1)
    .single();

  if (error || !data) throw new Error("Não foi possível carregar as regras.");
  return data as Configuracoes;
}

/** Bloqueios que ainda não terminaram. */
export async function obterBloqueiosFuturos(): Promise<Bloqueio[]> {
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("bloqueios")
    .select("id, inicio, fim, motivo")
    .gte("fim", new Date().toISOString())
    .order("inicio", { ascending: true })
    .limit(200);

  if (error) throw new Error("Não foi possível carregar os bloqueios.");
  return (data ?? []) as Bloqueio[];
}

/** Clientes cadastradas (para agendar manualmente). */
export async function obterClientes(): Promise<ClienteResumo[]> {
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("perfis")
    .select("id, nome, usuario, telefone")
    .order("nome", { ascending: true })
    .limit(1000);

  if (error) throw new Error("Não foi possível carregar as clientes.");
  return (data ?? []) as ClienteResumo[];
}
