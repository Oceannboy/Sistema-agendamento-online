import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FormServico } from "@/components/admin/FormServico";
import { exigirAdmin, obterServicoAdmin } from "@/lib/dados/admin";
import { esquemaId } from "@/lib/validacao";

export const metadata: Metadata = { title: "Editar serviço" };

export default async function EditarServico({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await exigirAdmin();
  const { id } = await params;
  const parametros = await searchParams;
  if (!esquemaId.safeParse(id).success) notFound();

  const servico = await obterServicoAdmin(id);
  if (!servico) notFound();

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-base font-semibold text-texto">Editar serviço</h2>
      <FormServico servico={servico} recemCriado={parametros.criado === "1"} />
    </div>
  );
}
