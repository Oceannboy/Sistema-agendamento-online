import type { ReactNode } from "react";

/** Fundo em gradiente roxo-azulado das telas 1, 2 e cadastro. */
export function TelaGradiente({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <main
      className={`bg-gradiente-tela flex min-h-dvh flex-col px-[8%] pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] text-white ${className}`}
    >
      {children}
    </main>
  );
}
