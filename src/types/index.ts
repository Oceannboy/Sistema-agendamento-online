/** Tipos usados pelas telas (espelham o que as consultas devolvem). */

export type Servico = {
  id: string;
  nome: string;
  descricao: string | null;
  preco: number;
  duracao_min: number;
};

export type PapelUsuario = "cliente" | "admin";

export type PerfilUsuario = {
  id: string;
  nome: string;
  usuario: string;
  telefone: string | null;
  avatarUrl: string | null;
  email: string;
  papel: PapelUsuario;
  /** Só serviços ativos, do mais curto para o mais longo. */
  favoritos: Servico[];
};

export type StatusAgendamento =
  | "pendente"
  | "confirmado"
  | "cancelado"
  | "concluido";

/** Agendamento como aparece na lista da tela 3. */
export type AgendamentoLista = {
  id: string;
  titulo: string | null;
  inicio: string;
  fim: string;
  status: StatusAgendamento;
  servicoId: string;
  servicoNome: string;
  /** Nome da cliente (conta ou avulso). Só é exibido para admin. */
  clienteNome: string | null;
  clienteTelefone: string | null;
};

/** Painel admin ------------------------------------------------------- */

export type ServicoAdmin = Servico & {
  ativo: boolean;
  foto_url: string | null;
};

/** Faixa de funcionamento (0 = domingo; horários no formato HH:MM). */
export type FaixaHorario = {
  id: string;
  dia_semana: number;
  abre: string;
  fecha: string;
};

export type Bloqueio = {
  id: string;
  inicio: string;
  fim: string;
  motivo: string | null;
};

export type Configuracoes = {
  antecedencia_min_minutos: number;
  prazo_cancelamento_horas: number;
  intervalo_min: number;
};

export type ClienteResumo = {
  id: string;
  nome: string;
  usuario: string;
  telefone: string | null;
};
