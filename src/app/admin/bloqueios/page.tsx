import type { Metadata } from "next";
import { FormAcaoSimples } from "@/components/admin/FormAcaoSimples";
import { FormBloqueio } from "@/components/admin/FormBloqueio";
import { Cartao } from "@/components/ui/Cartao";
import { removerBloqueio } from "@/lib/acoes/admin";
import {
  chaveDia,
  formatarDataCurta,
  formatarDiaDaChave,
  formatarHora,
  hojeChave,
  somarDias,
} from "@/lib/datas";
import { exigirAdmin, obterBloqueiosFuturos } from "@/lib/dados/admin";
import type { Bloqueio } from "@/types";

export const metadata: Metadata = { title: "Bloqueios" };

function descrever(bloqueio: Bloqueio): string {
  const horaInicio = formatarHora(bloqueio.inicio);
  const horaFim = formatarHora(bloqueio.fim);

  if (horaInicio === "00:00" && horaFim === "00:00") {
    const primeiro = chaveDia(bloqueio.inicio);
    const ultimo = somarDias(chaveDia(bloqueio.fim), -1);
    return primeiro === ultimo
      ? `${formatarDiaDaChave(primeiro)} (dia inteiro)`
      : `${formatarDiaDaChave(primeiro)} a ${formatarDiaDaChave(ultimo)} (dias inteiros)`;
  }
  return `${formatarDataCurta(bloqueio.inicio)}, ${horaInicio} até ${formatarDataCurta(bloqueio.fim)}, ${horaFim}`;
}

/** Bloqueios: feriados, folgas e imprevistos que tiram horários da agenda. */
export default async function BloqueiosAdmin() {
  await exigirAdmin();
  const bloqueios = await obterBloqueiosFuturos();

  return (
    <div className="flex flex-col gap-5">
      <FormBloqueio hoje={hojeChave()} />

      <section aria-labelledby="titulo-bloqueios" className="flex flex-col gap-3">
        <h2 id="titulo-bloqueios" className="text-base font-semibold text-texto">
          Bloqueios ativos e futuros
        </h2>
        {bloqueios.length === 0 ? (
          <p className="rounded-xl border-2 border-dashed border-texto-suave px-5 py-6 text-center text-sm text-texto">
            Nenhum bloqueio por enquanto.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {bloqueios.map((bloqueio) => (
              <li key={bloqueio.id}>
                <Cartao>
                  <p className="text-sm font-semibold">{descrever(bloqueio)}</p>
                  <p className="mt-0.5 text-xs text-texto-suave">
                    {bloqueio.motivo || "Sem motivo informado"}
                  </p>
                  <div className="mt-3">
                    <FormAcaoSimples
                      acao={removerBloqueio}
                      campos={{ id: bloqueio.id }}
                      rotulo="Remover bloqueio"
                      rotuloPendente="Removendo…"
                      confirmar="Remover este bloqueio? Os horários desse período voltam a ficar livres."
                    />
                  </div>
                </Cartao>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
