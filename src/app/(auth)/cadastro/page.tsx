import type { Metadata } from "next";
import Link from "next/link";
import { FormCadastro } from "@/components/auth/FormCadastro";
import { IlustracaoEsmalte } from "@/components/ui/IlustracaoEsmalte";
import { TelaGradiente } from "@/components/ui/TelaGradiente";

export const metadata: Metadata = { title: "Criar conta" };

/** Cadastro, no mesmo estilo da tela 2. */
export default function Cadastro() {
  return (
    <TelaGradiente>
      <div className="flex flex-1 flex-col items-center justify-center gap-2 py-4">
        <IlustracaoEsmalte className="w-[5.5rem]" />
        <FormCadastro />
      </div>
      <p className="pt-4 text-center text-xs text-white">
        Já possui uma conta? faça o{" "}
        <Link href="/login" className="inline-block px-1 py-2 font-semibold">
          login
        </Link>
      </p>
    </TelaGradiente>
  );
}
