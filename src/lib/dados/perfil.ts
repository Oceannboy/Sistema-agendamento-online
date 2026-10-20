import "server-only";
import { cache } from "react";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { PerfilUsuario, Servico } from "@/types";

type LinhaFavorito = {
  servicos: (Servico & { ativo: boolean }) | null;
};

/**
 * Perfil da usuária logada (com e-mail e favoritos ativos).
 * Devolve null se não houver sessão. O cache evita repetir a consulta na
 * mesma requisição.
 */
export const obterPerfil = cache(async (): Promise<PerfilUsuario | null> => {
  const supabase = await criarClienteServidor();
  const { data: dadosClaims } = await supabase.auth.getClaims();
  const claims = dadosClaims?.claims;
  if (!claims?.sub) return null;

  const [perfil, favoritos] = await Promise.all([
    supabase
      .from("perfis")
      .select("id, nome, usuario, telefone, avatar_url, papel")
      .eq("id", claims.sub)
      .maybeSingle(),
    supabase
      .from("servicos_favoritos")
      .select("servicos(id, nome, descricao, preco, duracao_min, ativo)")
      .eq("perfil_id", claims.sub),
  ]);

  if (perfil.error || favoritos.error) {
    throw new Error("Não foi possível carregar o perfil.");
  }
  if (!perfil.data) return null;

  const lista = ((favoritos.data ?? []) as unknown as LinhaFavorito[])
    .map((linha) => linha.servicos)
    .filter((s): s is Servico & { ativo: boolean } => Boolean(s?.ativo))
    .map(({ id, nome, descricao, preco, duracao_min }) => ({
      id,
      nome,
      descricao,
      preco,
      duracao_min,
    }))
    .sort((a, b) => a.duracao_min - b.duracao_min || a.nome.localeCompare(b.nome));

  return {
    id: perfil.data.id,
    nome: perfil.data.nome,
    usuario: perfil.data.usuario,
    telefone: perfil.data.telefone,
    avatarUrl: perfil.data.avatar_url,
    papel: perfil.data.papel === "admin" ? "admin" : "cliente",
    email: (claims as { email?: string }).email ?? "",
    favoritos: lista,
  };
});
