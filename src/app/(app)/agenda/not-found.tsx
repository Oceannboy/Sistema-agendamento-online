import { BotaoLink } from "@/components/ui/Botao";

/** Horário inexistente, de outra pessoa, cancelado ou já encerrado. */
export default function HorarioNaoEncontrado() {
  return (
    <div className="min-h-dvh bg-white">
      <header className="bg-roxo-escuro px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[0.9rem] text-center text-white">
        <h1 className="inline-block border-b-2 border-white pb-0.5 text-sm">
          Horário
        </h1>
      </header>
      <div className="flex flex-col items-center gap-4 px-[1.8rem] pt-[3rem] text-center text-texto">
        <p className="text-base font-semibold">Horário não encontrado.</p>
        <p className="text-sm">
          Ele pode ter sido cancelado, já ter acontecido ou não ser seu.
        </p>
        <BotaoLink href="/agenda" variante="gradiente">
          Ver horários marcados
        </BotaoLink>
      </div>
    </div>
  );
}
