"use client";

import Link from "next/link";
import {
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
} from "react";
import { Botao } from "@/components/ui/Botao";
import {
  IconeChevron,
  IconeSilhueta,
  IconeTresPontos,
  IconeUsuario,
} from "@/components/ui/Icones";
import { useModal } from "@/components/ui/useModal";
import { sair } from "@/lib/acoes/auth";
import {
  adicionarFavorito,
  atualizarPerfil,
  definirAvatar,
  removerAvatar,
  removerFavorito,
} from "@/lib/acoes/perfil";
import type { EstadoForm } from "@/lib/acoes/tipos";
import { reduzirImagem } from "@/lib/imagem";
import { criarClienteNavegador } from "@/lib/supabase/client";
import type { PerfilUsuario, Servico } from "@/types";

const TIPOS_FOTO = ["image/jpeg", "image/png", "image/webp"];

/**
 * Botão circular flutuante (canto inferior direito) que abre o Perfil do
 * Usuário em um bottom sheet sobre a tela atual (tela 5).
 */
export function PerfilFlutuante({
  perfil,
  servicos,
}: {
  perfil: PerfilUsuario;
  servicos: Servico[];
}) {
  const [aberto, setAberto] = useState(false);
  const fechar = useCallback(() => setAberto(false), []);

  return (
    <>
      {/* camada fixa na viewport: mantém o perfil no canto inferior direito, longe do botão + */}
      <div className="pointer-events-none fixed inset-0 z-30">
        <button
          type="button"
          onClick={() => setAberto(true)}
          aria-label="Abrir perfil"
          aria-haspopup="dialog"
          className="bg-gradiente-botao pointer-events-auto absolute right-[1.6rem] bottom-[max(1.25rem,env(safe-area-inset-bottom))] grid size-[3.9rem] place-items-center rounded-full text-white shadow-[0_6px_16px_rgba(60,56,207,0.35)]"
        >
          <IconeUsuario className="size-[2rem]" />
        </button>
      </div>

      {aberto ? (
        <FolhaPerfil perfil={perfil} servicos={servicos} aoFechar={fechar} />
      ) : null}
    </>
  );
}

function Avatar({
  url,
  nome,
  className = "",
}: {
  url: string | null;
  nome: string;
  className?: string;
}) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={`Foto de ${nome}`}
        className={`${className} bg-avatar object-cover`}
      />
    );
  }
  return (
    <div className={`${className} bg-avatar grid place-items-center`} role="img" aria-label="Foto de perfil padrão">
      <IconeSilhueta className="w-[62%] text-white" />
    </div>
  );
}

