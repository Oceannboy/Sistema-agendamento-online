"use client";

import { useActionState } from "react";
import { Botao } from "@/components/ui/Botao";
import { CampoClaro, CLASSE_CAMPO_CLARO } from "@/components/ui/CampoClaro";
import { salvarServico } from "@/lib/acoes/admin";
import type { EstadoForm } from "@/lib/acoes/tipos";
import type { ServicoAdmin } from "@/types";
import { FotoServico } from "./FotoServico";

/** Criar ou editar um serviço (nome, descrição, preço, duração, ativo e foto). */
export function FormServico({
  servico,
  recemCriado = false,
}: {
  servico?: ServicoAdmin;
  recemCriado?: boolean;
}) {
  const [estado, acao, pendente] = useActionState<EstadoForm, FormData>(
    salvarServico,
    {},
  );
  const valores = estado.valores ?? {};
  const erros = estado.erros ?? {};

  const precoInicial =
    valores.preco ??
    (servico ? servico.preco.toFixed(2).replace(".", ",") : "");

  return (
    <div className="flex flex-col gap-5">
      {recemCriado ? (
        <p role="status" className="rounded-xl bg-[#d9f2e1] px-4 py-3 text-sm text-[#1c6137]">
          Serviço criado! Se quiser, adicione uma foto abaixo.
        </p>
      ) : null}

      {servico ? (
        <FotoServico servicoId={servico.id} fotoUrl={servico.foto_url} nome={servico.nome} />
      ) : (
        <p className="text-xs text-texto-suave">
          A foto pode ser adicionada depois de criar o serviço.
        </p>
      )}

      <form action={acao} className="flex flex-col gap-4">
        {servico ? <input type="hidden" name="id" value={servico.id} /> : null}

        <CampoClaro
          id="nome"
          rotulo="Nome:"
          type="text"
          required
          maxLength={60}
          defaultValue={valores.nome ?? servico?.nome ?? ""}
          erro={erros.nome}
        />

        <div>
          <label htmlFor="descricao" className="mb-1 block text-sm text-texto">
            Descrição (opcional):
          </label>
          <textarea
            id="descricao"
            name="descricao"
            rows={3}
            maxLength={300}
            defaultValue={valores.descricao ?? servico?.descricao ?? ""}
            aria-invalid={erros.descricao ? true : undefined}
            className={`${CLASSE_CAMPO_CLARO} py-2`}
          />
          {erros.descricao ? (
            <p role="alert" className="mt-1 text-xs text-ponto-vermelho">
              {erros.descricao}
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <CampoClaro
            id="preco"
            rotulo="Preço (R$):"
            type="text"
            inputMode="decimal"
            required
            placeholder="40,00"
            defaultValue={precoInicial}
            erro={erros.preco}
          />
          <CampoClaro
            id="duracao"
            rotulo="Duração (min):"
            type="number"
            inputMode="numeric"
            min={5}
            max={480}
            step={5}
            required
            defaultValue={valores.duracao ?? (servico ? String(servico.duracao_min) : "")}
            erro={erros.duracao}
          />
        </div>

        <p className="-mt-1 text-xs text-texto-suave">
          Mudar a duração vale para os próximos agendamentos; os que já existem
          mantêm o horário de término.
        </p>

        <label className="alvo-toque flex items-center gap-3 text-sm text-texto">
          <input
            type="checkbox"
            name="ativo"
            defaultChecked={servico ? servico.ativo : true}
            className="size-5"
          />
          Serviço ativo (aparece para as clientes agendarem)
        </label>

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
          {pendente ? "Salvando…" : servico ? "Salvar alterações" : "Criar serviço"}
        </Botao>
      </form>
    </div>
  );
}
