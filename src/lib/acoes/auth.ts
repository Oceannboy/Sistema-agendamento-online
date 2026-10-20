"use server";

import { redirect } from "next/navigation";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { criarClienteServidor } from "@/lib/supabase/server";
import {
  errosPorCampo,
  esquemaCadastro,
  esquemaLogin,
} from "@/lib/validacao";
import type { EstadoForm } from "./tipos";

/** Mensagem única para qualquer falha de login (evita enumerar contas). */
const ERRO_LOGIN = "Usuário ou senha inválidos.";

function texto(formData: FormData, campo: string): string {
  const valor = formData.get(campo);
  return typeof valor === "string" ? valor : "";
}

/**
 * Descobre o e-mail da conta a partir do que a pessoa digitou:
 *  - com "@": já é o e-mail;
 *  - sem "@": é o usuário. A busca usa a chave secreta, só no servidor.
 * Devolve null quando o usuário não existe (o chamador não deve revelar isso).
 */
async function resolverEmail(identificador: string): Promise<string | null> {
  const valor = identificador.trim().toLowerCase();
  if (valor.includes("@")) return valor;

  const admin = criarClienteAdmin();
  const { data: perfil } = await admin
    .from("perfis")
    .select("id")
    .eq("usuario", valor)
    .maybeSingle();
  if (!perfil) return null;

  const { data } = await admin.auth.admin.getUserById(perfil.id);
  return data.user?.email ?? null;
}

/** Tela 2: entrar com usuário (ou e-mail) e senha. */
export async function entrar(
  _estado: EstadoForm,
  formData: FormData,
): Promise<EstadoForm> {
  const bruto = {
    identificador: texto(formData, "identificador"),
    senha: texto(formData, "senha"),
  };

  const dados = esquemaLogin.safeParse(bruto);
  if (!dados.success) {
    return {
      erro: "Preencha o usuário e a senha.",
      valores: { identificador: bruto.identificador },
    };
  }

  const email = await resolverEmail(dados.data.identificador);
  const supabase = await criarClienteServidor();

  // Mesmo quando o usuário não existe fazemos uma tentativa de login "no
  // vazio": assim o tempo de resposta não revela se a conta existe.
  const { error } = await supabase.auth.signInWithPassword({
    email: email ?? "conta.inexistente@exemplo.invalid",
    password: dados.data.senha,
  });

  if (error || !email) {
    return {
      erro: ERRO_LOGIN,
      valores: { identificador: dados.data.identificador },
    };
  }

  redirect("/agenda");
}

/** Tela de cadastro: cria a conta (o perfil nasce pelo trigger handle_new_user). */
export async function cadastrar(
  _estado: EstadoForm,
  formData: FormData,
): Promise<EstadoForm> {
  const bruto = {
    nome: texto(formData, "nome"),
    usuario: texto(formData, "usuario"),
    email: texto(formData, "email"),
    telefone: texto(formData, "telefone"),
    senha: texto(formData, "senha"),
  };
  // Valores devolvidos para repovoar o formulário: nunca a senha.
  const valores = {
    nome: bruto.nome,
    usuario: bruto.usuario,
    email: bruto.email,
    telefone: bruto.telefone,
  };

  const dados = esquemaCadastro.safeParse(bruto);
  if (!dados.success) {
    return { erros: errosPorCampo(dados.error), valores };
  }
  const { nome, usuario, email, telefone, senha } = dados.data;

  // O usuário precisa ser único: confere antes (a constraint do banco é a
  // proteção final se duas pessoas escolherem o mesmo ao mesmo tempo).
  const admin = criarClienteAdmin();
  const { data: livre, error: erroConsulta } = await admin.rpc(
    "usuario_disponivel",
    { p_usuario: usuario },
  );
  if (erroConsulta) {
    return {
      erro: "Não foi possível concluir o cadastro agora. Tente novamente.",
      valores,
    };
  }
  if (!livre) {
    return { erros: { usuario: "Esse usuário já está em uso." }, valores };
  }

  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.auth.signUp({
    email,
    password: senha,
    options: { data: { nome, usuario, telefone } },
  });

  if (error) {
    if (error.code === "weak_password") {
      return {
        erros: {
          senha: "Senha fraca. Misture letras, números e símbolos.",
        },
        valores,
      };
    }
    if (error.status === 429 || error.code?.includes("rate_limit")) {
      return {
        erro: "Muitas tentativas. Aguarde alguns minutos e tente de novo.",
        valores,
      };
    }
    if (error.message?.includes("Database error saving new user")) {
      // o trigger do banco recusou: quase sempre usuário repetido (corrida)
      return { erros: { usuario: "Esse usuário já está em uso." }, valores };
    }
    return {
      erro:
        "Não foi possível criar a conta com esses dados. " +
        "Se você já tem cadastro, tente entrar.",
      valores,
    };
  }

  // Confirmação de e-mail desligada: a sessão já nasce ativa.
  if (data.session) redirect("/agenda");

  // Confirmação de e-mail ligada (Etapa 6): precisa confirmar antes de entrar.
  return {
    sucesso:
      "Conta criada! Enviamos um e-mail de confirmação. " +
      "Confirme o e-mail para poder entrar.",
  };
}

/** Sair da conta. */
export async function sair(): Promise<void> {
  const supabase = await criarClienteServidor();
  await supabase.auth.signOut();
  redirect("/login");
}
