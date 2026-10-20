"use client";

import { Botao } from "@/components/ui/Botao";
import { sair } from "@/lib/acoes/auth";

/** Estado de erro das telas de agenda (falha ao carregar do banco). */
export default function ErroAgenda({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-dvh bg-white">
      <header className="bg-gradiente-tela rounded-b-[1.4rem] px-4 pt-[max(1.6rem,calc(env(safe-area-inset-top)+0.8rem))] pb-[1.7rem] text-center text-white">
        <h1 className="inline-block border-b-2 border-white pb-0.5 text-base">
          Horários Marcados:
        </h1>
      </header>
      <div
        role="alert"
        className="flex flex-col items-center gap-4 px-[1.8rem] pt-[3rem] text-center text-texto"
      >
        <p className="text-base font-semibold">
          Não foi possível carregar agora.
        </p>
        <p className="text-sm">
          Verifique sua conexão e tente de novo. Se continuar, saia e entre
          novamente.
        </p>
        <Botao variante="gradiente" onClick={() => reset()}>
          Tentar de novo
        </Botao>
        <form action={sair}>
          <button type="submit" className="alvo-toque text-sm underline">
            Sair
          </button>
        </form>
      </div>
    </div>
  );
}
