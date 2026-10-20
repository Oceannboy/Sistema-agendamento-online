import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { obterConfigPublica } from "./env";

/**
 * Cliente do Supabase para Server Components, Server Actions e Route Handlers.
 * Atua com a sessão da usuária (cookies), então o RLS continua valendo.
 */
export async function criarClienteServidor() {
  const cookieStore = await cookies();
  const { url, chave } = obterConfigPublica();

  return createServerClient(url, chave, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(lista) {
        try {
          lista.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Components não gravam cookies. Sem problema: o proxy
          // (src/proxy.ts) renova a sessão a cada requisição.
        }
      },
    },
  });
}
