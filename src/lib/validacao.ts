import { z } from "zod";
import { chaveValida } from "./datas";

/** Usuário: 3 a 20 caracteres, minúsculo (mesma regra do banco). */
export const REGEX_USUARIO = /^[a-z0-9._]{3,20}$/;

/** Formata 10 ou 11 dígitos como (DD) NNNN-NNNN ou (DD) NNNNN-NNNN. */
export function formatarTelefone(digitos: string): string {
  if (digitos.length === 11) {
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
  }
  if (digitos.length === 10) {
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`;
  }
  return digitos;
}

const campoNome = z
  .string()
  .trim()
  .min(2, "Informe seu nome.")
  .max(80, "O nome pode ter no máximo 80 caracteres.");

const campoTelefone = z
  .string()
  .trim()
  .transform((valor) => valor.replace(/\D/g, ""))
  .refine(
    (digitos) => digitos.length === 10 || digitos.length === 11,
    "Informe o telefone com DDD.",
  )
  .transform(formatarTelefone);

/** Login: aceita usuário OU e-mail no mesmo campo. */
export const esquemaLogin = z.object({
  identificador: z
    .string()
    .trim()
    .min(1, "Informe seu usuário.")
    .max(254, "Usuário inválido."),
  senha: z.string().min(1, "Informe sua senha.").max(72, "Senha inválida."),
});

/** Cadastro: nome, usuário, e-mail, telefone e senha. */
export const esquemaCadastro = z.object({
  nome: campoNome,
  usuario: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      REGEX_USUARIO,
      "Use de 3 a 20 caracteres: letras, números, ponto ou _ (sem espaços).",
    ),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Informe um e-mail válido.")
    .max(254, "E-mail muito longo."),
  telefone: campoTelefone,
  senha: z
    .string()
    .min(8, "A senha deve ter pelo menos 8 caracteres.")
    .max(72, "A senha pode ter no máximo 72 caracteres."),
});

/** Edição do perfil (o usuário de login não muda por aqui). */
export const esquemaPerfil = z.object({
  nome: campoNome,
  telefone: campoTelefone,
});

/** Identificador (uuid) vindo de formulário ou de parâmetro de URL. */
export const esquemaId = z.string().uuid();

/** Tela 4: criar ou remarcar. O início é um instante ISO (UTC ou com offset). */
export const esquemaAgendamento = z.object({
  id: z.string().uuid().optional(),
  servico: z.string().uuid("Escolha o tipo de trabalho."),
  inicio: z
    .string()
    .datetime({ offset: true, message: "Escolha o dia e o horário." }),
  titulo: z
    .string()
    .trim()
    .max(60, "O título pode ter no máximo 60 caracteres.")
    .optional(),
});

/** Primeira mensagem de erro de cada campo, para mostrar abaixo do input. */
export function errosPorCampo(erro: z.ZodError): Record<string, string> {
  const resultado: Record<string, string> = {};
  for (const problema of erro.issues) {
    const campo = String(problema.path[0] ?? "_");
    if (!(campo in resultado)) resultado[campo] = problema.message;
  }
  return resultado;
}

// ---------------------------------------------------------------------
// Painel admin
// ---------------------------------------------------------------------

const REGEX_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

function inteiro(minimo: number, maximo: number, mensagem: string) {
  return z.coerce
    .number({ invalid_type_error: mensagem })
    .int(mensagem)
    .min(minimo, mensagem)
    .max(maximo, mensagem);
}

/** Serviço: criar ou editar (preço aceita vírgula: "40,00"). */
export const esquemaServico = z.object({
  id: z.string().uuid().optional(),
  nome: z
    .string()
    .trim()
    .min(1, "Informe o nome do serviço.")
    .max(60, "O nome pode ter no máximo 60 caracteres."),
  descricao: z
    .string()
    .trim()
    .max(300, "A descrição pode ter no máximo 300 caracteres.")
    .optional(),
  preco: z
    .string()
    .trim()
    .min(1, "Informe o preço.")
    // "1.234,50" (com vírgula) ou "40.50" (só ponto): os dois viram número
    .transform((valor) =>
      Number(valor.includes(",") ? valor.replace(/\./g, "").replace(",", ".") : valor),
    )
    .refine(
      (numero) => Number.isFinite(numero) && numero >= 0 && numero <= 99999,
      "Informe um preço válido (ex.: 40,00).",
    ),
  duracao: inteiro(5, 480, "A duração deve ficar entre 5 e 480 minutos."),
  ativo: z.boolean(),
});

/** Faixa de funcionamento de um dia da semana. */
export const esquemaFaixa = z
  .object({
    dia: inteiro(0, 6, "Dia da semana inválido."),
    abre: z.string().regex(REGEX_HORA, "Informe a hora de abertura."),
    fecha: z.string().regex(REGEX_HORA, "Informe a hora de fechamento."),
  })
  .refine((dados) => dados.fecha > dados.abre, {
    message: "O fechamento precisa ser depois da abertura.",
    path: ["fecha"],
  });

/** Regras de agendamento (tabela configuracoes). */
export const esquemaConfiguracoes = z.object({
  antecedencia: inteiro(0, 10080, "Antecedência: informe de 0 a 10080 minutos."),
  prazo: inteiro(0, 720, "Prazo de cancelamento: informe de 0 a 720 horas."),
  intervalo: inteiro(5, 120, "Intervalo: informe de 5 a 120 minutos."),
});

/** Bloqueio: dia(s) inteiro(s) ou período com horário. */
export const esquemaBloqueio = z
  .object({
    dataInicio: z.string().refine(chaveValida, "Informe a data inicial."),
    dataFim: z.string().refine(chaveValida, "Informe a data final."),
    diaInteiro: z.boolean(),
    horaInicio: z.string().optional(),
    horaFim: z.string().optional(),
    motivo: z
      .string()
      .trim()
      .max(80, "O motivo pode ter no máximo 80 caracteres.")
      .optional(),
  })
  .superRefine((dados, contexto) => {
    if (chaveValida(dados.dataInicio) && chaveValida(dados.dataFim)) {
      if (dados.dataFim < dados.dataInicio) {
        contexto.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["dataFim"],
          message: "A data final não pode ser antes da inicial.",
        });
      }
    }
    if (!dados.diaInteiro) {
      if (!REGEX_HORA.test(dados.horaInicio ?? "")) {
        contexto.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["horaInicio"],
          message: "Informe a hora inicial.",
        });
      }
      if (!REGEX_HORA.test(dados.horaFim ?? "")) {
        contexto.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["horaFim"],
          message: "Informe a hora final.",
        });
      }
    }
  });

/** Agendamento manual feito pela dona (cliente com conta ou avulsa). */
export const esquemaAgendamentoManual = z
  .object({
    tipo: z.enum(["conta", "avulso"]),
    cliente: z.string().optional(),
    nome: z.string().trim().max(80, "O nome pode ter no máximo 80 caracteres.").optional(),
    telefone: z.string().trim().max(20, "Telefone muito longo.").optional(),
    servico: z.string().uuid("Escolha o tipo de trabalho."),
    inicio: z
      .string()
      .datetime({ offset: true, message: "Escolha o dia e o horário." }),
    titulo: z
      .string()
      .trim()
      .max(60, "O título pode ter no máximo 60 caracteres.")
      .optional(),
  })
  .superRefine((dados, contexto) => {
    if (dados.tipo === "conta" && !z.string().uuid().safeParse(dados.cliente).success) {
      contexto.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["cliente"],
        message: "Escolha a cliente.",
      });
    }
    if (dados.tipo === "avulso" && !dados.nome) {
      contexto.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["nome"],
        message: "Informe o nome da cliente.",
      });
    }
  });
