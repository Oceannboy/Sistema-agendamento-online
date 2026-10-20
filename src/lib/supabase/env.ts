/**
 * Variáveis PÚBLICAS do Supabase (podem ir para o navegador).
 * As NEXT_PUBLIC_* precisam ser referenciadas literalmente (sem process.env[x])
 * para o Next.js embuti-las no bundle do navegador.
 *
 * Aceita a chave "publishable" (atual) ou a "anon" (legada, citada na proposta).
 */
const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const CHAVE_PUBLICA =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function obterConfigPublica(): { url: string; chave: string } {
  if (!URL_SUPABASE || !CHAVE_PUBLICA) {
    throw new Error(
      "Variáveis do Supabase ausentes. Copie .env.example para .env.local e preencha " +
        "NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY " +
        "(ou NEXT_PUBLIC_SUPABASE_ANON_KEY).",
    );
  }
  return { url: URL_SUPABASE, chave: CHAVE_PUBLICA };
}
