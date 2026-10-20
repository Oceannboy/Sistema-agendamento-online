"use client";

import { useActionState } from "react";
import { cadastrar } from "@/lib/acoes/auth";
import type { EstadoForm } from "@/lib/acoes/tipos";
import { Botao, BotaoLink } from "@/components/ui/Botao";
import { CampoAuth } from "@/components/ui/CampoAuth";

/** Cadastro: nome, usuário, e-mail, telefone e senha, no estilo da tela 2. */
export function FormCadastro() {
  const [estado, acao, pendente] = useActionState<EstadoForm, FormData>(
    cadastrar,
    {},
  );

  if (estado.sucesso) {
    return (
      <div className="flex w-full max-w-[16rem] flex-col items-center gap-4 text-center">
        <p role="status" className="text-sm leading-relaxed text-white">
          {estado.sucesso}
        </p>
        <BotaoLink href="/login" className="w-[8.3rem]">
          Ir para o login
        </BotaoLink>
      </div>
    );
  }

  const erros = estado.erros ?? {};
  const valores = estado.valores ?? {};

  return (
    <form action={acao} className="flex w-full max-w-[16rem] flex-col items-center gap-3">
      <CampoAuth
        id="nome"
        rotulo="Nome:"
        type="text"
        placeholder='Exemplo: "Maria Silva"'
        autoComplete="name"
        required
        maxLength={80}
        defaultValue={valores.nome ?? ""}
        erro={erros.nome}
      />
      <CampoAuth
        id="usuario"
        rotulo="Usuário:"
        type="text"
        placeholder='Exemplo: "maria"'
        autoComplete="username"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        required
        maxLength={20}
        defaultValue={valores.usuario ?? ""}
        erro={erros.usuario}
      />
      <CampoAuth
        id="email"
        rotulo="E-mail:"
        type="email"
        inputMode="email"
        placeholder="maria@email.com"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        required
        defaultValue={valores.email ?? ""}
        erro={erros.email}
      />
      <CampoAuth
        id="telefone"
        rotulo="Telefone:"
        type="tel"
        inputMode="tel"
        placeholder="(00) 00000-0000"
        autoComplete="tel"
        required
        maxLength={20}
        defaultValue={valores.telefone ?? ""}
        erro={erros.telefone}
      />
      <CampoAuth
        id="senha"
        rotulo="Senha:"
        type="password"
        placeholder="Mínimo de 8 caracteres"
        autoComplete="new-password"
        required
        minLength={8}
        maxLength={72}
        erro={erros.senha}
      />

      <div aria-live="polite" className="min-h-5 w-full text-center">
        {estado.erro ? (
          <p role="alert" className="text-xs text-[#ffe0e0]">
            {estado.erro}
          </p>
        ) : null}
      </div>

      <Botao type="submit" className="w-[8.3rem]" disabled={pendente}>
        {pendente ? "Criando…" : "Criar conta"}
      </Botao>
    </form>
  );
}
