"use client";

import { Botao } from "@/components/ui/Botao";

/** Falha ao carregar uma tela do painel. */
export default function ErroAdmin({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div role="alert" className="flex flex-col items-center gap-4 pt-6 text-center text-texto">
      <p className="text-base font-semibold">Não foi possível carregar agora.</p>
      <p className="text-sm">Verifique a conexão e tente de novo.</p>
      <Botao variante="gradiente" onClick={() => reset()}>
        Tentar de novo
      </Botao>
    </div>
  );
}
