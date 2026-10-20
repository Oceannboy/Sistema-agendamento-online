import { createBrowserClient } from "@supabase/ssr";
import { obterConfigPublica } from "./env";

/**
 * Cliente do Supabase para componentes de cliente (navegador).
 * Usa só a chave pública; a segurança real está no RLS do banco.
 */
export function criarClienteNavegador() {
  const { url, chave } = obterConfigPublica();
  return createBrowserClient(url, chave);
}
