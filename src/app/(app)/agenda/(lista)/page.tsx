import type { Metadata } from "next";
import Link from "next/link";
import { AdicionarHorario } from "@/components/agenda/AdicionarHorario";
import { CartaoHorario } from "@/components/agenda/CartaoHorario";
import { PerfilFlutuante } from "@/components/agenda/PerfilFlutuante";
import { obterAgendamentosFuturos } from "@/lib/dados/agendamentos";
import { obterPerfil } from "@/lib/dados/perfil";
import { obterServicosAtivos } from "@/lib/dados/servicos";

export const metadata: Metadata = { title: "Horários marcados" };

/**
 * Tela 3: horários marcados (futuros e ativos, do mais próximo ao mais distante).
 * Estados: carregando (loading.tsx), vazio (abaixo) e erro (error.tsx).
 * Para admin, mostra todos os agendamentos com o nome da cliente.
 */
export default async function HorariosMarcados() {
  const [perfil, itens, servicos] = await Promise.all([
    obterPerfil(),
    obterAgendamentosFuturos(),
    obterServicosAtivos(),
  ]);
  if (!perfil) {
    throw new Error("Perfil não encontrado. Saia e entre novamente.");
  }
  const admin = perfil.papel === "admin";

  return (
    <div className="min-h-dvh bg-white pb-[8rem]">
      <header className="bg-gradiente-tela relative rounded-b-[1.4rem] px-4 pt-[max(1.6rem,calc(env(safe-area-inset-top)+0.8rem))] pb-[1.7rem] text-center text-white">
        {admin ? (
          <Link
            href="/admin"
            className="alvo-toque absolute top-[max(0.4rem,env(safe-area-inset-top))] right-[0.8rem] flex items-center text-xs underline"
          >
            Painel da loja
          </Link>
        ) : null}
        <h1 className="inline-block border-b-2 border-white pb-0.5 text-base">
          Horários Marcados:
        </h1>
      </header>

      <section
        aria-label="Seus horários"
        className="px-[1.4rem] pt-[2.4rem]"
      >
        {itens.length === 0 ? (
          <div className="mb-[1.6rem] rounded-xl border-2 border-dashed border-texto-suave px-5 py-6 text-center text-sm leading-relaxed text-texto">
            <p className="font-semibold">
              {admin
                ? "Nenhum horário marcado por enquanto."
                : "Você ainda não tem horários marcados."}
            </p>
            <p className="mt-1 text-xs">
              Digite um título abaixo e toque em + para marcar o primeiro.
            </p>
          </div>
        ) : (
          <ul className="mb-[1.6rem] flex flex-col gap-[1.6rem]">
            {itens.map((item) => (
              <CartaoHorario key={item.id} item={item} admin={admin} />
            ))}
          </ul>
        )}

        <AdicionarHorario />
      </section>

      <PerfilFlutuante perfil={perfil} servicos={servicos} />
    </div>
  );
}
