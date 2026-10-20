"use client";

import { useActionState } from "react";
import { Botao } from "@/components/ui/Botao";
import { Cartao } from "@/components/ui/Cartao";
import { CampoClaro } from "@/components/ui/CampoClaro";
import { salvarConfiguracoes } from "@/lib/acoes/admin";
import type { EstadoForm } from "@/lib/acoes/tipos";
import type { Configuracoes } from "@/types";

/** Regras: antecedência mínima, prazo de cancelamento e intervalo entre horários. */
export function FormConfiguracoes({ configuracoes }: { configuracoes: Configuracoes }) {
  const [estado, acao, pendente] = useActionState<EstadoForm, FormData>(
    salvarConfiguracoes,
    {},
  );
  const valores = estado.valores ?? {};
  const erros = estado.erros ?? {};

  return (
    <Cartao>
      <h2 className="text-base font-semibold">Regras de agendamento</h2>
      <form action={acao} className="mt-3 flex flex-col gap-3">
        <CampoClaro
          id="antecedencia"
          rotulo="Antecedência mínima para agendar (minutos):"
          type="number"
          inputMode="numeric"
          min={0}
          max={10080}
          required
          defaultValue={valores.antecedencia ?? String(configuracoes.antecedencia_min_minutos)}
          erro={erros.antecedencia}
          ajuda="Ex.: 120 = a cliente só agenda com 2 horas de folga."
        />
        <CampoClaro
          id="prazo"
          rotulo="Prazo para cancelar ou remarcar (horas):"
          type="number"
          inputMode="numeric"
          min={0}
          max={720}
          required
          defaultValue={valores.prazo ?? String(configuracoes.prazo_cancelamento_horas)}
          erro={erros.prazo}
          ajuda="Dentro desse prazo a cliente precisa falar com a loja."
        />
        <CampoClaro
          id="intervalo"
          rotulo="Intervalo entre os horários (minutos):"
          type="number"
          inputMode="numeric"
          min={5}
          max={120}
          required
          defaultValue={valores.intervalo ?? String(configuracoes.intervalo_min)}
          erro={erros.intervalo}
          ajuda="Ex.: 30 = horários às 09:00, 09:30, 10:00…"
        />

        <div aria-live="polite" className="min-h-5">
          {estado.erro ? (
            <p role="alert" className="text-sm text-ponto-vermelho">
              {estado.erro}
            </p>
          ) : estado.sucesso ? (
            <p role="status" className="text-sm text-[#1c6137]">
              {estado.sucesso}
            </p>
          ) : null}
        </div>

        <Botao type="submit" variante="gradiente" disabled={pendente} className="self-start">
          {pendente ? "Salvando…" : "Salvar regras"}
        </Botao>
      </form>
    </Cartao>
  );
}
