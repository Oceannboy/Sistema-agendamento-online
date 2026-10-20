import type { Metadata } from "next";
import Link from "next/link";
import { CartaoAgendaAdmin } from "@/components/admin/CartaoAgendaAdmin";
import { BotaoLink } from "@/components/ui/Botao";
import { IconeSetaDireita, IconeSetaEsquerda } from "@/components/ui/Icones";
import {
  chaveDia,
  chaveValida,
  formatarDiaCompleto,
  formatarDiaMes,
  hojeChave,
  inicioDaSemana,
  paraInstante,
  somarDias,
} from "@/lib/datas";
import { exigirAdmin, obterAgendaAdmin } from "@/lib/dados/admin";
import type { AgendamentoLista } from "@/types";

export const metadata: Metadata = { title: "Agenda da loja" };

function umTexto(valor: string | string[] | undefined): string {
  return typeof valor === "string" ? valor : "";
}

function maiuscula(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/**
 * Agenda do dia ou da semana (domingo a sábado) com nome, telefone e status.
 *   /admin?visao=dia|semana&data=AAAA-MM-DD
 */
export default async function AgendaAdmin({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await exigirAdmin();
  const parametros = await searchParams;

  const hoje = hojeChave();
  const pedida = umTexto(parametros.data);
  const dia = chaveValida(pedida) ? pedida : hoje;
  const semana = umTexto(parametros.visao) === "semana";
  const visao = semana ? "semana" : "dia";

  const inicioChave = semana ? inicioDaSemana(dia) : dia;
  const dias = semana ? 7 : 1;
  const fimChave = somarDias(inicioChave, dias);

  const itens = await obterAgendaAdmin(
    paraInstante(inicioChave, "00:00").toISOString(),
    paraInstante(fimChave, "00:00").toISOString(),
  );

  const porDia = new Map<string, AgendamentoLista[]>();
  for (let i = 0; i < dias; i++) porDia.set(somarDias(inicioChave, i), []);
  for (const item of itens) porDia.get(chaveDia(item.inicio))?.push(item);

  const ativos = itens.filter(
    (i) => i.status === "pendente" || i.status === "confirmado",
  ).length;

  const passo = semana ? 7 : 1;
  const href = (data: string, v = visao) => `/admin?visao=${v}&data=${data}`;
  const titulo = semana
    ? `Semana de ${formatarDiaMes(inicioChave)} a ${formatarDiaMes(somarDias(inicioChave, 6))}`
    : maiuscula(formatarDiaCompleto(dia));

  const aba = (ativa: boolean) =>
    `alvo-toque flex flex-1 items-center justify-center rounded-xl border-2 border-texto text-sm ${
      ativa ? "bg-gradiente-botao border-transparent text-white" : "text-texto"
    }`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2" role="group" aria-label="Tipo de visão">
        <Link href={href(dia, "dia")} aria-current={!semana ? "page" : undefined} className={aba(!semana)}>
          Dia
        </Link>
        <Link href={href(dia, "semana")} aria-current={semana ? "page" : undefined} className={aba(semana)}>
          Semana
        </Link>
      </div>

      <div className="flex items-center justify-between gap-1 text-texto">
        <Link
          href={href(somarDias(dia, -passo))}
          aria-label={semana ? "Semana anterior" : "Dia anterior"}
          className="grid size-11 place-items-center"
        >
          <IconeSetaEsquerda className="size-[1.4rem]" />
        </Link>
        <div className="text-center">
          <h2 className="text-base font-semibold" aria-live="polite">
            {titulo}
          </h2>
          <p className="text-xs text-texto-suave">
            {ativos === 0
              ? "Nenhum horário ativo"
              : ativos === 1
                ? "1 horário ativo"
                : `${ativos} horários ativos`}
          </p>
        </div>
        <Link
          href={href(somarDias(dia, passo))}
          aria-label={semana ? "Próxima semana" : "Próximo dia"}
          className="grid size-11 place-items-center"
        >
          <IconeSetaDireita className="size-[1.4rem]" />
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href={href(hoje)}
          className="alvo-toque flex items-center rounded-xl border-2 border-texto px-4 text-sm text-texto"
        >
          Hoje
        </Link>
        <BotaoLink href={`/admin/novo?data=${dia >= hoje ? dia : hoje}`} variante="gradiente">
          Novo agendamento
        </BotaoLink>
      </div>

      {semana ? (
        <div className="flex flex-col gap-5">
          {Array.from(porDia.entries()).map(([chave, lista]) => (
            <section key={chave} aria-label={formatarDiaCompleto(chave)}>
              <h3 className="mb-2 flex items-baseline justify-between border-b-2 border-texto pb-1 text-sm font-semibold text-texto">
                <Link href={href(chave, "dia")} className="underline-offset-2 hover:underline">
                  {maiuscula(formatarDiaCompleto(chave))}
                </Link>
                <span className="text-xs font-normal text-texto-suave">
                  {formatarDiaMes(chave)}
                </span>
              </h3>
              {lista.length === 0 ? (
                <p className="text-sm text-texto-suave">Sem horários.</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {lista.map((item) => (
                    <CartaoAgendaAdmin key={item.id} item={item} />
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      ) : itens.length === 0 ? (
        <p className="rounded-xl border-2 border-dashed border-texto-suave px-5 py-6 text-center text-sm text-texto">
          Nenhum agendamento neste dia.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {itens.map((item) => (
            <CartaoAgendaAdmin key={item.id} item={item} />
          ))}
        </ul>
      )}
    </div>
  );
}
