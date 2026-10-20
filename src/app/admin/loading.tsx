/** Carregando qualquer tela do painel. */
export default function CarregandoAdmin() {
  return (
    <div role="status" aria-label="Carregando" className="flex flex-col gap-4">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-[7rem] animate-pulse rounded-xl bg-[#e4e3fb]" />
      ))}
      <span className="sr-only">Carregando…</span>
    </div>
  );
}
