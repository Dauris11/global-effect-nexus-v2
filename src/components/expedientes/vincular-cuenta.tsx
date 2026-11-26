"use client";

import { useActionState, useState } from "react";
import { AlertCircle, Link2, Loader2, Mail, Save, Unlink } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ALERTA_RIESGO } from "@/lib/paleta";
import {
  crearCuentaEInvitar,
  vincularCuenta,
  type EstadoInvitacion,
  type EstadoVinculoCuenta,
} from "@/server/expedientes/acciones";
import type { CuentaSinVincular } from "@/server/expedientes/consultas";

/**
 * Elegir con qué cuenta del portal entra el estudiante del expediente.
 *
 * Solo se ofrecen cuentas con rol `estudiante` que no estén ya atadas a otro
 * expediente; la acción lo vuelve a comprobar al escribir. Con una cuenta ya
 * vinculada, el mismo diálogo sirve para cambiarla o soltarla.
 */
export function VincularCuenta({
  estudianteId,
  vinculada,
  cuentas,
  soloDesvincular = false,
  correoEstudiante = null,
}: {
  estudianteId: string;
  vinculada: { id: string; email: string } | null;
  cuentas: CuentaSinVincular[];
  /** Para un expediente que ya no está activo: solo se puede soltar la cuenta. */
  soloDesvincular?: boolean;
  /** El correo del expediente: con él se puede crear la cuenta e invitar. */
  correoEstudiante?: string | null;
}) {
  const t = useTranslations("records.portada");
  const [abierto, setAbierto] = useState(false);
  // Cerrar al guardar, dentro de la propia acción y no en un efecto: la
  // portada ya se refresca sola con `revalidatePath`.
  const [estado, enviar, guardando] = useActionState<EstadoVinculoCuenta, FormData>(
    async (previo, datos) => {
      const resultado = await vincularCuenta(previo, datos);
      if (resultado.estado === "ok") setAbierto(false);
      return resultado;
    },
    { estado: "inicial" },
  );

  const [invitacion, invitar, invitando] = useActionState<EstadoInvitacion, FormData>(async (previo, datos) => {
    const r = await crearCuentaEInvitar(previo, datos);

    if (r.estado === "ok") setAbierto(false);

    return r;
  }, { estado: "inicial" });

  const error =
    estado.estado === "ocupada"
      ? t("errorOcupada")
      : estado.estado === "no_activo"
        ? t("cuentaSoloActivos")
      : estado.estado !== "inicial" && estado.estado !== "ok"
        ? t("error")
        : null;

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Link2 className="size-4" />
          {soloDesvincular ? t("desvincular") : vinculada ? t("cambiar") : t("vincular")}
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("tituloDialogo")}</DialogTitle>
        </DialogHeader>

        {/* El camino fácil: crear la cuenta y mandar la invitación al correo del expediente. */}
        {!vinculada && !soloDesvincular && (
          <form action={invitar} className="space-y-2 rounded-control border border-linea p-3">
            <input type="hidden" name="estudiante" value={estudianteId} />
            <p className="text-sm font-medium">{t("invitarTitulo")}</p>
            {correoEstudiante ? <p className="texto-meta">{correoEstudiante}</p> : <p className="texto-meta">{t("invitarSinCorreo")}</p>}
            {invitacion.estado !== "inicial" && invitacion.estado !== "ok" && (
              <p role="alert" className={ALERTA_RIESGO.contenedor}>
                <AlertCircle className={ALERTA_RIESGO.icono} />
                <span className={ALERTA_RIESGO.texto}>{t(`invitarErrores.${invitacion.estado}`)}</span>
              </p>
            )}
            <Button type="submit" disabled={invitando || !correoEstudiante} className="w-full">
              {invitando ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
              {t("invitarBoton")}
            </Button>
          </form>
        )}

        <form action={enviar} className="space-y-4">
          <input type="hidden" name="estudiante" value={estudianteId} />

          {soloDesvincular ? (
            <p className="text-sm text-tinta-2">{t("noActivoDesvincular")}</p>
          ) : cuentas.length === 0 ? (
            <p className="text-sm text-tinta-2">{t("sinCuentasLibres")}</p>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="vincular-cuenta">{t("cuentaLabel")}</Label>
              <Select name="usuario" required>
                <SelectTrigger id="vincular-cuenta">
                  <SelectValue placeholder={t("elegir")} />
                </SelectTrigger>
                <SelectContent>
                  {cuentas.map((cuenta) => (
                    <SelectItem key={cuenta.id} value={cuenta.id}>
                      {cuenta.nombre} · {cuenta.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {error && (
            <p role="alert" className={ALERTA_RIESGO.contenedor}>
              <AlertCircle className={ALERTA_RIESGO.icono} />
              <span className={ALERTA_RIESGO.texto}>{error}</span>
            </p>
          )}

          <DialogFooter className="gap-2">
            {vinculada && (
              <Button
                type="submit"
                variant="outline"
                name="accion"
                value="desvincular"
                formNoValidate
                cargando={guardando}
              >
                <Unlink className="size-4" />
                {t("desvincular")}
              </Button>
            )}

            {cuentas.length > 0 && (
              <Button type="submit" cargando={guardando}>
                {guardando ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                {t("guardar")}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
