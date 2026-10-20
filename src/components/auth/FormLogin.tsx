"use client";

import { useActionState } from "react";
import { entrar } from "@/lib/acoes/auth";
import type { EstadoForm } from "@/lib/acoes/tipos";
import { Botao } from "@/components/ui/Botao";
import { CampoAuth } from "@/components/ui/CampoAuth";

/** Tela 2: formulário de login por usuário (ou e-mail) e senha. */
export function FormLogin() {
  const [estado, acao, pendente] = useActionState<EstadoForm, FormData>(
    entrar,
    {},
  );

  return (
    <form action={acao} className="flex w-full max-w-[16rem] flex-col items-center gap-3">
      <CampoAuth
        id="identificador"
        rotulo="Usuário:"
        type="text"
        placeholder={'Exemplo: "Maria"….'}
        autoComplete="username"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        required
        defaultValue={estado.valores?.identificador ?? ""}
      />
      <CampoAuth
        id="senha"
        rotulo="Senha:"
        type="password"
        placeholder="**********"
        autoComplete="current-password"
        required
      />

      <div aria-live="polite" className="min-h-5 w-full text-center">
        {estado.erro ? (
          <p role="alert" className="text-xs text-[#ffe0e0]">
            {estado.erro}
          </p>
        ) : null}
      </div>

      <Botao type="submit" className="w-[8.3rem]" disabled={pendente}>
        {pendente ? "Entrando…" : "Entrar"}
      </Botao>
    </form>
  );
}
