import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Cliente com a chave SECRETA (service_role). IGNORA o RLS.
 *
 * Regras:
 *  - só pode ser importado em código de servidor (o "server-only" acima faz o
 *    build falhar se alguém importar num componente de cliente);
 *  - a chave NUNCA tem o prefixo NEXT_PUBLIC_ e nunca vai para o repositório;
 *  - use o mínimo possível: hoje só para resolver usuário -> e-mail no login e
 *    checar se o usuário está livre no cadastro.
 */
export function criarClienteAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chaveSecreta =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !chaveSecreta) {
    throw new Error(
      "Chave secreta do Supabase ausente. Defina SUPABASE_SECRET_KEY " +
        "(ou SUPABASE_SERVICE_ROLE_KEY) no .env.local / variáveis da Vercel.",
    );
  }

  return createClient(url, chaveSecreta, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
