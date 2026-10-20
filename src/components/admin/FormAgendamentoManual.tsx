"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Botao } from "@/components/ui/Botao";
import { CampoClaro, CLASSE_CAMPO_CLARO } from "@/components/ui/CampoClaro";
import { adminCriarAgendamento } from "@/lib/acoes/admin";
import type { EstadoForm } from "@/lib/acoes/tipos";
import { formatarHora, paraInstante } from "@/lib/datas";
import { criarClienteNavegador } from "@/lib/supabase/client";
import type { ClienteResumo, Servico } from "@/types";

type LinhaHorario = { inicio: string };

/**
 * Agendamento manual (a dona marca para quem chamou no WhatsApp).
 * Os horários livres vêm da mesma RPC da cliente (para admin ela não aplica
 * a antecedência mínima). Também dá para digitar um horário fora da grade
 * (ex.: 10:15): o banco aceita para admin, mas continua exigindo expediente,
 * sem bloqueio e sem conflito.
 */
export function FormAgendamentoManual({
  servicos,
  clientes,
  hoje,
  dataInicial,
}: {
  servicos: Servico[];
  clientes: ClienteResumo[];
  hoje: string;
  dataInicial: string;
}) {
  const supabase = useMemo(() => criarClienteNavegador(), []);
  const [estado, acao, pendente] = useActionState<EstadoForm, FormData>(
    adminCriarAgendamento,
    {},
  );

  const [tipo, setTipo] = useState<"conta" | "avulso">(
    clientes.length > 0 ? "conta" : "avulso",
  );
  const [servicoId, setServicoId] = useState(servicos[0]?.id ?? "");
  const [dia, setDia] = useState(dataInicial);
  const [horaEscolhida, setHoraEscolhida] = useState("");
  const [horaDigitada, setHoraDigitada] = useState("");
  const [horarios, setHorarios] = useState<string[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erroHorarios, setErroHorarios] = useState(false);
  const [recarregar, setRecarregar] = useState(0);

  useEffect(() => {
    if (!dia || !servicoId) {
      setHorarios([]);
      return;
    }
    let ignorar = false;
    setCarregando(true);
    setErroHorarios(false);

    supabase
      .rpc("horarios_disponiveis", { p_data: dia, p_servico: servicoId })
      .then(({ data, error }) => {
        if (ignorar) return;
        if (error) {
          setErroHorarios(true);
          setHorarios([]);
        } else {
          const lista = ((data ?? []) as LinhaHorario[])
            .map((linha) => formatarHora(linha.inicio))
            .sort();
          setHorarios(lista);
          setHoraEscolhida((atual) => (lista.includes(atual) ? atual : ""));
        }
        setCarregando(false);
      });

    return () => {
      ignorar = true;
    };
  }, [supabase, dia, servicoId, recarregar]);

  // se a gravação falhou por conflito, os horários livres mudaram
  useEffect(() => {
    if (estado.erro) setRecarregar((n) => n + 1);
  }, [estado]);

  const horaFinal = horaDigitada || horaEscolhida;
  const inicioISO = dia && horaFinal ? paraInstante(dia, horaFinal).toISOString() : "";
  const erros = estado.erros ?? {};
  const valores = estado.valores ?? {};

  return (
    <form action={acao} className="flex flex-col gap-4">
      <input type="hidden" name="inicio" value={inicioISO} />

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm text-texto">Cliente</legend>
        <div className="flex gap-4 text-sm text-texto">
          <label className="alvo-toque flex items-center gap-2">
            <input
              type="radio"
              name="tipo"
              value="conta"
              checked={tipo === "conta"}
              onChange={() => setTipo("conta")}
              disabled={clientes.length === 0}
            />
            Com conta
          </label>
          <label className="alvo-toque flex items-center gap-2">
            <input
              type="radio"
              name="tipo"
              value="avulso"
              checked={tipo === "avulso"}
              onChange={() => setTipo("avulso")}
            />
            Sem conta (WhatsApp)
          </label>
        </div>

        {tipo === "conta" ? (
          <div>
            <label htmlFor="cliente" className="mb-1 block text-sm text-texto">
              Escolha a cliente:
            </label>
            <select
              id="cliente"
              name="cliente"
              defaultValue=""
              required
              aria-invalid={erros.cliente ? true : undefined}
              className={CLASSE_CAMPO_CLARO}
            >
              <option value="" disabled>
                Selecione…
              </option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome || c.usuario} ({c.usuario})
                </option>
              ))}
            </select>
            {erros.cliente ? (
              <p role="alert" className="mt-1 text-xs text-ponto-vermelho">
                {erros.cliente}
              </p>
            ) : null}
          </div>
        ) : (
          <>
            <CampoClaro
              id="nome"
              rotulo="Nome:"
              type="text"
              required
              maxLength={80}
              defaultValue={valores.nome ?? ""}
              erro={erros.nome}
            />
            <CampoClaro
              id="telefone"
              rotulo="Telefone (WhatsApp):"
              type="tel"
              inputMode="tel"
              maxLength={20}
              placeholder="(00) 00000-0000"
              defaultValue={valores.telefone ?? ""}
              erro={erros.telefone}
            />
          </>
        )}
      </fieldset>

      <div>
        <label htmlFor="servico" className="mb-1 block text-sm text-texto">
          Tipo de trabalho:
        </label>
        <select
          id="servico"
          name="servico"
          value={servicoId}
          onChange={(e) => setServicoId(e.target.value)}
          className={CLASSE_CAMPO_CLARO}
        >
          {servicos.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nome} ({s.duracao_min} min)
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="dia-manual" className="mb-1 block text-sm text-texto">
          Dia:
        </label>
        <input
          id="dia-manual"
          type="date"
          min={hoje}
          value={dia}
          required
          onChange={(e) => {
            setDia(e.target.value);
            setHoraEscolhida("");
          }}
          className={CLASSE_CAMPO_CLARO}
        />
      </div>

      <div>
        <p id="rotulo-horarios" className="mb-1 text-sm text-texto">
          Horários livres:
        </p>
        {carregando ? (
          <p role="status" className="text-xs text-texto-suave">
            Carregando…
          </p>
        ) : erroHorarios ? (
          <p role="alert" className="text-xs text-ponto-vermelho">
            Não foi possível carregar os horários.{" "}
            <button type="button" onClick={() => setRecarregar((n) => n + 1)} className="underline">
              Tentar de novo
            </button>
          </p>
        ) : horarios.length === 0 ? (
          <p className="text-xs text-texto-suave">
            Sem horários livres nesse dia para esse serviço. Você ainda pode digitar
            um horário abaixo.
          </p>
        ) : (
          <ul aria-labelledby="rotulo-horarios" className="grid grid-cols-4 gap-2">
            {horarios.map((hora) => (
              <li key={hora}>
                <button
                  type="button"
                  aria-pressed={hora === horaEscolhida && !horaDigitada}
                  onClick={() => {
                    setHoraEscolhida(hora);
                    setHoraDigitada("");
                  }}
                  className={`alvo-toque w-full rounded-xl border-2 border-texto text-sm ${
                    hora === horaEscolhida && !horaDigitada
                      ? "bg-gradiente-botao border-transparent text-white"
                      : "text-texto"
                  }`}
                >
                  {hora}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <label htmlFor="hora-digitada" className="mb-1 block text-sm text-texto">
          Ou digite outro horário:
        </label>
        <input
          id="hora-digitada"
          type="time"
          value={horaDigitada}
          onChange={(e) => {
            setHoraDigitada(e.target.value);
            if (e.target.value) setHoraEscolhida("");
          }}
          className={CLASSE_CAMPO_CLARO}
        />
      </div>

      <CampoClaro
        id="titulo"
        rotulo="Título (opcional):"
        type="text"
        maxLength={60}
        autoComplete="off"
        placeholder={'Exemplo: "Horário 1"….'}
        defaultValue={valores.titulo ?? ""}
        erro={erros.titulo}
      />

      <div aria-live="polite" className="min-h-5">
        {estado.erro ? (
          <p role="alert" className="text-sm text-ponto-vermelho">
            {estado.erro}
          </p>
        ) : !inicioISO ? (
          <p className="text-xs text-texto-suave">
            Escolha o dia e o horário para poder agendar.
          </p>
        ) : null}
      </div>

      <Botao type="submit" variante="gradiente" disabled={!inicioISO || pendente} className="self-start">
        {pendente ? "Agendando…" : "Agendar"}
      </Botao>
    </form>
  );
}
