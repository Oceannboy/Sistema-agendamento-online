"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Botao } from "@/components/ui/Botao";
import { IconeSeta } from "@/components/ui/Icones";
import {
  cancelarAgendamentoAcao,
  salvarAgendamento,
} from "@/lib/acoes/agendamentos";
import type { EstadoForm } from "@/lib/acoes/tipos";
import {
  chaveDia,
  formatarDiaDaChave,
  formatarHora,
  paraInstante,
  somarMes,
} from "@/lib/datas";
import { criarClienteNavegador } from "@/lib/supabase/client";
import type { Servico } from "@/types";
import { Calendario, type InfoDia } from "./Calendario";
import { SeletorHorario } from "./SeletorHorario";

type LinhaDia = InfoDia & { dia: string };
type LinhaHorario = { inicio: string };

type Props = {
  servicos: Servico[];
  /** Dia de hoje (AAAA-MM-DD) no fuso da loja. */
  hoje: string;
  /** Presente no modo edição. */
  agendamento?: {
    id: string;
    servicoId: string;
    titulo: string;
    inicio: string;
  };
  /** Serviço pré-selecionado (vem do chip de favorito). */
  servicoInicial?: string;
  /** Título pré-preenchido (vem do campo "Adicionar novo horário…"). */
  tituloInicial?: string;
  /** Para onde voltar depois de salvar ou cancelar (padrão: lista de horários). */
  retorno?: "/admin";
};

const formatadorPreco = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

/**
 * Tela 4: criar ou editar um horário.
 * Calendário (dias com ponto) -> horário livre -> tipo de trabalho -> título.
 * Os horários e os pontos vêm das RPCs do banco; quem decide se pode agendar
 * é sempre o banco (a tela só ajuda a escolher).
 */
