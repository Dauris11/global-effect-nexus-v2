"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { UserPlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AccionesFormulario, FormularioGuiado, PasoFormulario } from "@/components/ui/formulario-guiado";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { crearEmpleado } from "@/server/contabilidad/nomina/acciones";

export function DialogoNuevoEmpleado({
  terceros,
  centrosCosto,
}: {
  terceros: Array<{ id: string; nombre: string; identificacion: string }>;
  centrosCosto: Array<{ id: string; codigo: string; nombre: string }>;
}) {
  const t = useTranslations("contab.nomina");
  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [terceroId, setTerceroId] = useState("");
  const [centroCostoId, setCentroCostoId] = useState("");
  const [codigoEmpleado, setCodigoEmpleado] = useState("");
  const [cargo, setCargo] = useState("");
  const [departamento, setDepartamento] = useState("");
  const [fechaIngreso, setFechaIngreso] = useState(new Date().toISOString().split("T")[0]);
  const [tipoContrato, setTipoContrato] = useState<"indefinido" | "fijo" | "proyecto" | "pasantia">("indefinido");
  const [salarioBase, setSalarioBase] = useState("");
  const [bancoNombre, setBancoNombre] = useState("Banco Santa Cruz");
  const [bancoCuenta, setBancoCuenta] = useState("");
  const [bancoTipoCuenta, setBancoTipoCuenta] = useState<"ahorros" | "corriente">("ahorros");
  const [cotizaTss, setCotizaTss] = useState(true);
  const [aplicaIsr, setAplicaIsr] = useState(true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCargando(true);
    setError(null);

    try {
      await crearEmpleado({
        tercero_id: terceroId,
        centro_costo_id: centroCostoId,
        codigo_empleado: codigoEmpleado,
        cargo,
        departamento,
        fecha_ingreso: fechaIngreso,
        tipo_contrato: tipoContrato,
        salario_base: Number(salarioBase),
        banco_nombre: bancoNombre || undefined,
        banco_cuenta: bancoCuenta || undefined,
        banco_tipo_cuenta: bancoTipoCuenta,
        cotiza_tss: cotizaTss,
        aplica_isr: aplicaIsr,
      });

      setAbierto(false);
      setCodigoEmpleado("");
      setCargo("");
      setDepartamento("");
      setSalarioBase("");
      setBancoCuenta("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al registrar empleado");
    } finally {
      setCargando(false);
    }
  };

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <UserPlus className="mr-2 h-4 w-4" />
          {t("nuevoEmpleado")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t("modalEmpleadoTitulo")}</DialogTitle>
            <DialogDescription>{t("modalEmpleadoDesc")}</DialogDescription>
          </DialogHeader>

          {error && (
            <div className="mt-3 rounded-md bg-destructive/10 p-3 text-xs text-destructive dark:bg-destructive/20">
              {error}
            </div>
          )}

          <FormularioGuiado className="py-4">
            <div className="grid gap-4 text-sm">
              <PasoFormulario titulo={t("pasos.puesto")}>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="emp-tercero">{t("tercero")}</Label>
                    <Select value={terceroId} onValueChange={setTerceroId} required>
                      <SelectTrigger id="emp-tercero">
                        <SelectValue placeholder={t("seleccionarTercero")} />
                      </SelectTrigger>
                      <SelectContent>
                        {terceros.map((tc) => (
                          <SelectItem key={tc.id} value={tc.id}>
                            {tc.nombre} ({tc.identificacion})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="emp-centro">{t("centroCosto")}</Label>
                    <Select value={centroCostoId} onValueChange={setCentroCostoId} required>
                      <SelectTrigger id="emp-centro">
                        <SelectValue placeholder={t("seleccionarCentro")} />
                      </SelectTrigger>
                      <SelectContent>
                        {centrosCosto.map((cc) => (
                          <SelectItem key={cc.id} value={cc.id}>
                            {cc.codigo} — {cc.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="emp-cod">{t("codigo")}</Label>
                    <Input
                      id="emp-cod"
                      value={codigoEmpleado}
                      onChange={(e) => setCodigoEmpleado(e.target.value)}
                      placeholder="EMP-001"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="emp-cargo">{t("cargo")}</Label>
                    <Input
                      id="emp-cargo"
                      value={cargo}
                      onChange={(e) => setCargo(e.target.value)}
                      placeholder="Coordinador Pedagógico"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="emp-depto">{t("departamento")}</Label>
                    <Input
                      id="emp-depto"
                      value={departamento}
                      onChange={(e) => setDepartamento(e.target.value)}
                      placeholder="Operaciones"
                      required
                    />
                  </div>
                </div>
              </PasoFormulario>

              <PasoFormulario titulo={t("pasos.contrato")}>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="emp-ingreso">{t("fechaIngreso")}</Label>
                    <Input
                      id="emp-ingreso"
                      type="date"
                      value={fechaIngreso}
                      onChange={(e) => setFechaIngreso(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="emp-tipo-contrato">{t("tipoContrato")}</Label>
                    <Select
                      value={tipoContrato}
                      onValueChange={(val: "indefinido" | "fijo" | "proyecto" | "pasantia") =>
                        setTipoContrato(val)
                      }
                    >
                      <SelectTrigger id="emp-tipo-contrato">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="indefinido">{t("indefinido")}</SelectItem>
                        <SelectItem value="fijo">{t("fijo")}</SelectItem>
                        <SelectItem value="proyecto">{t("proyecto")}</SelectItem>
                        <SelectItem value="pasantia">{t("pasantia")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="emp-salario">{t("salarioBase")}</Label>
                    <Input
                      id="emp-salario"
                      type="number"
                      step="0.01"
                      min="1"
                      value={salarioBase}
                      onChange={(e) => setSalarioBase(e.target.value)}
                      placeholder="35000.00"
                      required
                    />
                  </div>
                </div>
              </PasoFormulario>

              <PasoFormulario titulo={t("pasos.pago")}>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="emp-banco">{t("banco")}</Label>
                    <Input
                      id="emp-banco"
                      value={bancoNombre}
                      onChange={(e) => setBancoNombre(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="emp-cuenta">{t("cuentaBancaria")}</Label>
                    <Input
                      id="emp-cuenta"
                      value={bancoCuenta}
                      onChange={(e) => setBancoCuenta(e.target.value)}
                      placeholder="100-XXXXX-X"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="emp-tipo-cuenta">{t("tipoCuenta")}</Label>
                    <Select
                      value={bancoTipoCuenta}
                      onValueChange={(val: "ahorros" | "corriente") => setBancoTipoCuenta(val)}
                    >
                      <SelectTrigger id="emp-tipo-cuenta">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ahorros">{t("ahorros")}</SelectItem>
                        <SelectItem value="corriente">{t("corriente")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex gap-6 pt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={cotizaTss}
                      onChange={(e) => setCotizaTss(e.target.checked)}
                      className="rounded border-linea-fuerte text-[#2096BA] focus:ring-[#2096BA]"
                    />
                    <span>{t("cotizaTss")}</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={aplicaIsr}
                      onChange={(e) => setAplicaIsr(e.target.checked)}
                      className="rounded border-linea-fuerte text-[#2096BA] focus:ring-[#2096BA]"
                    />
                    <span>{t("aplicaIsr")}</span>
                  </label>
                </div>
              </PasoFormulario>
            </div>

            <AccionesFormulario>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setAbierto(false)}>
                  {t("cancelar")}
                </Button>
                <Button
                  type="submit"
                  disabled={cargando || !terceroId || !centroCostoId || !salarioBase}
                  className="bg-[#2096BA] hover:bg-[#187a99] text-white"
                >
                  {cargando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t("guardarEmpleado")}
                </Button>
              </DialogFooter>
            </AccionesFormulario>
          </FormularioGuiado>
        </form>
      </DialogContent>
    </Dialog>
  );
}
