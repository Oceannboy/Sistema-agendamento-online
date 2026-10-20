"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ehConflitoDeHorario, mensagemDeErro } from "@/lib/erros";
import { criarClienteServidor } from "@/lib/supabase/server";
import {
  errosPorCampo,
  esquemaAgendamento,
  esquemaId,
} from "@/lib/validacao";
import type { EstadoForm } from "./tipos";

function texto(formData: FormData, campo: string): string {
  const valor = formData.get(campo);
  return typeof valor === "string" ? valor : "";
}

/** Para onde voltar depois de salvar/cancelar (só "/admin" é aceito além da lista). */
function destinoDepois(formData: FormData): string {
  return texto(formData, "retorno") === "/admin" ? "/admin" : "/agenda";
}

/**
 * Tela 4: salvar. Sem id = criar (criar_agendamento); com id = remarcar
 * (remarcar_agendamento). Todas as regras (expediente, bloqueio, conflito,
 * antecedência, prazo) são validadas no banco, nunca só na tela.
 */
export async function salvarAgendamento(
  _estado: EstadoForm,
  formData: FormData,
): Promise<EstadoForm> {
  const dados = esquemaAgendamento.safeParse({
    id: texto(formData, "id") || undefined,
    servico: texto(formData, "servico"),
    inicio: texto(formData, "inicio"),
    titulo: texto(formData, "titulo"),
  });
  if (!dados.success) {
    const primeiro = Object.values(errosPorCampo(dados.error))[0];
    return { erro: primeiro ?? "Confira os dados e tente novamente." };
  }

  const { id, servico, inicio, titulo } = dados.data;
  const supabase = await criarClienteServidor();

  // título vazio: o banco usa o nome do serviço
  const { error } = id
    ? await supabase.rpc("remarcar_agendamento", {
        p_id: id,
        p_servico: servico,
        p_inicio: inicio,
        p_titulo: titulo ?? "",
      })
    : await supabase.rpc("criar_agendamento", {
        p_servico: servico,
        p_inicio: inicio,
        p_titulo: titulo ?? "",
      });

  if (error) {
    return { erro: mensagemDeErro(error), conflito: ehConflitoDeHorario(error) };
  }

  revalidatePath("/agenda", "layout");
  revalidatePath("/admin", "layout");
  redirect(destinoDepois(formData));
}

/** Tela 4 (modo edição): cancelar o agendamento (respeita o prazo no banco). */
export async function cancelarAgendamentoAcao(
  _estado: EstadoForm,
  formData: FormData,
): Promise<EstadoForm> {
  const id = esquemaId.safeParse(texto(formData, "id"));
  if (!id.success) return { erro: "Agendamento não encontrado." };

  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("cancelar_agendamento", {
    p_id: id.data,
  });
  if (error) return { erro: mensagemDeErro(error) };

  revalidatePath("/agenda", "layout");
  revalidatePath("/admin", "layout");
  redirect(destinoDepois(formData));
}
