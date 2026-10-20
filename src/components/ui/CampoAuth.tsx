import type { InputHTMLAttributes } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  rotulo: string;
  erro?: string;
};

/** Campo das telas de acesso: rótulo branco e caixa com borda branca de 2px. */
export function CampoAuth({ id, rotulo, erro, className = "", ...resto }: Props) {
  const idErro = `${id}-erro`;
  return (
    <div className="w-full">
      <label htmlFor={id} className="mb-1 block text-sm text-white">
        {rotulo}
      </label>
      <input
        id={id}
        name={id}
        aria-invalid={erro ? true : undefined}
        aria-describedby={erro ? idErro : undefined}
        className={`alvo-toque w-full rounded-xl border-2 border-white bg-white/10 px-3 text-sm text-white placeholder:text-white/60 ${className}`}
        {...resto}
      />
      {erro ? (
        <p id={idErro} role="alert" className="mt-1 text-xs text-[#ffe0e0]">
          {erro}
        </p>
      ) : null}
    </div>
  );
}
