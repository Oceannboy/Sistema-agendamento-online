"use client";

import { useActionState } from "react";
import { Botao } from "@/components/ui/Botao";
import { Cartao } from "@/components/ui/Cartao";
import { adicionarFaixa, removerFaixa } from "@/lib/acoes/admin";
import type { EstadoForm } from "@/lib/acoes/tipos";
import { NOMES_DIAS_SEMANA } from "@/lib/datas";
import type { FaixaHorario } from "@/types";
import { FormAcaoSimples } from "./FormAcaoSimples";

/** Segunda a domingo (o banco usa 0 = domingo). */
const ORDEM_DIAS = [1, 2, 3, 4, 5, 6, 0];

/** Horário de funcionamento por dia da semana. Dia sem faixa = fechado. */
export function EditorHorarios({ faixas }: { faixas: FaixaHorario[] }) {
  return (
    <ul className="flex flex-col gap-4">
      {ORDEM_DIAS.map((dia) => (
        <DiaDaSemana
          key={dia}
          dia={dia}
          faixas={faixas.filter((f) => f.dia_semana === dia)}
        />
      ))}
    </ul>
  );
}

function DiaDaSemana({ dia, faixas }: { dia: number; faixas: FaixaHorario[] }) {
  const [estado, acao, pendente] = useActionState<EstadoForm, FormData>(
    adicionarFaixa,
    {},
  );
  const nome = NOMES_DIAS_SEMANA[dia];

  return (
    <li>
      <Cartao>
        <h2 className="text-base font-semibold">{nome}</h2>

        {faixas.length === 0 ? (
          <p className="mt-1 text-sm text-texto-suave">Fechado</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {faixas.map((faixa) => (
              <li key={faixa.id} className="flex items-center justify-between gap-3 text-sm">
                <span>
                  {faixa.abre} às {faixa.fecha}
                </span>
                <FormAcaoSimples
                  acao={removerFaixa}
                  campos={{ id: faixa.id }}
                  rotulo="Remover"
                  rotuloPendente="Removendo…"
                  confirmar={`Remover a faixa ${faixa.abre} às ${faixa.fecha} de ${nome}?`}
                />
              </li>
            ))}
          </ul>
        )}

        <form action={acao} className="mt-3 flex flex-wrap items-end gap-2">
          <input type="hidden" name="dia" value={dia} />
          <div>
            <label htmlFor={`abre-${dia}`} className="mb-1 block text-xs">
              Abre
            </label>
            <input
              id={`abre-${dia}`}
              name="abre"
              type="time"
              required
              className="alvo-toque rounded-xl border-2 border-texto bg-white px-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor={`fecha-${dia}`} className="mb-1 block text-xs">
              Fecha
            </label>
            <input
              id={`fecha-${dia}`}
              name="fecha"
              type="time"
              required
              className="alvo-toque rounded-xl border-2 border-texto bg-white px-2 text-sm"
            />
          </div>
          <Botao type="submit" variante="gradiente" disabled={pendente} className="px-4 text-xs">
            {pendente ? "Adicionando…" : "Adicionar faixa"}
          </Botao>
        </form>

        <div aria-live="polite">
          {estado.erro ? (
            <p role="alert" className="mt-2 text-xs text-ponto-vermelho">
              {estado.erro}
            </p>
          ) : null}
        </div>
      </Cartao>
    </li>
  );
}
