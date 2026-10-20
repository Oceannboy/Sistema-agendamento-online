import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { criarClienteServidor } from "@/lib/supabase/server";

const TIPOS_ACEITOS: EmailOtpType[] = [
  "signup",
  "email",
  "recovery",
  "invite",
  "magiclink",
  "email_change",
];

/**
 * Destino do link do e-mail de confirmação de cadastro (veja
 * supabase/email-templates/confirmar-cadastro.html). Troca o token do link
 * por uma sessão e leva a cliente para a agenda.
 * Só é necessário se a confirmação de e-mail estiver LIGADA no Supabase.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const tipo = searchParams.get("type") as EmailOtpType | null;

  if (tokenHash && tipo && TIPOS_ACEITOS.includes(tipo)) {
    const supabase = await criarClienteServidor();
    const { error } = await supabase.auth.verifyOtp({
      type: tipo,
      token_hash: tokenHash,
    });
    if (!error) return NextResponse.redirect(new URL("/agenda", origin));
  }

  return NextResponse.redirect(new URL("/login?erro=confirmacao", origin));
}
