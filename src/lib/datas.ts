import { FUSO_HORARIO } from "./config";

/**
 * Datas e horas SEMPRE no fuso da loja (America/Sao_Paulo), independente do
 * fuso do aparelho. Um "dia" é uma string AAAA-MM-DD; um "horário" é HH:mm.
 * Meses são 0 a 11 (como no JavaScript).
 */

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export const DIAS_SEMANA = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SAB"];

export function nomeDoMes(mes0: number): string {
  return MESES[mes0] ?? "";
}

const formatadorPartes = new Intl.DateTimeFormat("en-US", {
  timeZone: FUSO_HORARIO,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function partes(instante: Date): Record<string, string> {
  const valores: Record<string, string> = {};
  for (const parte of formatadorPartes.formatToParts(instante)) {
    valores[parte.type] = parte.value;
  }
  return valores;
}

function paraDate(instante: Date | string): Date {
  return typeof instante === "string" ? new Date(instante) : instante;
}

/** Dia (AAAA-MM-DD) de um instante, no fuso da loja. */
export function chaveDia(instante: Date | string): string {
  const v = partes(paraDate(instante));
  return `${v.year}-${v.month}-${v.day}`;
}

export function hojeChave(): string {
  return chaveDia(new Date());
}

/** Horário (HH:mm) de um instante, no fuso da loja. */
export function formatarHora(instante: Date | string): string {
  const v = partes(paraDate(instante));
  return `${v.hour}:${v.minute}`;
}

/** "20 de outubro" (com o ano quando não é o ano atual). */
export function formatarDataCurta(instante: Date | string): string {
  const v = partes(paraDate(instante));
  const anoAtual = partes(new Date()).year;
  const base = `${Number(v.day)} de ${nomeDoMes(Number(v.month) - 1).toLowerCase()}`;
  return v.year === anoAtual ? base : `${base} de ${v.year}`;
}

/** "20 de outubro" a partir de uma chave AAAA-MM-DD. */
export function formatarDiaDaChave(dia: string): string {
  const instante = paraInstante(dia, "12:00");
  return formatarDataCurta(instante);
}

/** Diferença, em minutos, entre o fuso da loja e o UTC naquele instante. */
function deslocamentoMinutos(instante: Date): number {
  const v = partes(instante);
  const comoUtc = Date.UTC(
    Number(v.year),
    Number(v.month) - 1,
    Number(v.day),
    Number(v.hour),
    Number(v.minute),
    Number(v.second),
  );
  return Math.round((comoUtc - instante.getTime()) / 60000);
}

/** Converte "dia + horário de São Paulo" no instante real (Date). */
export function paraInstante(dia: string, hora: string): Date {
  const [ano, mes, d] = dia.split("-").map(Number);
  const [h, min] = hora.split(":").map(Number);
  const palpite = Date.UTC(ano, mes - 1, d, h, min);
  const deslocamento = deslocamentoMinutos(new Date(palpite));
  return new Date(palpite - deslocamento * 60000);
}

export type CelulaCalendario = { dia: string; doMes: boolean };

/** 42 células (6 semanas, começando no domingo) para desenhar o mês. */
export function gerarGradeMes(ano: number, mes0: number): CelulaCalendario[] {
  const diaSemanaDoPrimeiro = new Date(Date.UTC(ano, mes0, 1)).getUTCDay();
  const inicio = Date.UTC(ano, mes0, 1 - diaSemanaDoPrimeiro);
  const celulas: CelulaCalendario[] = [];
  for (let i = 0; i < 42; i++) {
    const data = new Date(inicio + i * 86_400_000);
    celulas.push({
      dia: data.toISOString().slice(0, 10),
      doMes: data.getUTCMonth() === mes0,
    });
  }
  return celulas;
}

export function somarMes(
  ano: number,
  mes0: number,
  delta: number,
): { ano: number; mes0: number } {
  const total = ano * 12 + mes0 + delta;
  return { ano: Math.floor(total / 12), mes0: ((total % 12) + 12) % 12 };
}

/** Número do dia (1 a 31) de uma chave AAAA-MM-DD. */
export function numeroDoDia(dia: string): number {
  return Number(dia.slice(8, 10));
}

// ---------------------------------------------------------------------
// Helpers do painel admin (agenda do dia e da semana)
// ---------------------------------------------------------------------

export const NOMES_DIAS_SEMANA = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

/** A string é uma chave AAAA-MM-DD de um dia que existe no calendário? */
export function chaveValida(valor: string | null | undefined): valor is string {
  if (!valor || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const [ano, mes, dia] = valor.split("-").map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  return (
    data.getUTCFullYear() === ano &&
    data.getUTCMonth() === mes - 1 &&
    data.getUTCDate() === dia
  );
}

/** Soma (ou subtrai) dias de uma chave AAAA-MM-DD. */
export function somarDias(chave: string, dias: number): string {
  const [ano, mes, dia] = chave.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia + dias)).toISOString().slice(0, 10);
}

/** Dia da semana de uma chave (0 = domingo). */
export function diaDaSemana(chave: string): number {
  const [ano, mes, dia] = chave.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay();
}

/** Domingo da semana que contém o dia. */
export function inicioDaSemana(chave: string): string {
  return somarDias(chave, -diaDaSemana(chave));
}

/** "terça-feira, 20 de outubro" */
export function formatarDiaCompleto(chave: string): string {
  const [ano, mes, dia] = chave.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(ano, mes - 1, dia, 12)));
}

/** "20/10" */
export function formatarDiaMes(chave: string): string {
  return `${chave.slice(8, 10)}/${chave.slice(5, 7)}`;
}
