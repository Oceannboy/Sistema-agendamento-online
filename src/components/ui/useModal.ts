"use client";

import { useEffect } from "react";

/**
 * Comportamento comum de janelas sobrepostas: fecha com Esc e trava a
 * rolagem da página enquanto estiverem abertas.
 */
export function useModal(aberto: boolean, aoFechar: () => void) {
  useEffect(() => {
    if (!aberto) return;

    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") aoFechar();
    };
    document.addEventListener("keydown", aoTeclar);

    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", aoTeclar);
      document.body.style.overflow = overflowAnterior;
    };
  }, [aberto, aoFechar]);
}
