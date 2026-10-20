import type { Metadata } from "next";
import { FormServico } from "@/components/admin/FormServico";
import { exigirAdmin } from "@/lib/dados/admin";

export const metadata: Metadata = { title: "Novo serviço" };

export default async function NovoServico() {
  await exigirAdmin();
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-base font-semibold text-texto">Novo serviço</h2>
      <FormServico />
    </div>
  );
}
