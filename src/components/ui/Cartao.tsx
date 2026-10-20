import type { ReactNode } from "react";

/** Cartão branco com borda de 2px em gradiente roxo (mesmo visual dos cards da tela 3). */
export function Cartao({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="bg-gradiente-botao rounded-xl p-[2px]">
      <div
        className={`rounded-[calc(0.75rem-2px)] bg-white p-[1rem] text-texto ${className}`}
      >
        {children}
      </div>
    </div>
  );
}
