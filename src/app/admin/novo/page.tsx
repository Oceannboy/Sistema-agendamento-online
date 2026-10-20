import type { Metadata } from "next";
import { FormAgendamentoManual } from "@/components/admin/FormAgendamentoManual";
import { chaveValida, hojeChave } from "@/lib/datas";
import { exigirAdmin, obterClientes } from "@/lib/dados/admin";
import { obterServicosAtivos } from "@/lib/dados/servicos";

export const metadata: Metadata = { title: "Novo agendamento" };

/** Agendamento manual: a dona marca para quem chamou no WhatsApp. */
export default async function NovoAgendamentoManual({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await exigirAdmin();
  const parametros = await searchParams;
  const [servicos, clientes] = await Promise.all([
    obterServicosAtivos(),
    obterClientes(),
  ]);

  const hoje = hojeChave();
  const pedida = typeof parametros.data === "string" ? parametros.data : "";
  const dataInicial = chaveValida(pedida) && pedida >= hoje ? pedida : hoje;

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-base font-semibold text-texto">Novo agendamento</h2>
      {servicos.length === 0 ? (
        <p className="rounded-xl border-2 border-dashed border-texto-suave px-5 py-6 text-center text-sm text-texto">
          Cadastre ou ative pelo menos um serviço antes de agendar.
        </p>
      ) : (
        <FormAgendamentoManual
          servicos={servicos}
          clientes={clientes}
          hoje={hoje}
          dataInicial={dataInicial}
        />
      )}
    </div>
  );
}
