import type { Metadata } from "next";
import { FormAcaoSimples } from "@/components/admin/FormAcaoSimples";
import { BotaoLink } from "@/components/ui/Botao";
import { Cartao } from "@/components/ui/Cartao";
import { alternarServico } from "@/lib/acoes/admin";
import { exigirAdmin, obterServicosAdmin } from "@/lib/dados/admin";
import Link from "next/link";

export const metadata: Metadata = { title: "Serviços" };

const preco = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** Serviços da loja: criar, editar, ativar/desativar e foto. */
export default async function ServicosAdmin() {
  await exigirAdmin();
  const servicos = await obterServicosAdmin();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-texto">Serviços</h2>
        <BotaoLink href="/admin/servicos/novo" variante="gradiente">
          Novo serviço
        </BotaoLink>
      </div>

      {servicos.length === 0 ? (
        <p className="rounded-xl border-2 border-dashed border-texto-suave px-5 py-6 text-center text-sm text-texto">
          Nenhum serviço cadastrado ainda.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {servicos.map((servico) => (
            <li key={servico.id} className={servico.ativo ? "" : "opacity-75"}>
              <Cartao>
                <div className="flex gap-3">
                  {servico.foto_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={servico.foto_url}
                      alt=""
                      className="size-[4.2rem] shrink-0 rounded-xl bg-avatar object-cover"
                    />
                  ) : (
                    <div
                      aria-hidden="true"
                      className="grid size-[4.2rem] shrink-0 place-items-center rounded-xl bg-[#e4e3fb] text-xs"
                    >
                      Sem foto
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="truncate text-base font-semibold">{servico.nome}</h3>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-0.5 text-[0.6875rem] font-semibold ${
                          servico.ativo
                            ? "bg-[#d9f2e1] text-[#1c6137]"
                            : "bg-[#f6dcdc] text-[#8a2b2b]"
                        }`}
                      >
                        {servico.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm">
                      {servico.duracao_min} min · {preco.format(servico.preco)}
                    </p>
                    {servico.descricao ? (
                      <p className="mt-0.5 line-clamp-2 text-xs text-texto-suave">
                        {servico.descricao}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-start gap-2">
                  <Link
                    href={`/admin/servicos/${servico.id}`}
                    className="alvo-toque flex items-center rounded-xl bg-gradiente-botao px-4 text-xs text-white"
                  >
                    Editar
                  </Link>
                  <FormAcaoSimples
                    acao={alternarServico}
                    campos={{ id: servico.id, ativo: String(!servico.ativo) }}
                    rotulo={servico.ativo ? "Desativar" : "Ativar"}
                    confirmar={
                      servico.ativo
                        ? `Desativar "${servico.nome}"? As clientes não poderão mais agendar esse serviço (os horários já marcados continuam).`
                        : undefined
                    }
                  />
                </div>
              </Cartao>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
