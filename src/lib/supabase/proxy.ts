import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { obterConfigPublica } from "./env";

/** Telas que só fazem sentido para quem NÃO está logada. */
const ROTAS_SO_DESLOGADA = ["/", "/login", "/cadastro"];

/** Áreas que exigem login. /admin exige, além disso, o papel de admin. */
const PREFIXOS_PROTEGIDOS = ["/agenda", "/admin"];

/**
 * Renova a sessão do Supabase a cada requisição e aplica o redirecionamento
 * de quem está (ou não) logada. É só conforto de navegação: a segurança real
 * fica no RLS e nas RPCs do banco.
 */
export async function atualizarSessao(request: NextRequest) {
  let resposta = NextResponse.next({ request });
  const { url, chave } = obterConfigPublica();

  const supabase = createServerClient(url, chave, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(lista, headers?: Record<string, string>) {
        lista.forEach(({ name, value }) => request.cookies.set(name, value));
        resposta = NextResponse.next({ request });
        lista.forEach(({ name, value, options }) =>
          resposta.cookies.set(name, value, options),
        );
        // Cabeçalhos de cache enviados pela biblioteca (evitam que um CDN
        // guarde uma resposta com Set-Cookie).
        Object.entries(headers ?? {}).forEach(([chaveHeader, valor]) =>
          resposta.headers.set(chaveHeader, valor),
        );
      },
    },
  });

  // getClaims() valida o JWT e renova a sessão quando preciso.
  // Nunca confie em getSession() no servidor.
  const { data } = await supabase.auth.getClaims();
  const logada = Boolean(data?.claims?.sub);
  const { pathname } = request.nextUrl;

  const protegida = PREFIXOS_PROTEGIDOS.some(
    (prefixo) => pathname === prefixo || pathname.startsWith(`${prefixo}/`),
  );

  if (!logada && protegida) {
    return redirecionar(request, "/login", resposta);
  }
  if (logada && ROTAS_SO_DESLOGADA.includes(pathname)) {
    return redirecionar(request, "/agenda", resposta);
  }

  // /admin: só quem tem papel "admin". A consulta passa pelo RLS (cada pessoa
  // só lê o próprio perfil). É conforto de navegação; o RLS e as RPCs é que
  // protegem os dados de verdade.
  if (logada && (pathname === "/admin" || pathname.startsWith("/admin/"))) {
    const { data: perfil } = await supabase
      .from("perfis")
      .select("papel")
      .eq("id", data?.claims?.sub)
      .maybeSingle();
    if (perfil?.papel !== "admin") {
      return redirecionar(request, "/agenda", resposta);
    }
  }
  return resposta;
}

/** Redireciona preservando os cookies de sessão recém-renovados. */
function redirecionar(
  request: NextRequest,
  destino: string,
  origem: NextResponse,
) {
  const url = request.nextUrl.clone();
  url.pathname = destino;
  url.search = "";

  const redirecionamento = NextResponse.redirect(url);
  origem.cookies
    .getAll()
    .forEach((cookie) => redirecionamento.cookies.set(cookie));

  const cache = origem.headers.get("cache-control");
  if (cache) redirecionamento.headers.set("cache-control", cache);

  return redirecionamento;
}
