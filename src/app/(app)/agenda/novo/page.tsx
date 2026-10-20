import type { Metadata } from "next";
import { FormAgendamento } from "@/components/agenda/FormAgendamento";
import { PerfilFlutuante } from "@/components/agenda/PerfilFlutuante";
import { BotaoLink } from "@/components/ui/Botao";
import { hojeChave } from "@/lib/datas";
import { obterPerfil } from "@/lib/dados/perfil";
import { obterServicosAtivos } from "@/lib/dados/servicos";
import { esquemaId } from "@/lib/validacao";

export const metadata: Metadata = { title: "Novo horário" };

function umTexto(valor: string | string[] | undefined): string {
  return typeof valor === "string" ? valor : "";
}

/**
 * Tela 4 em modo criação.
 *  ?titulo=...  (vem do campo "Adicionar novo horário…")
 *  ?servico=... (vem do chip de favorito)
 */
export default async function NovoHorario({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parametros = await searchParams;
  const [perfil, servicos] = await Promise.all([
    obterPerfil(),
    obterServicosAtivos(),
  ]);
  if (!perfil) {
    throw new Error("Perfil não encontrado. Saia e entre novamente.");
  }

  if (servicos.length === 0) {
    return (
      <div className="flex min-h-dvh flex-col items-center gap-4 bg-white px-[1.8rem] pt-[4rem] text-center text-texto">
        <p className="text-base font-semibold">
          Nenhum serviço disponível no momento.
        </p>
        <p className="text-sm">Fale com a loja para marcar o seu horário.</p>
        <BotaoLink href="/agenda" variante="gradiente">
          Voltar
        </BotaoLink>
      </div>
    );
  }

  const pedido = umTexto(parametros.servico);
  const servicoInicial = esquemaId.safeParse(pedido).success
    ? servicos.find((s) => s.id === pedido)?.id
    : undefined;
  const tituloInicial = umTexto(parametros.titulo).trim().slice(0, 60);

  return (
    <>
      <FormAgendamento
        servicos={servicos}
        hoje={hojeChave()}
        servicoInicial={servicoInicial}
        tituloInicial={tituloInicial}
      />
      <PerfilFlutuante perfil={perfil} servicos={servicos} />
    </>
  );
}
