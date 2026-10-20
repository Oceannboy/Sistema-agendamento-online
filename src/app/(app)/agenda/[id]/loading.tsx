/** Carregando a tela 4 (criação). */
export default function CarregandoNovo() {
  return (
    <div className="min-h-dvh bg-fundo" role="status" aria-label="Carregando">
      <div className="bg-roxo-escuro h-[4.2rem]" />
      <div className="bg-roxo-medio h-[4rem]" />
      <div className="h-[18rem] animate-pulse bg-white" />
      <span className="sr-only">Carregando…</span>
    </div>
  );
}
