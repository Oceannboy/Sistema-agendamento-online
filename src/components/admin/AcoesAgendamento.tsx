"use client";

import Link from "next/link";
import { useActionState } from "react";
import { alterarStatusAgendamento } from "@/lib/acoes/admin";
import type { EstadoForm } from "@/lib/acoes/tipos";
import type { StatusAgendamento } from "@/types";

const ACOES: Record<
  StatusAgendamento,
  { rotulo: string; status: StatusAgendamento; principal?: boolean }[]
> = {
  pendente: [
    { rotulo: "Confirmar", status: "confirmado", principal: true },
    { rotulo: "Cancelar", status: "cancelado" },
  ],
  confirmado: [
    { rotulo: "Concluir", status: "concluido", principal: true },
    { rotulo: "Cancelar", status: "cancelado" },
  ],
  concluido: [{ rotulo: "Reabrir", status: "confirmado" }],
  cancelado: [{ rotulo: "Reativar", status: "confirmado" }],
};

/**
 * Botões de um agendamento na agenda do admin. Um só formulário: o botão
 * clicado envia o novo status. "Remarcar" abre a tela 4 (o admin pode
 * remarcar qualquer agendamento futuro).
 */
export function AcoesAgendamento({
  id,
  status,
  podeRemarcar,
}: {
  id: string;
  status: StatusAgendamento;
  podeRemarcar: boolean;
}) {
  const [estado, executar, pendente] = useActionState<EstadoForm, FormData>(
    alterarStatusAgendamento,
    {},
  );

  return (
    <div className="mt-3">
      <form action={executar} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="id" value={id} />
        {ACOES[status].map((acao) => (
          <button
            key={acao.status + acao.rotulo}
            type="submit"
            name="status"
            value={acao.status}
            disabled={pendente}
            className={`alvo-toque rounded-xl px-3 text-xs disabled:opacity-60 ${
              acao.principal
                ? "bg-gradiente-botao text-white"
                : "border-2 border-texto text-texto"
            }`}
          >
            {acao.rotulo}
          </button>
        ))}
        {podeRemarcar ? (
          <Link
            href={`/agenda/${id}?retorno=admin`}
            className="alvo-toque flex items-center rounded-xl border-2 border-texto px-3 text-xs text-texto"
          >
            Remarcar
          </Link>
        ) : null}
      </form>
      {estado.erro ? (
        <p role="alert" className="mt-1 text-xs text-ponto-vermelho">
          {estado.erro}
        </p>
      ) : null}
    </div>
  );
}
