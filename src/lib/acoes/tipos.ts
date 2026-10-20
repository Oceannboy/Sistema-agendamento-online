/** Estado devolvido pelas Server Actions de formulário (useActionState). */
export type EstadoForm = {
  /** Erro geral do formulário. */
  erro?: string;
  /** Mensagem de sucesso. */
  sucesso?: string;
  /** Valores digitados, para repovoar o formulário (nunca inclui senha). */
  valores?: Record<string, string>;
  /** Erros por campo (chave = name do input). */
  erros?: Record<string, string>;
  /** O horário escolhido foi ocupado por outra pessoa (recarregar os livres). */
  conflito?: boolean;
};
