import type { SVGProps } from "react";

/** Ícones em SVG (traço arredondado, herdam a cor do texto). */
type Props = SVGProps<SVGSVGElement>;

function Base({ children, ...resto }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...resto}
    >
      {children}
    </svg>
  );
}

/** Quadrado aberto com lápis (botão de editar dos cards). */
export function IconeEditar(props: Props) {
  return (
    <Base {...props}>
      <path d="M11 4H7a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-4" />
      <path d="M18.4 3.6a2 2 0 0 1 2.9 2.9L12.2 15.6 8.5 16.5l.9-3.7z" />
    </Base>
  );
}

/** Contorno de usuário (botão flutuante do perfil). */
export function IconeUsuario(props: Props) {
  return (
    <Base {...props}>
      <circle cx="12" cy="7.5" r="3.6" />
      <path d="M5.2 20.2v-1.4a4.8 4.8 0 0 1 4.8-4.8h4a4.8 4.8 0 0 1 4.8 4.8v1.4z" />
    </Base>
  );
}

/** Silhueta preenchida (avatar padrão). */
export function IconeSilhueta(props: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" {...props}>
      <circle cx="12" cy="7.6" r="4.6" />
      <path d="M3.4 20.6c0-4.4 3.6-7.4 8.6-7.4s8.6 3 8.6 7.4c0 .7-1.4 1-8.6 1s-8.6-.3-8.6-1z" />
    </svg>
  );
}

export function IconeMais(props: Props) {
  return (
    <Base strokeWidth={2.2} {...props}>
      <path d="M12 5v14M5 12h14" />
    </Base>
  );
}

/** Chevron apontando para cima (gire com classes para outras direções). */
export function IconeChevron(props: Props) {
  return (
    <Base strokeWidth={2.4} {...props}>
      <path d="M6 15l6-6 6 6" />
    </Base>
  );
}

export function IconeSetaEsquerda(props: Props) {
  return (
    <Base strokeWidth={2.4} {...props}>
      <path d="M15 6l-6 6 6 6" />
    </Base>
  );
}

export function IconeSetaDireita(props: Props) {
  return (
    <Base strokeWidth={2.4} {...props}>
      <path d="M9 6l6 6-6 6" />
    </Base>
  );
}

export function IconeMenu(props: Props) {
  return (
    <Base strokeWidth={2.2} {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Base>
  );
}

export function IconeTresPontos(props: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" {...props}>
      <circle cx="12" cy="5" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="12" cy="19" r="2" />
    </svg>
  );
}

/** V grande do seletor de tipo de trabalho. */
export function IconeSeta(props: Props) {
  return (
    <Base strokeWidth={2.4} {...props}>
      <path d="M5 9l7 7 7-7" />
    </Base>
  );
}
