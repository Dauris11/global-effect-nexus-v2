import { NextResponse } from "next/server";

import { obtenerUsuarioActual } from "@/lib/auth";
import { itemsDePrioridad } from "@/server/prioridades/motor";
import { usuarioSesionDe } from "@/server/prioridades/suplantar";

/**
 * Depuración del motor de prioridades: `/api/dev/prioridades?as=<userId>` devuelve los ítems que vería
 * esa persona. Solo en desarrollo y solo para un super_admin REAL con sesión: en producción no existe.
 */
export async function GET(peticion: Request) {
  if (process.env.NODE_ENV === "production") return new NextResponse("No encontrado", { status: 404 });

  const quien = await obtenerUsuarioActual();
  if (!quien || quien.rolReal !== "super_admin") return new NextResponse("No autorizado", { status: 403 });

  const as = new URL(peticion.url).searchParams.get("as");
  const usuario = as ? await usuarioSesionDe(as) : quien;
  if (!usuario) return NextResponse.json({ error: "usuario no encontrado" }, { status: 404 });

  const items = await itemsDePrioridad(usuario, { sinCache: true });

  return NextResponse.json({
    usuario: { id: usuario.id, nombre: usuario.nombre, rol: usuario.rol },
    total: items.length,
    items: [...items].sort((a, b) => b.score - a.score).map((i) => ({ id: i.id, severidad: i.severidad, score: i.score, titulo: i.titulo, contexto: i.contexto, accion: i.accion.label, escalado: i.escalado ?? false })),
  });
}
