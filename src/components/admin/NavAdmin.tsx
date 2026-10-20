"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ABAS = [
  { href: "/admin", rotulo: "Agenda", prefixos: ["/admin/novo"] },
  { href: "/admin/servicos", rotulo: "Serviços", prefixos: [] },
  { href: "/admin/horarios", rotulo: "Horários", prefixos: [] },
  { href: "/admin/bloqueios", rotulo: "Bloqueios", prefixos: [] },
];

/** Abas do painel (a aba atual fica em branco). */
export function NavAdmin() {
  const caminho = usePathname();

  function ativa(aba: (typeof ABAS)[number]) {
    if (aba.href === "/admin") {
      return caminho === "/admin" || aba.prefixos.some((p) => caminho.startsWith(p));
    }
    return caminho === aba.href || caminho.startsWith(`${aba.href}/`);
  }

  return (
    <nav aria-label="Seções do painel" className="mt-3 flex gap-1.5">
      {ABAS.map((aba) => {
        const atual = ativa(aba);
        return (
          <Link
            key={aba.href}
            href={aba.href}
            aria-current={atual ? "page" : undefined}
            className={`alvo-toque flex flex-1 items-center justify-center rounded-xl text-xs ${
              atual ? "bg-white font-semibold text-texto" : "bg-white/15 text-white"
            }`}
          >
            {aba.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
