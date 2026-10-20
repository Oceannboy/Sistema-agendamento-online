import Link from "next/link";
import { NavAdmin } from "@/components/admin/NavAdmin";
import { sair } from "@/lib/acoes/auth";
import { exigirAdmin } from "@/lib/dados/admin";

/**
 * Painel da loja. Mesmo visual do app: cabeçalho em gradiente com cantos
 * arredondados e título sublinhado. O proxy já barra quem não é admin; aqui
 * conferimos de novo (a segurança real é o RLS).
 */
export default async function LayoutAdmin({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await exigirAdmin();

  return (
    <div className="min-h-dvh bg-white pb-[3rem]">
      <header className="bg-gradiente-tela rounded-b-[1.4rem] px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[1rem] text-white">
        <div className="flex items-center justify-between text-xs">
          <Link href="/agenda" className="alvo-toque flex items-center underline">
            Meus horários
          </Link>
          <form action={sair}>
            <button type="submit" className="alvo-toque underline">
              Sair
            </button>
          </form>
        </div>
        <h1 className="text-center">
          <span className="inline-block border-b-2 border-white pb-0.5 text-base">
            Painel da loja
          </span>
        </h1>
        <NavAdmin />
      </header>

      <div className="px-[1.2rem] pt-[1.4rem]">{children}</div>
    </div>
  );
}
