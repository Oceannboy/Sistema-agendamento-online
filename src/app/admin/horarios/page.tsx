import type { Metadata } from "next";
import { EditorHorarios } from "@/components/admin/EditorHorarios";
import { FormConfiguracoes } from "@/components/admin/FormConfiguracoes";
import {
  exigirAdmin,
  obterConfiguracoes,
  obterFaixas,
} from "@/lib/dados/admin";

export const metadata: Metadata = { title: "Horários de funcionamento" };

/** Horário de funcionamento por dia da semana e regras de agendamento. */
export default async function HorariosAdmin() {
  await exigirAdmin();
  const [faixas, configuracoes] = await Promise.all([
    obterFaixas(),
    obterConfiguracoes(),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <section aria-labelledby="titulo-funcionamento" className="flex flex-col gap-3">
        <h2 id="titulo-funcionamento" className="text-base font-semibold text-texto">
          Horário de funcionamento
        </h2>
        <p className="text-xs text-texto-suave">
          Use mais de uma faixa no mesmo dia para marcar o intervalo de almoço
          (ex.: 09:00 às 12:00 e 13:00 às 18:00). Dia sem faixa fica fechado.
        </p>
        <EditorHorarios faixas={faixas} />
      </section>

      <FormConfiguracoes configuracoes={configuracoes} />
    </div>
  );
}
