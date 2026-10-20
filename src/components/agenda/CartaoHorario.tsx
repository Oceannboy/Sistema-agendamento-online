import Link from "next/link";
import { IconeEditar } from "@/components/ui/Icones";
import { formatarDataCurta, formatarHora } from "@/lib/datas";
import type { AgendamentoLista } from "@/types";

/**
 * Card da tela 3: borda em gradiente roxo, título sublinhado, serviço e
 * "Hora 14:30 dia 20 de outubro". O botão quadrado à direita abre a tela 4
 * em modo edição.
 */
export function CartaoHorario({
  item,
  admin,
}: {
  item: AgendamentoLista;
  admin: boolean;
}) {
  const titulo = item.titulo?.trim() || item.servicoNome;

  return (
    <li className="relative">
      {/* borda de 2px em gradiente: o fundo é o gradiente e o miolo é branco */}
      <div className="bg-gradiente-botao rounded-xl p-[2px]">
        <div className="min-h-[5.2rem] rounded-[calc(0.75rem-2px)] bg-white py-3 pr-[5.6rem] pl-4 text-texto">
          <h2 className="w-[8.6rem] max-w-full truncate border-b-2 border-texto pb-0.5 text-sm leading-tight">
            {titulo}
          </h2>
          <p className="mt-1.5 truncate text-xs">{item.servicoNome}</p>
          <p className="mt-1 text-xs">
            Hora {formatarHora(item.inicio)} dia {formatarDataCurta(item.inicio)}
          </p>
          {admin && item.clienteNome ? (
            <p className="mt-1 truncate text-xs text-texto-suave">
              Cliente: {item.clienteNome}
              {item.clienteTelefone ? ` · ${item.clienteTelefone}` : ""}
            </p>
          ) : null}
        </div>
      </div>

      <Link
        href={`/agenda/${item.id}`}
        aria-label={`Editar horário: ${titulo}, ${formatarDataCurta(item.inicio)} às ${formatarHora(item.inicio)}`}
        className="bg-gradiente-botao absolute inset-y-0 right-0 grid w-[4.9rem] place-items-center rounded-xl text-white"
      >
        <IconeEditar className="size-[2.1rem]" />
      </Link>
    </li>
  );
}
