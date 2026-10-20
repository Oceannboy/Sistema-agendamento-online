"use client";

import { useActionState, useState } from "react";
import { Botao } from "@/components/ui/Botao";
import { Cartao } from "@/components/ui/Cartao";
import { CampoClaro } from "@/components/ui/CampoClaro";
import { criarBloqueio } from "@/lib/acoes/admin";
import type { EstadoForm } from "@/lib/acoes/tipos";

/** Novo bloqueio: feriado, folga ou imprevisto (dia(s) inteiro(s) ou com horário). */
export function FormBloqueio({ hoje }: { hoje: string }) {
  const [estado, acao, pendente] = useActionState<EstadoForm, FormData>(
    criarBloqueio,
    {},
  );
  const [diaInteiro, setDiaInteiro] = useState(true);
  const valores = estado.valores ?? {};
  const erros = estado.erros ?? {};

  return (
    <Cartao>
      <h2 className="text-base font-semibold">Novo bloqueio</h2>
      <form action={acao} className="mt-3 flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <CampoClaro
            id="dataInicio"
            rotulo="De:"
            type="date"
            min={hoje}
            required
            defaultValue={valores.dataInicio ?? hoje}
            erro={erros.dataInicio}
          />
          <CampoClaro
            id="dataFim"
            rotulo="Até:"
            type="date"
            min={hoje}
            required
            defaultValue={valores.dataFim ?? hoje}
            erro={erros.dataFim}
          />
        </div>

        <label className="alvo-toque flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            name="diaInteiro"
            checked={diaInteiro}
            onChange={(e) => setDiaInteiro(e.target.checked)}
            className="size-5"
          />
          Dia(s) inteiro(s)
        </label>

        {!diaInteiro ? (
          <div className="grid grid-cols-2 gap-3">
            <CampoClaro
              id="horaInicio"
              rotulo="Hora inicial:"
              type="time"
              required
              defaultValue={valores.horaInicio ?? ""}
              erro={erros.horaInicio}
            />
            <CampoClaro
              id="horaFim"
              rotulo="Hora final:"
              type="time"
              required
              defaultValue={valores.horaFim ?? ""}
              erro={erros.horaFim}
            />
          </div>
        ) : null}

        <CampoClaro
          id="motivo"
          rotulo="Motivo (opcional):"
          type="text"
          maxLength={80}
          placeholder="Ex.: feriado, folga, curso"
          defaultValue={valores.motivo ?? ""}
          erro={erros.motivo}
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
          {pendente ? "Criando…" : "Criar bloqueio"}
        </Botao>
      </form>
    </Cartao>
  );
}
