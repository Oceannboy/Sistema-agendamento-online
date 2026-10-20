import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FormAgendamento } from "@/components/agenda/FormAgendamento";
import { PerfilFlutuante } from "@/components/agenda/PerfilFlutuante";
import { hojeChave } from "@/lib/datas";
import { obterAgendamentoPorId } from "@/lib/dados/agendamentos";
import { obterPerfil } from "@/lib/dados/perfil";
import { obterServicoPorId, obterServicosAtivos } from "@/lib/dados/servicos";
import { esquemaId } from "@/lib/validacao";

export const metadata: Metadata = { title: "Editar horário" };

/**
 * Tela 4 em modo edição. O RLS só devolve o agendamento se for da usuária
 * (ou se ela for admin); caso contrário cai em "não encontrado".
 */
export default async function EditarHorario({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const parametros = await searchParams;
  if (!esquemaId.safeParse(id).success) notFound();

  const [perfil, ativos, agendamento] = await Promise.all([
    obterPerfil(),
    obterServicosAtivos(),
    obterAgendamentoPorId(id),
  ]);
  if (!perfil) {
    throw new Error("Perfil não encontrado. Saia e entre novamente.");
  }

  const ativo =
    agendamento &&
    (agendamento.status === "pendente" || agendamento.status === "confirmado") &&
    new Date(agendamento.inicio).getTime() > Date.now();
  if (!agendamento || !ativo) notFound();

  // se o serviço do agendamento foi desativado depois, ele ainda precisa
  // aparecer na lista para a edição não perder o serviço atual
  let servicos = ativos;
  if (!servicos.some((s) => s.id === agendamento.servicoId)) {
    const atual = await obterServicoPorId(agendamento.servicoId);
    if (atual) servicos = [...servicos, atual];
  }

  return (
    <>
      <FormAgendamento
        servicos={servicos}
        hoje={hojeChave()}
        retorno={
          parametros.retorno === "admin" && perfil.papel === "admin"
            ? "/admin"
            : undefined
        }
        agendamento={{
          id: agendamento.id,
          servicoId: agendamento.servicoId,
          titulo: agendamento.titulo ?? "",
          inicio: agendamento.inicio,
        }}
      />
      <PerfilFlutuante perfil={perfil} servicos={ativos} />
    </>
  );
}
