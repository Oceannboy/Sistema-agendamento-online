import type { Metadata } from "next";
import Link from "next/link";
import { FormLogin } from "@/components/auth/FormLogin";
import { IlustracaoEsmalte } from "@/components/ui/IlustracaoEsmalte";
import { TelaGradiente } from "@/components/ui/TelaGradiente";

export const metadata: Metadata = { title: "Entrar" };

/** Tela 2: login. */
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parametros = await searchParams;
  const falhaNaConfirmacao = parametros.erro === "confirmacao";

  return (
    <TelaGradiente>
      <div className="flex flex-1 flex-col items-center justify-center gap-2">
        <IlustracaoEsmalte className="w-[7.2rem]" />
        {falhaNaConfirmacao ? (
          <p
            role="alert"
            className="max-w-[16rem] text-center text-xs leading-snug text-[#ffe0e0]"
          >
            Não foi possível confirmar o seu e-mail: o link pode ter expirado.
            Tente entrar; se não conseguir, peça ajuda à loja.
          </p>
        ) : null}
        <FormLogin />
      </div>
      <p className="pt-6 text-center text-xs text-white">
        Ainda não possui uma conta? faça o{" "}
        <Link href="/cadastro" className="inline-block px-1 py-2 font-semibold">
          cadastro
        </Link>
      </p>
    </TelaGradiente>
  );
}
