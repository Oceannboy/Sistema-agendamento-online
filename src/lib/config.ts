/**
 * Configurações gerais do app.
 * NEXT_PUBLIC_NOME_EMPRESA precisa ser lida literalmente para o Next.js
 * embuti-la no código do navegador.
 */
export const NOME_EMPRESA =
  (process.env.NEXT_PUBLIC_NOME_EMPRESA ?? "").trim() || "sua empresa";

/** Fuso de todos os cálculos e exibições de data/hora. */
export const FUSO_HORARIO = "America/Sao_Paulo";
