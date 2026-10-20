import "server-only";
import { cache } from "react";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { Servico } from "@/types";

const COLUNAS = "id, nome, descricao, preco, duracao_min";

/** Serviços ativos, do mais curto para o mais longo (Manicure, Pedicure, Manicure e Pedicure). */
export const obterServicosAtivos = cache(async (): Promise<Servico[]> => {
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("servicos")
    .select(COLUNAS)
    .eq("ativo", true)
    .order("duracao_min", { ascending: true })
    .order("nome", { ascending: true });

  if (error) throw new Error("Não foi possível carregar os serviços.");
  return (data ?? []) as Servico[];
});

/** Um serviço pelo id (mesmo inativo, se a cliente já o usou: ver RLS). */
export async function obterServicoPorId(id: string): Promise<Servico | null> {
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("servicos")
    .select(COLUNAS)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error("Não foi possível carregar o serviço.");
  return (data as Servico | null) ?? null;
}
