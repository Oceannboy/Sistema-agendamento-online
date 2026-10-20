"use server";

import { revalidatePath } from "next/cache";
import { mensagemDeErro } from "@/lib/erros";
import { criarClienteServidor } from "@/lib/supabase/server";
import { errosPorCampo, esquemaId, esquemaPerfil } from "@/lib/validacao";
import type { EstadoForm } from "./tipos";

type Resultado = { erro?: string };

function texto(formData: FormData, campo: string): string {
  const valor = formData.get(campo);
  return typeof valor === "string" ? valor : "";
}

async function contexto() {
  const supabase = await criarClienteServidor();
  const { data } = await supabase.auth.getClaims();
  return { supabase, uid: data?.claims?.sub ?? null };
}

const ERRO_SESSAO = mensagemDeErro({ code: "AG009" });

function atualizarTelas() {
  revalidatePath("/agenda", "layout");
}

/** Tela 5: adiciona um serviço aos favoritos (o RLS só deixa nos da própria usuária). */
export async function adicionarFavorito(servicoId: string): Promise<Resultado> {
  if (!esquemaId.safeParse(servicoId).success) {
    return { erro: "Serviço inválido." };
  }
  const { supabase, uid } = await contexto();
  if (!uid) return { erro: ERRO_SESSAO };

  const { error } = await supabase
    .from("servicos_favoritos")
    .insert({ perfil_id: uid, servico_id: servicoId });

  // 23505 = já era favorito: tudo certo
  if (error && error.code !== "23505") {
    return { erro: "Não foi possível adicionar o favorito. Tente novamente." };
  }
  atualizarTelas();
  return {};
}

/** Tela 5: remove um favorito. */
export async function removerFavorito(servicoId: string): Promise<Resultado> {
  if (!esquemaId.safeParse(servicoId).success) {
    return { erro: "Serviço inválido." };
  }
  const { supabase, uid } = await contexto();
  if (!uid) return { erro: ERRO_SESSAO };

  const { error } = await supabase
    .from("servicos_favoritos")
    .delete()
    .eq("perfil_id", uid)
    .eq("servico_id", servicoId);

  if (error) {
    return { erro: "Não foi possível remover o favorito. Tente novamente." };
  }
  atualizarTelas();
  return {};
}

/** Tela 5: editar perfil (nome e telefone). */
export async function atualizarPerfil(
  _estado: EstadoForm,
  formData: FormData,
): Promise<EstadoForm> {
  const bruto = { nome: texto(formData, "nome"), telefone: texto(formData, "telefone") };
  const dados = esquemaPerfil.safeParse(bruto);
  if (!dados.success) {
    return { erros: errosPorCampo(dados.error), valores: bruto };
  }

  const { supabase, uid } = await contexto();
  if (!uid) return { erro: ERRO_SESSAO, valores: bruto };

  const { error } = await supabase
    .from("perfis")
    .update({ nome: dados.data.nome, telefone: dados.data.telefone })
    .eq("id", uid);

  if (error) {
    return { erro: "Não foi possível salvar o perfil. Tente novamente.", valores: bruto };
  }
  atualizarTelas();
  return { sucesso: "Perfil atualizado." };
}

/** Caminho do arquivo no bucket a partir da URL pública (ou null). */
function caminhoDoAvatar(url: string | null, uid: string): string | null {
  if (!url) return null;
  const marca = "/avatares/";
  const posicao = url.indexOf(marca);
  if (posicao < 0) return null;
  const caminho = url.slice(posicao + marca.length).split("?")[0];
  return caminho.startsWith(`${uid}/`) ? caminho : null;
}

/**
 * Tela 5: grava a foto enviada. O navegador sobe o arquivo direto para o
 * Storage (só na própria pasta, por política); aqui o servidor valida o
 * caminho, guarda a URL no perfil e apaga a foto anterior.
 */
export async function definirAvatar(caminho: string): Promise<Resultado> {
  const { supabase, uid } = await contexto();
  if (!uid) return { erro: ERRO_SESSAO };
  if (
    typeof caminho !== "string" ||
    caminho.length > 200 ||
    caminho.includes("..") ||
    !caminho.startsWith(`${uid}/`)
  ) {
    return { erro: "Arquivo inválido." };
  }

  const { data: atual } = await supabase
    .from("perfis")
    .select("avatar_url")
    .eq("id", uid)
    .maybeSingle();

  const { data: publico } = supabase.storage.from("avatares").getPublicUrl(caminho);
  const { error } = await supabase
    .from("perfis")
    .update({ avatar_url: publico.publicUrl })
    .eq("id", uid);
  if (error) return { erro: "Não foi possível salvar a foto. Tente novamente." };

  const anterior = caminhoDoAvatar(atual?.avatar_url ?? null, uid);
  if (anterior && anterior !== caminho) {
    await supabase.storage.from("avatares").remove([anterior]);
  }
  atualizarTelas();
  return {};
}

/** Tela 5: volta para o avatar padrão. */
export async function removerAvatar(): Promise<Resultado> {
  const { supabase, uid } = await contexto();
  if (!uid) return { erro: ERRO_SESSAO };

  const { data: atual } = await supabase
    .from("perfis")
    .select("avatar_url")
    .eq("id", uid)
    .maybeSingle();

  const { error } = await supabase
    .from("perfis")
    .update({ avatar_url: null })
    .eq("id", uid);
  if (error) return { erro: "Não foi possível remover a foto. Tente novamente." };

  const anterior = caminhoDoAvatar(atual?.avatar_url ?? null, uid);
  if (anterior) await supabase.storage.from("avatares").remove([anterior]);
  atualizarTelas();
  return {};
}
