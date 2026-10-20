"use client";

import { useEffect, useRef } from "react";
import { useModal } from "@/components/ui/useModal";

type Props = {
  aberto: boolean;
  aoFechar: () => void;
  /** Texto do dia escolhido (ex.: "20 de outubro"), ou null se ainda não escolheu. */
  diaTexto: string | null;
  horarios: string[];
  carregando: boolean;
  erro: boolean;
  selecionado: string | null;
  aoEscolher: (hora: string) => void;
  aoRecarregar: () => void;
};

/** Janela com os horários LIVRES do dia para o serviço escolhido. */
export function SeletorHorario({
  aberto,
  aoFechar,
  diaTexto,
  horarios,
  carregando,
  erro,
  selecionado,
  aoEscolher,
  aoRecarregar,
}: Props) {
  useModal(aberto, aoFechar);
  const botaoFechar = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (aberto) botaoFechar.current?.focus();
  }, [aberto]);

  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center">
      <button
        type="button"
        tabIndex={-1}
        aria-label="Fechar seleção de horário"
        onClick={aoFechar}
        className="absolute inset-0 bg-black/30"
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="seletor-horario-titulo"
        className="relative max-h-[80dvh] w-full max-w-[430px] overflow-y-auto rounded-t-2xl bg-white px-[1.5rem] pt-[1.2rem] pb-[max(1.4rem,env(safe-area-inset-bottom))]"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 id="seletor-horario-titulo" className="text-base text-texto">
            {diaTexto ? `Horários livres: ${diaTexto}` : "Escolha o horário"}
          </h2>
          <button
            ref={botaoFechar}
            type="button"
            onClick={aoFechar}
            className="alvo-toque px-2 text-sm text-texto underline"
          >
            Fechar
          </button>
        </div>

        {!diaTexto ? (
          <p className="py-4 text-sm text-texto">
            Primeiro escolha um dia no calendário.
          </p>
        ) : carregando ? (
          <p role="status" className="py-4 text-sm text-texto">
            Carregando horários…
          </p>
        ) : erro ? (
          <p role="alert" className="py-4 text-sm text-ponto-vermelho">
            Não foi possível carregar os horários.{" "}
            <button type="button" onClick={aoRecarregar} className="underline">
              Tentar de novo
            </button>
          </p>
        ) : horarios.length === 0 ? (
          <p className="py-4 text-sm text-texto">
            Não há horários livres nesse dia para o serviço escolhido. Escolha
            outro dia ou outro tipo de trabalho.
          </p>
        ) : (
          <ul className="grid grid-cols-4 gap-2">
            {horarios.map((hora) => (
              <li key={hora}>
                <button
                  type="button"
                  aria-pressed={hora === selecionado}
                  onClick={() => aoEscolher(hora)}
                  className={`alvo-toque w-full rounded-xl border-2 border-texto text-sm ${
                    hora === selecionado
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
      </section>
    </div>
  );
}
