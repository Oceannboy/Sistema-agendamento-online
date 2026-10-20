import type { InputHTMLAttributes } from "react";

/** Classes dos campos em fundo claro (borda roxa de 2px). Use em select/textarea também. */
export const CLASSE_CAMPO_CLARO =
  "alvo-toque w-full rounded-xl border-2 border-texto bg-white px-3 text-sm text-texto placeholder:text-texto-suave";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  rotulo: string;
  erro?: string;
  ajuda?: string;
};

/** Campo de texto para as telas internas (fundo claro). */
export function CampoClaro({ id, rotulo, erro, ajuda, className = "", ...resto }: Props) {
  const idErro = `${id}-erro`;
  const idAjuda = `${id}-ajuda`;
  const descritoPor = [erro ? idErro : null, ajuda ? idAjuda : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="w-full">
      <label htmlFor={id} className="mb-1 block text-sm text-texto">
        {rotulo}
      </label>
      <input
        id={id}
        name={id}
        aria-invalid={erro ? true : undefined}
        aria-describedby={descritoPor || undefined}
        className={`${CLASSE_CAMPO_CLARO} ${className}`}
        {...resto}
      />
      {ajuda ? (
        <p id={idAjuda} className="mt-1 text-xs text-texto-suave">
          {ajuda}
        </p>
      ) : null}
      {erro ? (
        <p id={idErro} role="alert" className="mt-1 text-xs text-ponto-vermelho">
          {erro}
        </p>
      ) : null}
    </div>
  );
}
