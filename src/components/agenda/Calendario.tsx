"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  IconeChevron,
  IconeMenu,
  IconeSetaDireita,
  IconeSetaEsquerda,
} from "@/components/ui/Icones";
import { sair } from "@/lib/acoes/auth";
import {
  DIAS_SEMANA,
  formatarDiaDaChave,
  gerarGradeMes,
  nomeDoMes,
  numeroDoDia,
} from "@/lib/datas";

export type InfoDia = {
  tem_agendamento: boolean;
  sem_horario: boolean;
  loja_fechada: boolean;
};

type Props = {
  ano: number;
  mes0: number;
  hoje: string;
  diaSelecionado: string | null;
  info: Record<string, InfoDia>;
  carregando: boolean;
  erro: boolean;
  aberto: boolean;
  podeVoltar: boolean;
  podeAvancar: boolean;
  aoAlternar: () => void;
  aoMudarMes: (delta: -1 | 1) => void;
  aoSelecionar: (dia: string) => void;
  aoRecarregar: () => void;
};

/**
 * Cabeçalho "Ano / Mês" + calendário mensal DOM-SAB (tela 4).
 * Pontos sob os dias: vermelho = a usuária já tem agendamento nesse dia;
 * cinza = dia sem horários livres (cheio ou bloqueado).
 * O chevron recolhe e expande o calendário.
 */
export function Calendario({
  ano,
  mes0,
  hoje,
  diaSelecionado,
  info,
  carregando,
  erro,
  aberto,
  podeVoltar,
  podeAvancar,
  aoAlternar,
  aoMudarMes,
  aoSelecionar,
  aoRecarregar,
}: Props) {
  const [menuAberto, setMenuAberto] = useState(false);
  const grade = useMemo(() => gerarGradeMes(ano, mes0), [ano, mes0]);

  return (
    <div>
      {/* cabeçalho roxo médio */}
      <div className="bg-roxo-medio relative flex items-center gap-1 px-[0.5rem] py-[0.55rem] text-white">
        <button
          type="button"
          onClick={() => setMenuAberto((v) => !v)}
          aria-label="Menu"
          aria-haspopup="menu"
          aria-expanded={menuAberto}
          className="grid size-11 shrink-0 place-items-center"
        >
          <IconeMenu className="size-[1.6rem]" />
        </button>

        <div className="ml-1 leading-tight">
          <p className="text-xs">{ano}</p>
          <p className="text-[1.5rem] leading-none" aria-live="polite">
            {nomeDoMes(mes0)}
          </p>
        </div>

        <button
          type="button"
          onClick={aoAlternar}
          aria-expanded={aberto}
          aria-controls="grade-calendario"
          aria-label={aberto ? "Recolher calendário" : "Expandir calendário"}
          className="grid size-11 shrink-0 place-items-center"
        >
          <span className="bg-avatar grid size-[1.9rem] place-items-center rounded-full">
            <IconeChevron
              className={`size-[1.1rem] transition-transform duration-200 ${aberto ? "" : "rotate-180"}`}
            />
          </span>
        </button>

        <div className="ml-auto flex">
          <button
            type="button"
            onClick={() => aoMudarMes(-1)}
            disabled={!podeVoltar}
            aria-label="Mês anterior"
            className="grid size-11 place-items-center disabled:opacity-35"
          >
            <IconeSetaEsquerda className="size-[1.3rem]" />
          </button>
          <button
            type="button"
            onClick={() => aoMudarMes(1)}
            disabled={!podeAvancar}
            aria-label="Próximo mês"
            className="grid size-11 place-items-center disabled:opacity-35"
          >
            <IconeSetaDireita className="size-[1.3rem]" />
          </button>
        </div>

        {menuAberto ? (
          <>
            <button
              type="button"
              tabIndex={-1}
              aria-label="Fechar menu"
              className="fixed inset-0 z-10 cursor-default"
              onClick={() => setMenuAberto(false)}
            />
            <ul
              role="menu"
              className="absolute top-full left-[0.5rem] z-20 w-[13rem] overflow-hidden rounded-xl bg-white py-1 text-sm text-texto shadow-[0_8px_24px_rgba(0,0,0,0.25)]"
            >
              <li role="none">
                <Link
                  role="menuitem"
                  href="/agenda"
                  className="alvo-toque flex items-center px-4"
                >
                  Horários marcados
                </Link>
              </li>
              <li role="none">
                <form action={sair}>
                  <button
                    role="menuitem"
                    type="submit"
                    className="alvo-toque flex w-full items-center px-4 text-left"
                  >
                    Sair
                  </button>
                </form>
              </li>
            </ul>
          </>
        ) : null}
      </div>

      {/* grade do mês (recolhe com animação de altura) */}
      <div
        id="grade-calendario"
        inert={!aberto}
        className={`grid bg-white transition-[grid-template-rows] duration-200 ${aberto ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
      >
        <div className="overflow-hidden">
          <div className="grid grid-cols-7 px-1 pt-[0.9rem] pb-1 text-center text-xs font-semibold text-[#333333]">
            {DIAS_SEMANA.map((nome) => (
              <span key={nome}>{nome}</span>
            ))}
          </div>

          <div
            className={`grid grid-cols-7 px-1 pb-3 text-center transition-opacity ${carregando ? "opacity-60" : ""}`}
          >
            {grade.map(({ dia, doMes }) => {
              const dados = info[dia];
              const passado = dia < hoje;
              const fechado = Boolean(dados?.loja_fechada);
              const desabilitado = !doMes || passado || fechado;
              const selecionado = dia === diaSelecionado;

              const ponto =
                doMes && dados?.tem_agendamento
                  ? "vermelho"
                  : doMes && !passado && !fechado && dados?.sem_horario
                    ? "cinza"
                    : null;

              const descricao = [
                formatarDiaDaChave(dia),
                dados?.tem_agendamento ? "você já tem um horário neste dia" : "",
                ponto === "cinza" ? "sem horários livres" : "",
                fechado && doMes ? "loja fechada" : "",
              ]
                .filter(Boolean)
                .join(", ");

              const corTexto = !doMes
                ? "text-[#c3c3c3]"
                : desabilitado
                  ? "text-[#b3b3b3]"
                  : "text-[#333333]";

              return (
                <button
                  key={dia}
                  type="button"
                  disabled={desabilitado}
                  aria-pressed={selecionado}
                  aria-label={descricao}
                  onClick={() => aoSelecionar(dia)}
                  className={`alvo-toque relative flex flex-col items-center justify-center text-sm ${corTexto}`}
                >
                  <span
                    className={`mb-[0.3rem] grid size-[2rem] place-items-center rounded-full ${
                      selecionado
                        ? "bg-avatar font-semibold text-white"
                        : dia === hoje && doMes
                          ? "font-semibold"
                          : ""
                    }`}
                  >
                    {numeroDoDia(dia)}
                  </span>
                  {ponto ? (
                    <span
                      aria-hidden="true"
                      className={`absolute bottom-[0.2rem] size-[0.4rem] rounded-full ${
                        ponto === "vermelho" ? "bg-ponto-vermelho" : "bg-ponto-cinza"
                      }`}
                    />
                  ) : null}
                </button>
              );
            })}
          </div>

          {erro ? (
            <div role="alert" className="px-4 pb-3 text-center text-xs text-ponto-vermelho">
              Não foi possível carregar os dias do mês.{" "}
              <button type="button" onClick={aoRecarregar} className="underline">
                Tentar de novo
              </button>
            </div>
          ) : null}
        </div>
      </div>
      <div className="h-[3px] bg-[#d0d0d0]" aria-hidden="true" />
    </div>
  );
}
