/** Estado "carregando" da tela 3: mesma estrutura, com blocos pulsando. */
export default function CarregandoHorarios() {
  return (
    <div
      className="min-h-dvh bg-white"
      role="status"
      aria-live="polite"
      aria-label="Carregando seus horários"
    >
      <header className="bg-gradiente-tela rounded-b-[1.4rem] px-4 pt-[max(1.6rem,calc(env(safe-area-inset-top)+0.8rem))] pb-[1.7rem] text-center text-white">
        <h1 className="inline-block border-b-2 border-white pb-0.5 text-base">
          Horários Marcados:
        </h1>
      </header>
      <div className="flex flex-col gap-[1.6rem] px-[1.4rem] pt-[2.4rem]">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-[5.6rem] animate-pulse rounded-xl bg-[#e4e3fb]"
          />
        ))}
        <span className="sr-only">Carregando…</span>
      </div>
    </div>
  );
}
