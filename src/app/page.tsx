import { BotaoLink } from "@/components/ui/Botao";
import { IlustracaoEsmalte } from "@/components/ui/IlustracaoEsmalte";
import { TelaGradiente } from "@/components/ui/TelaGradiente";
import { NOME_EMPRESA } from "@/lib/config";

/**
 * Tela 1: boas-vindas.
 * Quem já tem sessão nunca chega aqui: o proxy (src/proxy.ts) redireciona
 * direto para /agenda.
 */
export default function BoasVindas() {
  return (
    <TelaGradiente className="items-center justify-center">
      <div className="flex w-full max-w-[11rem] flex-col items-center">
        <IlustracaoEsmalte className="mx-auto w-[8.4rem]" />
        <h1 className="-mt-3 text-center font-titulo text-lg leading-snug font-medium break-words text-white">
          Agenda
          <br />
          {NOME_EMPRESA}
        </h1>
        <BotaoLink href="/login" className="mx-auto mt-6 w-[8.3rem]">
          Acessar
        </BotaoLink>
      </div>
    </TelaGradiente>
  );
}
