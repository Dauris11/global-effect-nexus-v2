"use client";

import { ChevronDown, Eye, Search, Undo2, UserSearch } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";

import { RolBadge } from "@/components/app/rol-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import type { Rol } from "@/lib/rbac";
import { ROLE_DESCRIPTION, ROLE_LABEL, rolesVerComo } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { buscarPersonasVerComo, type PersonaVerComo } from "@/server/auth/buscar-personas";
import { salirVerComoUsuario, verComoRol, verComoUsuario } from "@/server/auth/acciones";

/**
 * Control para mirar el sistema con los ojos de otro. Solo se pinta si el rol REAL lo permite
 * (`rolesVerComo`: owner y developer); las acciones lo vuelven a comprobar en el servidor, así que esconderlo
 * no es lo que protege.
 *
 * Dos modos, y solo uno a la vez:
 *   · «Ver como rol»: lo lista `rolesVerComo(rolReal)` (el developer también ve Propietario).
 *   · «Ver como usuario…» (solo developer): una persona concreta, con sus datos reales. Mientras dura, las
 *     acciones que escriben se bloquean (`exigirSinSuplantacion`); la barra lo dice para que nadie crea que
 *     la pantalla está rota.
 *
 * Mientras se «ve como», sale como franja fija encima de la cabecera: olvidar que se está en otro punto de
 * vista y creer que falta una función es el error que evita.
 */
export function VerComo({
  rol,
  rolReal,
  nombre,
  suplantando = false,
  escrituraSuplantada = false,
}: {
  rol: Rol;
  rolReal: Rol;
  /** Nombre de la persona suplantada (la sesión efectiva), solo con `suplantando`. */
  nombre?: string;
  suplantando?: boolean;
  /** `tecnico.impersonation_write` activo: lo que se haga se guarda, y el aviso lo dice. */
  escrituraSuplantada?: boolean;
}) {
  const t = useTranslations("verComo");
  const tRaiz = useTranslations();
  const [pendiente, iniciar] = useTransition();
  const [buscando, setBuscando] = useState(false);

  const roles = rolesVerComo(rolReal);

  if (roles.length === 0) return null;

  const puedeUsuario = rolReal === "developer";
  const viendoOtro = suplantando || rol !== rolReal;
  const cambiar = (destino: Rol) => iniciar(() => verComoRol(destino));

  const menu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="md" cargando={pendiente} className="gap-1.5">
          <Eye className="size-4" aria-hidden />
          {viendoOtro ? t("cambiar") : t("label")}
          <ChevronDown className="size-4" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>{t("rolesSection")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {roles.map((r) => (
          <DropdownMenuItem
            key={r}
            onSelect={() => cambiar(r)}
            aria-current={!suplantando && r === rol ? "true" : undefined}
            className={cn("flex-col items-start gap-0.5", !suplantando && r === rol && "text-marca-700 font-medium")}
          >
            <span>{tRaiz(ROLE_LABEL[r])}</span>
            <span className="text-meta line-clamp-2 font-normal">{tRaiz(ROLE_DESCRIPTION[r])}</span>
          </DropdownMenuItem>
        ))}
        {puedeUsuario && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setBuscando(true)}>
              <UserSearch aria-hidden />
              {t("usuario")}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const selector = puedeUsuario ? <BuscadorPersonas abierto={buscando} alCambiar={setBuscando} /> : null;

  if (!viendoOtro) {
    return (
      <>
        {menu}
        {selector}
      </>
    );
  }

  return (
    <div
      role="status"
      data-impersonation-bar
      className="bg-tinta text-background sticky top-0 z-50 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 px-4 py-2 text-sm"
    >
      <Eye className="size-4 shrink-0" aria-hidden />
      <span>
        {suplantando
          ? t(escrituraSuplantada ? "viendoUsuarioEscribe" : "viendoUsuario", { nombre: nombre ?? "" })
          : t("viendo", { rol: tRaiz(ROLE_LABEL[rol]) })}
      </span>
      <div className="flex items-center gap-2">
        {menu}
        {suplantando ? (
          <Button size="sm" onClick={() => iniciar(() => salirVerComoUsuario())} cargando={pendiente} className="gap-1.5">
            <Undo2 className="size-4" aria-hidden />
            {t("exit")}
          </Button>
        ) : (
          <Button size="sm" onClick={() => cambiar(rolReal)} cargando={pendiente} className="gap-1.5">
            <Undo2 className="size-4" aria-hidden />
            {t("volver")}
          </Button>
        )}
      </div>
      {selector}
    </div>
  );
}

/**
 * Diálogo con buscador de personas. La lista llega de una acción protegida por `tecnico.dev_panel`, filtrada en
 * SQL y con retardo de 250 ms al teclear: no se trae a todo el personal al navegador ni se consulta por letra.
 */
function BuscadorPersonas({ abierto, alCambiar }: { abierto: boolean; alCambiar: (abierto: boolean) => void }) {
  const t = useTranslations("verComo");
  const [texto, setTexto] = useState("");
  const [personas, setPersonas] = useState<PersonaVerComo[] | null>(null);
  const [fallo, setFallo] = useState(false);
  const [eligiendo, elegir] = useTransition();

  useEffect(() => {
    if (!abierto) return;

    let vigente = true;
    const espera = setTimeout(() => {
      buscarPersonasVerComo(texto).then(
        (filas) => {
          if (!vigente) return;
          setPersonas(filas);
          setFallo(false);
        },
        () => vigente && setFallo(true),
      );
    }, texto ? 250 : 0);

    return () => {
      vigente = false;
      clearTimeout(espera);
    };
  }, [abierto, texto]);

  return (
    <Dialog open={abierto} onOpenChange={alCambiar}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("userSection")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-4">
          <div className="relative">
            <Search aria-hidden className="text-tinta-3 pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              type="search"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder={t("userSearch")}
              aria-label={t("userSearch")}
              className="pl-9"
              autoFocus
            />
          </div>

          {fallo ? (
            <p role="alert" className="text-meta py-6 text-center">
              {t("userError")}
            </p>
          ) : personas === null ? (
            <p className="text-meta py-6 text-center">{t("userSearching")}</p>
          ) : personas.length === 0 ? (
            <p className="text-meta py-6 text-center">{t("userEmpty")}</p>
          ) : (
            <ul role="listbox" aria-label={t("userSection")} className="max-h-80 divide-y divide-linea overflow-y-auto rounded-control border border-linea">
              {personas.map((p) => (
                <li key={p.id} role="option" aria-selected={false}>
                  <button
                    type="button"
                    disabled={eligiendo}
                    onClick={() => elegir(() => verComoUsuario(p.id))}
                    className="flex min-h-11 w-full items-center justify-between gap-3 px-3 py-2 text-left transicion-control hover:bg-muted focus-visible:bg-muted focus-visible:outline-none disabled:opacity-50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-tinta">{p.nombre}</span>
                      <span className="text-meta block truncate">{p.email}</span>
                    </span>
                    <RolBadge rol={p.rol} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
