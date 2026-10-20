import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps } from "react";

type Variante = "claro" | "gradiente" | "contorno";

/** Classes compartilhadas por <Botao> e <BotaoLink>. */
export function classesBotao(variante: Variante = "claro", extra = ""): string {
  const base =
    "alvo-toque inline-flex items-center justify-center rounded-xl px-6 text-sm font-normal " +
    "transition-[transform,opacity] duration-150 active:scale-[0.98] " +
    "disabled:pointer-events-none disabled:opacity-60";
  const cor =
    variante === "claro"
      ? "bg-white text-texto"
      : variante === "contorno"
        ? "border-2 border-texto bg-white text-texto"
        : "bg-gradiente-botao text-white";
  return `${base} ${cor} ${extra}`.trim();
}

type PropsBotao = ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: Variante;
};

/** Botão de ação (envia formulário, executa ação). */
export function Botao({
  variante = "claro",
  className = "",
  type = "button",
  ...resto
}: PropsBotao) {
  return (
    <button
      type={type}
      className={classesBotao(variante, className)}
      {...resto}
    />
  );
}

type PropsBotaoLink = ComponentProps<typeof Link> & { variante?: Variante };

/** Botão que navega para outra tela. */
export function BotaoLink({
  variante = "claro",
  className = "",
  ...resto
}: PropsBotaoLink) {
  return <Link className={classesBotao(variante, className)} {...resto} />;
}
