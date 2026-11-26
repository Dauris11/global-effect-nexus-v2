"use client";

import { useActionState, useState } from "react";
import { Check, Copy, KeyRound, Loader2, Plus, Search, UserMinus, UserPlus, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { Rol } from "@/lib/rbac";
import {
  alternarCuenta,
  cambiarRol,
  crearCuenta,
  reiniciarAcceso,
  type EstadoCuenta,
} from "@/server/personal/acciones";
import type { PersonaDelEquipo } from "@/server/personal/consultas";

/**
 * Alta y gestión de cuentas del equipo.
 *
 * Los desplegables son `select` nativos y no el de shadcn, como el resto del
 * proyecto: funcionan sin JavaScript, el navegador ya sabe abrirlos con teclado
 * y en móvil salen con la rueda del sistema.
 *
 * La contraseña temporal se muestra una sola vez, al crear, y no vuelve a estar
 * disponible: la tiene Supabase Auth cifrada y aquí no queda copia. Por eso el
 * aviso se queda en pantalla hasta que se cierra a mano en lugar de
 * desvanecerse.
 */
export function GestionCuentas({
  equipo,
  roles,
  yo,
}: {
  equipo: readonly PersonaDelEquipo[];
  /** Roles asignables, ya filtrados en el servidor. */
  roles: readonly Rol[];
  /** Id de quien mira: su propia cuenta no se puede tocar desde aquí. */
  yo: string;
}) {
  const t = useTranslations("staff");
  const tRoles = useTranslations("roles");
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [rolFiltro, setRolFiltro] = useState<string>("todos");

  const q = busqueda.trim().toLowerCase();
  const visibles = equipo.filter((p) => {
    if (rolFiltro !== "todos" && p.rol !== rolFiltro) return false;
    if (q) {
      const enNombre = p.nombre.toLowerCase().includes(q);
      const enEmail = p.email.toLowerCase().includes(q);
      if (!enNombre && !enEmail) return false;
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {abierto ? (
        <Card>
          <CardContent className="pt-5">
            <CardTitle className="mb-4">
              <UserPlus className="size-4" />
              {t("newAccount")}
            </CardTitle>

            <FormularioAlta roles={roles} alCerrar={() => setAbierto(false)} />
          </CardContent>
        </Card>
      ) : (
        <Button type="button" onClick={() => setAbierto(true)}>
          <Plus className="size-4" />
          {t("newAccount")}
        </Button>
      )}

      <Card>
        <CardContent className="pt-5">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>{t("people")}</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-44 flex-1 sm:w-56">
                <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
                <Input
                  type="search"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder={t("searchPlaceholder")}
                  className="h-9 pl-8 text-sm"
                />
              </div>
              <select
                aria-label={t("column.role")}
                value={rolFiltro}
                onChange={(e) => setRolFiltro(e.target.value)}
                className="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 rounded-md border bg-card px-2.5 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
              >
                <option value="todos">{t("allRoles")}</option>
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {tRoles(r)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {visibles.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              {t("empty")}
            </p>
          ) : (
            <ul className="divide-y">
              {visibles.map((persona) => (
                <Fila
                  key={persona.id}
                  persona={persona}
                  roles={roles}
                  esYo={persona.id === yo}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/** Una persona: su rol en un desplegable y los botones de su estado. */
function Fila({
  persona,
  roles,
  esYo,
}: {
  persona: PersonaDelEquipo;
  roles: readonly Rol[];
  esYo: boolean;
}) {
  const t = useTranslations("staff");
  const tRoles = useTranslations("roles");
  const [estadoRol, cambiar, cambiando] = useActionState<EstadoCuenta, FormData>(
    cambiarRol,
    { estado: "inicial" },
  );

  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{persona.nombre}</p>
        <p className="text-muted-foreground truncate text-xs">
          {persona.email}
          {persona.tareas_abiertas > 0 && (
            <> · {t("column.load")}: {persona.tareas_abiertas}</>
          )}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {!persona.puede_entrar && (
          <Badge variant="secondary" className="text-[10px]">
            {t("cannotEnter")}
          </Badge>
        )}

        <Badge
          className={cn(
            "text-[10px]",
            persona.activo
              ? "bg-[#2096BA]/15 text-[#187a99]"
              : "bg-muted text-muted-foreground",
          )}
        >
          {persona.activo ? t("status.active") : t("status.inactive")}
        </Badge>

        {/* El rol se cambia enviando el desplegable: sin botón aparte, que
            obligaría a dos clics para una sola decisión. */}
        {esYo ? (
          <span className="text-muted-foreground px-2 text-xs">
            {tRoles(persona.rol)}
          </span>
        ) : (
          <form action={cambiar} className="flex items-center gap-1">
            <input type="hidden" name="id" value={persona.id} />
            <select
              name="rol"
              defaultValue={persona.rol}
              onChange={(evento) => evento.currentTarget.form?.requestSubmit()}
              disabled={cambiando}
              aria-label={t("changeRole")}
              className="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-8 rounded-md border bg-card px-2 text-xs shadow-xs outline-none focus-visible:ring-[3px]"
            >
              {roles.map((rol) => (
                <option key={rol} value={rol}>
                  {tRoles(rol)}
                </option>
              ))}
            </select>
            {cambiando && <Loader2 className="size-3.5 animate-spin" />}
          </form>
        )}

        {!esYo && (
          <>
            <BotonCuenta
              accion={alternarCuenta}
              campos={{ id: persona.id, activar: persona.activo ? "0" : "1" }}
              etiqueta={persona.activo ? t("deactivate") : t("activate")}
              icono={persona.activo ? UserMinus : UserPlus}
            />

            {persona.puede_entrar && (
              <BotonCuenta
                accion={reiniciarAcceso}
                campos={{ id: persona.id }}
                etiqueta={t("resetAccess")}
                icono={KeyRound}
                muestraContrasena
              />
            )}
          </>
        )}
      </div>

      {estadoRol.estado !== "inicial" && estadoRol.estado !== "ok" && (
        <p role="alert" className="text-destructive w-full text-xs">
          {estadoRol.estado === "no_permitido"
            ? t("cannotSelf")
            : estadoRol.estado === "no_encontrada"
              ? t("errNotFound")
              : t("errGeneric")}
        </p>
      )}
    </li>
  );
}

/** Alta: correo, nombre y rol. Devuelve la contraseña temporal una sola vez. */
function FormularioAlta({
  roles,
  alCerrar,
}: {
  roles: readonly Rol[];
  alCerrar: () => void;
}) {
  const t = useTranslations("staff");
  const tRoles = useTranslations("roles");
  const [estado, enviar, enviando] = useActionState<EstadoCuenta, FormData>(
    crearCuenta,
    { estado: "inicial" },
  );

  if (estado.estado === "ok" && estado.contrasena) {
    return <Contrasena valor={estado.contrasena} alCerrar={alCerrar} />;
  }

  return (
    <form action={enviar} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="cuenta-email">{t("fieldEmail")}</Label>
          <Input
            id="cuenta-email"
            name="email"
            type="email"
            required
            autoComplete="off"
            aria-invalid={estado.estado === "correo_invalido" || undefined}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cuenta-nombre">{t("fieldName")}</Label>
          <Input
            id="cuenta-nombre"
            name="nombre"
            required
            maxLength={120}
            aria-invalid={estado.estado === "nombre_vacio" || undefined}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cuenta-rol">{t("fieldRole")}</Label>
          <select
            id="cuenta-rol"
            name="rol"
            required
            className="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border bg-card px-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
          >
            {roles.map((rol) => (
              <option key={rol} value={rol}>
                {tRoles(rol)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {estado.estado !== "inicial" && estado.estado !== "ok" && (
        <p role="alert" className="text-destructive text-xs">
          {estado.estado === "correo_invalido"
            ? t("errEmail")
            : estado.estado === "correo_repetido"
              ? t("errRepeated")
              : estado.estado === "nombre_vacio"
                ? t("errName")
                : estado.estado === "rol_invalido"
                  ? t("errRole")
                  : t("errGeneric")}
        </p>
      )}

      <div className="flex items-center gap-2">
        <Button type="submit" cargando={enviando}>
          {enviando && <Loader2 className="size-4 animate-spin" />}
          {enviando ? t("creating") : t("create")}
        </Button>

        <Button type="button" variant="ghost" onClick={alCerrar}>
          <X className="size-4" />
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}

/**
 * La contraseña temporal, una sola vez.
 *
 * En `font-mono` y con los guiones que trae, para poder dictarla sin
 * equivocarse. El botón de copiar usa el portapapeles del navegador y cae en
 * silencio si no hay permiso: el valor está a la vista de todos modos.
 */
function Contrasena({
  valor,
  alCerrar,
}: {
  valor: string;
  alCerrar: () => void;
}) {
  const t = useTranslations("staff");
  const [copiada, setCopiada] = useState(false);

  return (
    <div className="space-y-3 rounded-xl border border-[#2096BA]/30 bg-[#2096BA]/5 p-4">
      <p className="text-sm font-semibold">{t("passwordTitle")}</p>

      <div className="flex flex-wrap items-center gap-2">
        <code className="rounded-lg bg-card px-3 py-2 font-mono text-sm font-semibold tracking-wider">
          {valor}
        </code>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            navigator.clipboard?.writeText(valor).then(
              () => setCopiada(true),
              () => setCopiada(false),
            );
          }}
        >
          {copiada ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copiada ? t("copied") : t("copy")}
        </Button>
      </div>

      <Button type="button" size="sm" onClick={alCerrar}>
        {t("done")}
      </Button>
    </div>
  );
}

/**
 * Botón de una acción sin campos que rellenar.
 *
 * Cada uno es su propio `form` para que funcione sin JavaScript. Cuando la
 * acción devuelve una contraseña —reiniciar acceso— se muestra debajo.
 */
function BotonCuenta({
  accion,
  campos,
  etiqueta,
  icono: Icono,
  muestraContrasena = false,
}: {
  accion: (previo: EstadoCuenta, datos: FormData) => Promise<EstadoCuenta>;
  campos: Record<string, string>;
  etiqueta: string;
  icono: React.ComponentType<{ className?: string }>;
  muestraContrasena?: boolean;
}) {
  const [estado, enviar, enviando] = useActionState<EstadoCuenta, FormData>(
    accion,
    { estado: "inicial" },
  );

  return (
    <form action={enviar}>
      {Object.entries(campos).map(([nombre, valor]) => (
        <input key={nombre} type="hidden" name={nombre} value={valor} />
      ))}

      <Button
        type="submit"
        variant="ghost"
        size="icon"
        cargando={enviando}
        title={etiqueta}
        aria-label={etiqueta}
      >
        {enviando ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Icono className="size-3.5" />
        )}
      </Button>

      {muestraContrasena && estado.contrasena && (
        <code className="mt-1 block rounded bg-card px-2 py-1 font-mono text-[11px] font-semibold">
          {estado.contrasena}
        </code>
      )}
    </form>
  );
}
