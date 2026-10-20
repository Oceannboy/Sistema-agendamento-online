import type { NextRequest } from "next/server";
import { atualizarSessao } from "@/lib/supabase/proxy";

/**
 * Next.js 16: o antigo middleware.ts passou a se chamar proxy.ts.
 * Com a pasta src/, este arquivo precisa ficar em src/proxy.ts.
 */
export async function proxy(request: NextRequest) {
  return atualizarSessao(request);
}

export const config = {
  matcher: [
    // tudo, exceto arquivos estáticos, ícones e o manifest do PWA
    "/((?!_next/static|_next/image|favicon.ico|icons/|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
