"use client";

import { useActionState } from "react";
import type { EstadoForm } from "@/lib/acoes/tipos";

type Acao = (estado: EstadoForm, formData: FormData) => Promise<EstadoForm>;

/**
 * Botão que executa uma Server Action com campos escondidos (ex.: remover,
 * ativar/desativar), mostrando o erro logo abaixo se a ação falhar.
 */
export function FormAcaoSimples({
  acao,
  campos,
  rotulo,
  rotuloPendente = "Aguarde…",
  confirmar,
  className = "alvo-toque rounded-xl border-2 border-texto px-3 text-xs text-texto disabled:opacity-60",
}: {
  acao: Acao;
  campos: Record<string, string>;
  rotulo: string;
  rotuloPendente?: string;
  /** Se informado, pergunta antes de executar. */
  confirmar?: string;
  className?: string;
}) {
  const [estado, executar, pendente] = useActionState<EstadoForm, FormData>(
    acao,
    {},
  );

  return (
    <form
      action={executar}
      onSubmit={(evento) => {
        if (confirmar && !window.confirm(confirmar)) evento.preventDefault();
      }}
      className="inline-block"
    >
      {Object.entries(campos).map(([nome, valor]) => (
        <input key={nome} type="hidden" name={nome} value={valor} />
      ))}
      <button type="submit" disabled={pendente} className={className}>
        {pendente ? rotuloPendente : rotulo}
      </button>
      {estado.erro ? (
        <p role="alert" className="mt-1 max-w-[14rem] text-xs text-ponto-vermelho">
          {estado.erro}
        </p>
      ) : null}
    </form>
  );
}