export function FormAgendamento({
  servicos,
  hoje,
  agendamento,
  servicoInicial,
  tituloInicial,
  retorno,
}: Props) {
  const editando = Boolean(agendamento);
  const supabase = useMemo(() => criarClienteNavegador(), []);

  const diaInicial = agendamento ? chaveDia(agendamento.inicio) : null;
  const baseMes = diaInicial ?? hoje;

  const [servicoId, setServicoId] = useState(
    agendamento?.servicoId ?? servicoInicial ?? servicos[0]?.id ?? "",
  );
  const [titulo, setTitulo] = useState(agendamento?.titulo ?? tituloInicial ?? "");
  const [dia, setDia] = useState<string | null>(diaInicial);
  const [hora, setHora] = useState<string | null>(
    agendamento ? formatarHora(agendamento.inicio) : null,
  );
  const [mes, setMes] = useState({
    ano: Number(baseMes.slice(0, 4)),
    mes0: Number(baseMes.slice(5, 7)) - 1,
  });
  const [calendarioAberto, setCalendarioAberto] = useState(true);
  const [seletorAberto, setSeletorAberto] = useState(false);
  const [confirmandoCancelamento, setConfirmandoCancelamento] = useState(false);

  const [infoDias, setInfoDias] = useState<Record<string, InfoDia>>({});
  const [carregandoDias, setCarregandoDias] = useState(false);
  const [erroDias, setErroDias] = useState(false);

  const [horarios, setHorarios] = useState<string[]>([]);
  const [carregandoHorarios, setCarregandoHorarios] = useState(false);
  const [erroHorarios, setErroHorarios] = useState(false);

  /** Soma 1 para forçar nova busca (erro, conflito de horário). */
  const [recarregar, setRecarregar] = useState(0);

  const [estadoSalvar, acaoSalvar, salvando] = useActionState<EstadoForm, FormData>(
    salvarAgendamento,
    {},
  );
  const [estadoCancelar, acaoCancelar, cancelando] = useActionState<
    EstadoForm,
    FormData
  >(cancelarAgendamentoAcao, {});

  const idAgendamento = agendamento?.id ?? null;
  const servicoAtual = servicos.find((s) => s.id === servicoId);

  // Pontos do calendário: um pedido por mês exibido / serviço.
  useEffect(() => {
    if (!servicoId) return;
    let ignorar = false;
    setCarregandoDias(true);
    setErroDias(false);

    supabase
      .rpc("dias_do_mes", {
        p_ano: mes.ano,
        p_mes: mes.mes0 + 1,
        p_servico: servicoId,
        p_ignorar: idAgendamento,
      })
      .then(({ data, error }) => {
        if (ignorar) return;
        if (error) {
          setErroDias(true);
          setInfoDias({});
        } else {
          const mapa: Record<string, InfoDia> = {};
          for (const linha of (data ?? []) as LinhaDia[]) {
            mapa[linha.dia] = {
              tem_agendamento: linha.tem_agendamento,
              sem_horario: linha.sem_horario,
              loja_fechada: linha.loja_fechada,
            };
          }
          setInfoDias(mapa);
        }
        setCarregandoDias(false);
      });

    return () => {
      ignorar = true;
    };
  }, [supabase, mes.ano, mes.mes0, servicoId, idAgendamento, recarregar]);

  // Horários livres do dia escolhido para o serviço escolhido.
  useEffect(() => {
    if (!dia || !servicoId) {
      setHorarios([]);
      return;
    }
    let ignorar = false;
    setCarregandoHorarios(true);
    setErroHorarios(false);

    supabase
      .rpc("horarios_disponiveis", {
        p_data: dia,
        p_servico: servicoId,
        p_ignorar: idAgendamento,
      })
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
          // se o horário escolhido deixou de estar livre, limpa a escolha
          setHora((atual) => (atual && lista.includes(atual) ? atual : null));
        }
        setCarregandoHorarios(false);
      });

    return () => {
      ignorar = true;
    };
  }, [supabase, dia, servicoId, idAgendamento, recarregar]);

  // Alguém reservou o horário primeiro: limpa a escolha e busca os livres de novo.
  useEffect(() => {
    if (estadoSalvar.conflito) {
      setHora(null);
      setRecarregar((n) => n + 1);
    }
  }, [estadoSalvar]);

  // Cancelamento recusado (ex.: fora do prazo): fecha a confirmação para
  // mostrar a mensagem de erro na tela.
  useEffect(() => {
    if (estadoCancelar.erro) setConfirmandoCancelamento(false);
  }, [estadoCancelar]);

  const base = Number(hoje.slice(0, 4)) * 12 + Number(hoje.slice(5, 7)) - 1;
  const exibido = mes.ano * 12 + mes.mes0;
  const podeVoltar = exibido > base;
  const podeAvancar = exibido - base < 12;

  function mudarMes(delta: -1 | 1) {
    setMes((atual) => somarMes(atual.ano, atual.mes0, delta));
  }

  function selecionarDia(novo: string) {
    if (novo !== dia) {
      setDia(novo);
      setHora(null);
    }
  }

  const inicioISO =
    dia && hora ? paraInstante(dia, hora).toISOString() : "";
  const completo = Boolean(inicioISO && servicoId);

  const rotulo = "text-base text-texto";
  const erroGeral = estadoSalvar.erro ?? estadoCancelar.erro;

  return (
    <div className="flex min-h-dvh flex-col bg-fundo">
      {/* barra de título */}
      <header className="bg-roxo-escuro px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[0.9rem] text-center text-white">
        <h1 className="inline-block border-b-2 border-white pb-0.5 text-sm">
          {editando ? "Editar horário:" : "Novo horário:"}
        </h1>
      </header>

      <Calendario
        ano={mes.ano}
        mes0={mes.mes0}
        hoje={hoje}
        diaSelecionado={dia}
        info={infoDias}
        carregando={carregandoDias}
        erro={erroDias}
        aberto={calendarioAberto}
        podeVoltar={podeVoltar}
        podeAvancar={podeAvancar}
        aoAlternar={() => setCalendarioAberto((v) => !v)}
        aoMudarMes={mudarMes}
        aoSelecionar={selecionarDia}
        aoRecarregar={() => setRecarregar((n) => n + 1)}
      />

      <form
        action={acaoSalvar}
        className="flex flex-1 flex-col gap-[1.1rem] px-[1.8rem] pt-[1.3rem] pb-[8rem]"
      >
        <input type="hidden" name="id" value={agendamento?.id ?? ""} />
        <input type="hidden" name="retorno" value={retorno ?? ""} />
        <input type="hidden" name="servico" value={servicoId} />
        <input type="hidden" name="inicio" value={inicioISO} />

        <div className="grid grid-cols-[4.6rem_1fr] items-start gap-x-[1.3rem]">
          <div>
            <p id="rotulo-horario" className={`${rotulo} mb-1`}>
              Horário:
            </p>
            <button
              type="button"
              onClick={() => setSeletorAberto(true)}
              aria-haspopup="dialog"
              aria-labelledby="rotulo-horario valor-horario"
              className={`alvo-toque flex w-full items-center justify-center rounded-xl border-2 border-texto bg-white text-base ${
                hora ? "text-texto" : "text-texto-suave"
              }`}
            >
              <span id="valor-horario">{hora ?? "0:00"}</span>
            </button>
          </div>

          <div>
            <label htmlFor="tipo-trabalho" className={`${rotulo} mb-1 block`}>
              Tipo de Trabalho
            </label>
            <div className="relative">
              <select
                id="tipo-trabalho"
                value={servicoId}
                onChange={(evento) => setServicoId(evento.target.value)}
                className="alvo-toque w-full appearance-none rounded-xl border-2 border-texto bg-white pr-10 pl-3 text-sm text-texto"
              >
                {servicos.map((servico) => (
                  <option key={servico.id} value={servico.id}>
                    {servico.nome}
                  </option>
                ))}
              </select>
              <IconeSeta className="pointer-events-none absolute top-1/2 right-3 size-[1.3rem] -translate-y-1/2 text-texto" />
            </div>
            {servicoAtual ? (
              <p className="mt-1 text-xs text-texto-suave">
                {servicoAtual.duracao_min} min ·{" "}
                {formatadorPreco.format(servicoAtual.preco)}
              </p>
            ) : null}
          </div>
        </div>

        <div className="w-full max-w-[19rem]">
          <label htmlFor="titulo" className={`${rotulo} mb-1 block`}>
            Título
          </label>
          <input
            id="titulo"
            name="titulo"
            type="text"
            maxLength={60}
            autoComplete="off"
            value={titulo}
            onChange={(evento) => setTitulo(evento.target.value)}
            placeholder={'Exemplo: "Horário 1"….'}
            className="alvo-toque w-full rounded-xl border-2 border-texto bg-white px-4 text-base text-texto placeholder:text-texto-suave"
          />
        </div>

        <div aria-live="polite" className="min-h-5">
          {erroGeral ? (
            <p role="alert" className="text-sm text-ponto-vermelho">
              {erroGeral}
            </p>
          ) : !completo ? (
            <p className="text-xs text-texto-suave">
              {!dia
                ? "Escolha o dia no calendário e depois o horário."
                : "Escolha o horário para poder salvar."}
            </p>
          ) : null}
        </div>

        {/* Botões adicionados ao design (o layout original não tem salvar/cancelar) */}
        <div className="flex flex-wrap items-center gap-3">
          <Botao
            type="submit"
            variante="gradiente"
            disabled={!completo || salvando}
            className="w-[8.3rem]"
          >
            {salvando ? "Salvando…" : "Salvar"}
          </Botao>

          {editando ? (
            <button
              type="button"
              onClick={() => setConfirmandoCancelamento(true)}
              className="alvo-toque rounded-xl border-2 border-texto px-4 text-sm text-texto"
            >
              Cancelar agendamento
            </button>
          ) : null}
        </div>
      </form>

      {editando && confirmandoCancelamento ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center">
          <button
            type="button"
            tabIndex={-1}
            aria-label="Voltar sem cancelar"
            onClick={() => setConfirmandoCancelamento(false)}
            className="absolute inset-0 bg-black/30"
          />
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="titulo-cancelar"
            className="relative w-full max-w-[430px] rounded-t-2xl bg-white px-[1.5rem] pt-[1.4rem] pb-[max(1.4rem,env(safe-area-inset-bottom))]"
          >
            <h2 id="titulo-cancelar" className="text-base text-texto">
              Cancelar este horário?
            </h2>
            <p className="mt-1 text-sm text-texto">
              O horário volta a ficar livre para outras pessoas. Essa ação não
              pode ser desfeita.
            </p>
            <form action={acaoCancelar} className="mt-4 flex gap-3">
              <input type="hidden" name="id" value={agendamento?.id ?? ""} />
              <input type="hidden" name="retorno" value={retorno ?? ""} />
              <Botao
                type="submit"
                variante="gradiente"
                disabled={cancelando}
                className="flex-1"
              >
                {cancelando ? "Cancelando…" : "Sim, cancelar"}
              </Botao>
              <button
                type="button"
                onClick={() => setConfirmandoCancelamento(false)}
                className="alvo-toque flex-1 rounded-xl border-2 border-texto text-sm text-texto"
              >
                Voltar
              </button>
            </form>
          </section>
        </div>
      ) : null}

      <SeletorHorario
        aberto={seletorAberto}
        aoFechar={() => setSeletorAberto(false)}
        diaTexto={dia ? formatarDiaDaChave(dia) : null}
        horarios={horarios}
        carregando={carregandoHorarios}
        erro={erroHorarios}
        selecionado={hora}
        aoEscolher={(escolhida) => {
          setHora(escolhida);
          setSeletorAberto(false);
        }}
        aoRecarregar={() => setRecarregar((n) => n + 1)}
      />
    </div>
  );
}
