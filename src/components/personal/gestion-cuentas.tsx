"use client";

import { useActionState, useEffect, useState } from "react";
import { Check, Copy, KeyRound, Loader2, Plus, Search, UserMinus, UserPlus, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { RolBadge } from "@/components/app/rol-badge";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { Rol } from "@/lib/rbac";
import { ROLE_LABEL } from "@/lib/roles";
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
                <FilaCuenta
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

/**
 * Clave de `staff.*` con el mensaje de un estado de error, o `null` si no hay nada que avisar. Una sola tabla para
 * el alta, el cambio de rol y los botones de cuenta: las reglas de roles (`solo_developer`, `solo_owner`,
 * `ultimo_owner`) tienen que sonar igual en los tres.
 */
function claveDeError(estado: EstadoCuenta["estado"]): string | null {
  switch (estado) {
    case "inicial":
    case "ok":
      return null;
    case "no_permitido":
      return "cannotSelf";
    case "no_encontrada":
      return "errNotFound";
    case "solo_developer":
      return "errDeveloperOnly";
    case "solo_owner":
      return "errOwnerOnly";
    case "ultimo_owner":
      return "errLastOwner";
    case "correo_invalido":
      return "errEmail";
    case "correo_repetido":
      return "errRepeated";
    case "nombre_vacio":
      return "errName";
    case "rol_invalido":
      return "errRole";
    default:
      return "errGeneric";
  }
}

/** Una persona: su rol en un desplegable y los botones de su estado. */
export function FilaCuenta({
  persona,
  roles,
  esYo,
}: {
  persona: PersonaDelEquipo;
  roles: readonly Rol[];
  esYo: boolean;
}) {
  const t = useTranslations("staff");
  const tRaiz = useTranslations();
  const [estadoRol, cambiar, cambiando] = useActionState<EstadoCuenta, FormData>(
    cambiarRol,
    { estado: "inicial" },
  );
  // Activar, desactivar y reiniciar acceso avisan aquí: el fallo se ve en la fila y no se pierde en un botón de icono.
  const [estadoBoton, setEstadoBoton] = useState<EstadoCuenta["estado"]>("inicial");
  const claveError = claveDeError(estadoBoton !== "inicial" && estadoBoton !== "ok" ? estadoBoton : estadoRol.estado);
  // Un rol que quien mira no puede asignar (el developer, para un owner) no se edita: se muestra y ya.
  const rolEditable = (roles as readonly string[]).includes(persona.rol);

  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          <Link href={`/administrativo/personal/${persona.id}`} className="hover:underline">
            {persona.nombre}
          </Link>
        </p>
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
              ? "bg-marca-500/15 text-marca-700"
              : "bg-muted text-muted-foreground",
          )}
        >
          {persona.activo ? t("status.active") : t("status.inactive")}
        </Badge>

        {/* El rol se cambia enviando el desplegable: sin botón aparte, que
            obligaría a dos clics para una sola decisión. */}
        {esYo || !rolEditable ? (
          <RolBadge rol={persona.rol} />
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
                  {tRaiz(ROLE_LABEL[rol])}
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
              alResultado={setEstadoBoton}
            />

            {persona.puede_entrar && (
              <BotonCuenta
                accion={reiniciarAcceso}
                campos={{ id: persona.id }}
                etiqueta={t("resetAccess")}
                icono={KeyRound}
                muestraContrasena
                alResultado={setEstadoBoton}
              />
            )}
          </>
        )}
      </div>

      {claveError && (
        <Alert variant="danger" className="w-full">
          {t(claveError)}
        </Alert>
      )}
    </li>
  );
}

/** Alta: correo, nombre y rol. Devuelve la contraseña temporal una sola vez. */
export function FormularioAlta({
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

      {claveDeError(estado.estado) && <Alert variant="danger">{t(claveDeError(estado.estado)!)}</Alert>}

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
    <div className="space-y-3 rounded-xl border border-marca-500/30 bg-marca-500/5 p-4">
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
  alResultado,
}: {
  accion: (previo: EstadoCuenta, datos: FormData) => Promise<EstadoCuenta>;
  campos: Record<string, string>;
  etiqueta: string;
  icono: React.ComponentType<{ className?: string }>;
  muestraContrasena?: boolean;
  /** Avisa a la fila del resultado, para que ella muestre el error traducido. */
  alResultado?: (estado: EstadoCuenta["estado"]) => void;
}) {
  const [estado, enviar, enviando] = useActionState<EstadoCuenta, FormData>(
    accion,
    { estado: "inicial" },
  );

  useEffect(() => {
    alResultado?.(estado.estado);
  }, [estado, alResultado]);

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