function FolhaPerfil({
  perfil,
  servicos,
  aoFechar,
}: {
  perfil: PerfilUsuario;
  servicos: Servico[];
  aoFechar: () => void;
}) {
  const [modo, setModo] = useState<"ver" | "editar">("ver");
  const [menuAberto, setMenuAberto] = useState(false);
  const [editandoFavoritos, setEditandoFavoritos] = useState(false);
  const [escolhendo, setEscolhendo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const botaoFechar = useRef<HTMLButtonElement>(null);

  useModal(true, aoFechar);
  useEffect(() => {
    botaoFechar.current?.focus();
  }, []);

  const favoritos = perfil.favoritos;
  // grade de 3 colunas: no mínimo 6 posições e sempre pelo menos uma vazia
  const totalPosicoes = Math.max(6, Math.ceil((favoritos.length + 1) / 3) * 3);
  const vazios = totalPosicoes - favoritos.length;
  const candidatos = servicos.filter(
    (s) => !favoritos.some((f) => f.id === s.id),
  );

  function adicionar(id: string) {
    setErro(null);
    iniciar(async () => {
      const resultado = await adicionarFavorito(id);
      if (resultado.erro) setErro(resultado.erro);
      else setEscolhendo(false);
    });
  }

  function remover(id: string) {
    setErro(null);
    iniciar(async () => {
      const resultado = await removerFavorito(id);
      if (resultado.erro) setErro(resultado.erro);
    });
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center">
      {/* fundo escurecido: tocar fecha o perfil */}
      <button
        type="button"
        tabIndex={-1}
        aria-label="Fechar perfil"
        onClick={aoFechar}
        className="absolute inset-0 bg-black/30"
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="perfil-titulo"
        className="relative max-h-[90dvh] w-full max-w-[430px] overflow-y-auto bg-fundo"
      >
        {/* barra de título */}
        <div className="bg-roxo-escuro relative flex h-[3.4rem] items-center justify-center text-white">
          <h2 id="perfil-titulo" className="text-base">
            Perfil do Usuário
          </h2>
          <button
            ref={botaoFechar}
            type="button"
            onClick={aoFechar}
            aria-label="Fechar perfil"
            className="absolute top-1/2 right-[0.6rem] grid size-11 -translate-y-1/2 place-items-center"
          >
            <span className="bg-avatar grid size-[1.9rem] place-items-center rounded-full">
              <IconeChevron className="size-[1.1rem] rotate-180" />
            </span>
          </button>
        </div>

        {modo === "editar" ? (
          <EditarPerfil perfil={perfil} aoConcluir={() => setModo("ver")} />
        ) : (
          <>
            {/* nome (faixa escura) e dados (faixa branca); o avatar cruza as duas */}
            <div className="relative">
              <Avatar
                url={perfil.avatarUrl}
                nome={perfil.nome}
                className="absolute top-0 left-[1.5rem] size-[8.6rem] rounded-[1.2rem]"
              />

              <div className="bg-roxo-escuro flex h-[3.1rem] items-center justify-between pr-[0.5rem] pl-[10.9rem] text-white">
                <p className="truncate text-base">{perfil.nome || perfil.usuario}</p>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setMenuAberto((v) => !v)}
                    aria-label="Opções do perfil"
                    aria-haspopup="menu"
                    aria-expanded={menuAberto}
                    className="grid size-11 place-items-center"
                  >
                    <IconeTresPontos className="size-[1.2rem]" />
                  </button>
                  {menuAberto ? (
                    <>
                      <button
                        type="button"
                        tabIndex={-1}
                        aria-label="Fechar menu"
                        className="fixed inset-0 z-10 cursor-default"
                        onClick={() => setMenuAberto(false)}
                      />
                      <ul
                        role="menu"
                        className="absolute top-full right-0 z-20 w-[11.5rem] overflow-hidden rounded-xl bg-white py-1 text-sm text-texto shadow-[0_8px_24px_rgba(0,0,0,0.25)]"
                      >
                        <li role="none">
                          <button
                            role="menuitem"
                            type="button"
                            className="alvo-toque block w-full px-4 text-left"
                            onClick={() => {
                              setMenuAberto(false);
                              setModo("editar");
                            }}
                          >
                            Editar perfil
                          </button>
                        </li>
                        <li role="none">
                          <button
                            role="menuitem"
                            type="button"
                            className="alvo-toque block w-full px-4 text-left"
                            onClick={() => {
                              setMenuAberto(false);
                              setEscolhendo(false);
                              setEditandoFavoritos((v) => !v);
                            }}
                          >
                            {editandoFavoritos ? "Concluir edição" : "Editar favoritos"}
                          </button>
                        </li>
                        {perfil.papel === "admin" ? (
                          <li role="none">
                            <Link
                              role="menuitem"
                              href="/admin"
                              className="alvo-toque flex items-center px-4"
                            >
                              Painel da loja
                            </Link>
                          </li>
                        ) : null}
                        <li role="none">
                          <form action={sair}>
                            <button
                              role="menuitem"
                              type="submit"
                              className="alvo-toque block w-full px-4 text-left"
                            >
                              Sair
                            </button>
                          </form>
                        </li>
                      </ul>
                    </>
                  ) : null}
                </div>
              </div>

              <div className="min-h-[6.2rem] space-y-[0.9rem] bg-white py-[0.9rem] pr-4 pl-[10.9rem] text-base leading-snug text-texto">
                <p className="break-words">
                  Telefone: {perfil.telefone || "não informado"}
                </p>
                <p className="break-all">Email: {perfil.email}</p>
              </div>
            </div>

            {/* favoritos */}
            <div className="border-t-[3px] border-[#d0d0d0] px-[1.8rem] pt-[0.9rem] pb-[max(1.2rem,env(safe-area-inset-bottom))]">
              <h3 className="mb-[0.7rem] text-sm text-texto">
                Agendamentos Favoritos:
              </h3>

              <ul className="grid grid-cols-3 gap-x-[1.2rem] gap-y-[0.6rem]">
                {favoritos.map((servico) => (
                  <li key={servico.id} className="relative">
                    {editandoFavoritos ? (
                      <button
                        type="button"
                        disabled={pendente}
                        onClick={() => remover(servico.id)}
                        aria-label={`Remover ${servico.nome} dos favoritos`}
                        className="bg-gradiente-botao alvo-toque flex w-full items-center justify-center gap-1 rounded-[0.6rem] px-1 text-center text-xs leading-tight text-white disabled:opacity-60"
                      >
                        <span aria-hidden="true">×</span>
                        {servico.nome}
                      </button>
                    ) : (
                      <Link
                        href={`/agenda/novo?servico=${servico.id}`}
                        onClick={aoFechar}
                        className="bg-gradiente-botao alvo-toque flex w-full items-center justify-center rounded-[0.6rem] px-1 text-center text-sm leading-tight text-white"
                      >
                        <span className={servico.nome.length > 12 ? "text-xs" : ""}>
                          {servico.nome}
                        </span>
                      </Link>
                    )}
                  </li>
                ))}

                {Array.from({ length: vazios }).map((_, i) => (
                  <li key={`vazio-${i}`}>
                    <button
                      type="button"
                      disabled={editandoFavoritos}
                      onClick={() => {
                        setErro(null);
                        setEscolhendo(true);
                      }}
                      aria-label="Adicionar um agendamento favorito"
                      className="bg-gradiente-botao alvo-toque w-full rounded-[0.6rem] text-sm text-white disabled:opacity-40"
                    >
                      […]
                    </button>
                  </li>
                ))}
              </ul>

              {escolhendo ? (
                <div className="mt-4 rounded-xl border-2 border-texto-suave bg-white p-3">
                  <p className="mb-2 text-sm text-texto">Escolha um serviço:</p>
                  {candidatos.length === 0 ? (
                    <p className="text-xs text-texto-suave">
                      Todos os serviços já estão nos seus favoritos.
                    </p>
                  ) : (
                    <ul className="flex flex-wrap gap-2">
                      {candidatos.map((servico) => (
                        <li key={servico.id}>
                          <button
                            type="button"
                            disabled={pendente}
                            onClick={() => adicionar(servico.id)}
                            className="alvo-toque rounded-xl border-2 border-texto px-3 text-sm text-texto disabled:opacity-60"
                          >
                            {servico.nome}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <button
                    type="button"
                    onClick={() => setEscolhendo(false)}
                    className="alvo-toque mt-2 text-sm text-texto underline"
                  >
                    Fechar
                  </button>
                </div>
              ) : null}

              {erro ? (
                <p role="alert" className="mt-3 text-xs text-ponto-vermelho">
                  {erro}
                </p>
              ) : null}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

/** Edição do perfil: foto (opcional), nome e telefone. */
function EditarPerfil({
  perfil,
  aoConcluir,
}: {
  perfil: PerfilUsuario;
  aoConcluir: () => void;
}) {
  const [estado, acao, pendente] = useActionState<EstadoForm, FormData>(
    atualizarPerfil,
    {},
  );
  const [enviando, setEnviando] = useState(false);
  const [erroFoto, setErroFoto] = useState<string | null>(null);

  useEffect(() => {
    if (estado.sucesso) aoConcluir();
  }, [estado, aoConcluir]);

  const valores = estado.valores ?? {};
  const erros = estado.erros ?? {};

  async function aoEscolherFoto(evento: ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0];
    evento.target.value = "";
    if (!arquivo) return;
    if (!TIPOS_FOTO.includes(arquivo.type)) {
      setErroFoto("Use uma imagem JPG, PNG ou WebP.");
      return;
    }

    setEnviando(true);
    setErroFoto(null);
    try {
      const imagem = await reduzirImagem(arquivo);
      const caminho = `${perfil.id}/avatar-${Date.now()}.jpg`;
      const supabase = criarClienteNavegador();
      const { error } = await supabase.storage
        .from("avatares")
        .upload(caminho, imagem, { contentType: "image/jpeg", upsert: false });
      if (error) throw error;

      const resultado = await definirAvatar(caminho);
      if (resultado.erro) throw new Error(resultado.erro);
    } catch {
      setErroFoto("Não foi possível enviar a foto. Tente outra imagem.");
    } finally {
      setEnviando(false);
    }
  }

  async function aoRemoverFoto() {
    setEnviando(true);
    setErroFoto(null);
    const resultado = await removerAvatar();
    if (resultado.erro) setErroFoto(resultado.erro);
    setEnviando(false);
  }

  const classeCampo =
    "alvo-toque w-full rounded-xl border-2 border-texto bg-white px-3 text-sm text-texto";

  return (
    <div className="space-y-4 px-[1.8rem] py-[1.2rem] pb-[max(1.4rem,env(safe-area-inset-bottom))]">
      <div className="flex items-center gap-4">
        <Avatar
          url={perfil.avatarUrl}
          nome={perfil.nome}
          className="size-[6rem] shrink-0 rounded-[1rem]"
        />
        <div className="flex flex-col items-start gap-1 text-sm text-texto">
          <label className="alvo-toque inline-flex cursor-pointer items-center underline">
            {enviando ? "Enviando…" : "Trocar foto"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              disabled={enviando}
              onChange={aoEscolherFoto}
            />
          </label>
          {perfil.avatarUrl ? (
            <button
              type="button"
              onClick={aoRemoverFoto}
              disabled={enviando}
              className="alvo-toque underline disabled:opacity-60"
            >
              Remover foto
            </button>
          ) : null}
        </div>
      </div>
      {erroFoto ? (
        <p role="alert" className="text-xs text-ponto-vermelho">
          {erroFoto}
        </p>
      ) : null}

      <form action={acao} className="space-y-3">
        <div>
          <label htmlFor="perfil-nome" className="mb-1 block text-sm text-texto">
            Nome:
          </label>
          <input
            id="perfil-nome"
            name="nome"
            type="text"
            required
            maxLength={80}
            autoComplete="name"
            defaultValue={valores.nome ?? perfil.nome}
            aria-invalid={erros.nome ? true : undefined}
            className={classeCampo}
          />
          {erros.nome ? (
            <p role="alert" className="mt-1 text-xs text-ponto-vermelho">
              {erros.nome}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="perfil-telefone" className="mb-1 block text-sm text-texto">
            Telefone:
          </label>
          <input
            id="perfil-telefone"
            name="telefone"
            type="tel"
            inputMode="tel"
            required
            maxLength={20}
            autoComplete="tel"
            placeholder="(00) 00000-0000"
            defaultValue={valores.telefone ?? perfil.telefone ?? ""}
            aria-invalid={erros.telefone ? true : undefined}
            className={classeCampo}
          />
          {erros.telefone ? (
            <p role="alert" className="mt-1 text-xs text-ponto-vermelho">
              {erros.telefone}
            </p>
          ) : null}
        </div>

        {estado.erro ? (
          <p role="alert" className="text-xs text-ponto-vermelho">
            {estado.erro}
          </p>
        ) : null}

        <div className="flex gap-3 pt-1">
          <Botao type="submit" variante="gradiente" disabled={pendente || enviando} className="flex-1">
            {pendente ? "Salvando…" : "Salvar"}
          </Botao>
          <button
            type="button"
            onClick={aoConcluir}
            className="alvo-toque flex-1 rounded-xl border-2 border-texto text-sm text-texto"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
