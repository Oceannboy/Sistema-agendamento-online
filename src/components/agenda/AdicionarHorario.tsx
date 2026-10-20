import Form from "next/form";
import { IconeMais } from "@/components/ui/Icones";

/**
 * Última linha da tela 3: o texto digitado vira o Título e abre a tela 4 em
 * modo criação (GET /agenda/novo?titulo=...). Funciona até sem JavaScript.
 */
export function AdicionarHorario() {
  return (
    <Form action="/agenda/novo" className="relative">
      <div className="flex min-h-[5.2rem] overflow-hidden rounded-xl border-2 border-texto-suave bg-white">
        <label htmlFor="novo-titulo" className="sr-only">
          Título do novo horário
        </label>
        <input
          id="novo-titulo"
          name="titulo"
          type="text"
          maxLength={60}
          autoComplete="off"
          placeholder="Adicionar novo horário…"
          className="min-w-0 flex-1 bg-transparent px-5 text-base text-texto placeholder:text-texto-suave"
        />
        <button
          type="submit"
          aria-label="Adicionar novo horário"
          className="bg-gradiente-botao grid w-[4.9rem] shrink-0 place-items-center text-white"
        >
          <IconeMais className="size-[2.1rem]" />
        </button>
      </div>
    </Form>
  );
}
