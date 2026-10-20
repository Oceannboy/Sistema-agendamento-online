"use client";

import { useState, type ChangeEvent } from "react";
import { definirFotoServico, removerFotoServico } from "@/lib/acoes/admin";
import { reduzirImagem } from "@/lib/imagem";
import { criarClienteNavegador } from "@/lib/supabase/client";

const TIPOS = ["image/jpeg", "image/png", "image/webp"];

/** Foto do serviço: o navegador sobe para o Storage (política: só admin) e o servidor grava a URL. */
export function FotoServico({
  servicoId,
  fotoUrl,
  nome,
}: {
  servicoId: string;
  fotoUrl: string | null;
  nome: string;
}) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function aoEscolher(evento: ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0];
    evento.target.value = "";
    if (!arquivo) return;
    if (!TIPOS.includes(arquivo.type)) {
      setErro("Use uma imagem JPG, PNG ou WebP.");
      return;
    }

    setEnviando(true);
    setErro(null);
    try {
      const imagem = await reduzirImagem(arquivo, 900);
      const caminho = `${servicoId}/foto-${Date.now()}.jpg`;
      const supabase = criarClienteNavegador();
      const { error } = await supabase.storage
        .from("servicos-fotos")
        .upload(caminho, imagem, { contentType: "image/jpeg", upsert: false });
      if (error) throw error;

      const resultado = await definirFotoServico(servicoId, caminho);
      if (resultado.erro) throw new Error(resultado.erro);
    } catch {
      setErro("Não foi possível enviar a foto. Tente outra imagem.");
    } finally {
      setEnviando(false);
    }
  }

  async function aoRemover() {
    setEnviando(true);
    setErro(null);
    const resultado = await removerFotoServico(servicoId);
    if (resultado.erro) setErro(resultado.erro);
    setEnviando(false);
  }

  return (
    <div className="flex items-center gap-4">
      {fotoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={fotoUrl}
          alt={`Foto do serviço ${nome}`}
          className="size-[5.5rem] shrink-0 rounded-xl bg-avatar object-cover"
        />
      ) : (
        <div
          className="grid size-[5.5rem] shrink-0 place-items-center rounded-xl bg-[#e4e3fb] text-center text-xs text-texto"
          role="img"
          aria-label="Sem foto"
        >
          Sem foto
        </div>
      )}
      <div className="flex flex-col items-start gap-1 text-sm text-texto">
        <label className="alvo-toque inline-flex cursor-pointer items-center underline">
          {enviando ? "Enviando…" : fotoUrl ? "Trocar foto" : "Adicionar foto"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            disabled={enviando}
            onChange={aoEscolher}
          />
        </label>
        {fotoUrl ? (
          <button
            type="button"
            onClick={aoRemover}
            disabled={enviando}
            className="alvo-toque underline disabled:opacity-60"
          >
            Remover foto
          </button>
        ) : null}
        {erro ? (
          <p role="alert" className="text-xs text-ponto-vermelho">
            {erro}
          </p>
        ) : null}
      </div>
    </div>
  );
}
