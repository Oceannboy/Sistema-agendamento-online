import { Cartao } from "@/components/ui/Cartao";
import { formatarHora } from "@/lib/datas";
import type { AgendamentoLista, StatusAgendamento } from "@/types";
import { AcoesAgendamento } from "./AcoesAgendamento";

const ROTULO_STATUS: Record<StatusAgendamento, string> = {
  pendente: "Pendente",
  confirmado: "Confirmado",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

const COR_STATUS: Record<StatusAgendamento, string> = {
  pendente: "bg-[#fff1cc] text-[#6b4700]",
  confirmado: "bg-[#e3e2fb] text-texto",
  concluido: "bg-[#d9f2e1] text-[#1c6137]",
  cancelado: "bg-[#f6dcdc] text-[#8a2b2b]",
};

/** Só os dígitos do telefone, com DDD, se formarem um número brasileiro. */
function digitosDoTelefone(telefone: string | null): string | null {
  const digitos = (telefone ?? "").replace(/\D/g, "");
  return digitos.length === 10 || digitos.length === 11 ? digitos : null;
}

/** Um agendamento na agenda do admin: horário, cliente, telefone, status e ações. */
export function CartaoAgendaAdmin({ item }: { item: AgendamentoLista }) {
  const titulo = item.titulo?.trim() || item.servicoNome;
  const digitos = digitosDoTelefone(item.clienteTelefone);
  const ativo = item.status === "pendente" || item.status === "confirmado";
  const futuro = new Date(item.inicio).getTime() > Date.now();

  return (
    <li className={item.status === "cancelado" ? "opacity-70" : ""}>
      <Cartao>
        <div className="flex items-start justify-between gap-2">
          <p className="text-base font-semibold">
            {formatarHora(item.inicio)}–{formatarHora(item.fim)}
          </p>
          <span
            className={`rounded-full px-2.5 py-0.5 text-[0.6875rem] font-semibold ${COR_STATUS[item.status]}`}
          >
            {ROTULO_STATUS[item.status]}
          </span>
        </div>

        <p className="mt-1 text-sm">
          {titulo}
          {titulo !== item.servicoNome ? (
            <span className="text-texto-suave"> · {item.servicoNome}</span>
          ) : null}
        </p>

        <p className="mt-1 text-sm">
          {item.clienteNome ?? "Cliente sem nome"}
        </p>
        {item.clienteTelefone ? (
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs">
            {digitos ? (
              <a href={`tel:+55${digitos}`} className="alvo-toque flex items-center underline">
                {item.clienteTelefone}
              </a>
            ) : (
              <span>{item.clienteTelefone}</span>
            )}
            {digitos ? (
              <a
                href={`https://wa.me/55${digitos}`}
                target="_blank"
                rel="noopener noreferrer"
                className="alvo-toque flex items-center underline"
              >
                WhatsApp
              </a>
            ) : null}
          </p>
        ) : null}

        <AcoesAgendamento
          id={item.id}
          status={item.status}
          podeRemarcar={ativo && futuro}
        />
      </Cartao>
    </li>
  );
}
