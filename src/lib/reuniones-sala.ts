/**
 * Utilidades para salas de videollamada embebidas en reuniones institucionales.
 *
 * Usa Jitsi Meet embebible (`https://meet.jit.si/...`) para que cualquier rol
 * pueda unirse en vivo desde dentro de la propia aplicación, manteniendo
 * compatibilidad si el organizador pega un enlace externo (Google Meet/Zoom).
 */

export function generarEnlaceSalaVirtual(semilla?: string): string {
  const base = semilla
    ? semilla.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12)
    : crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  return `https://meet.jit.si/GlobalEffectNexus-${base}`;
}

export function esSalaEmbebible(url: string | null | undefined): boolean {
  if (!url) return false;
  const limpia = url.trim().toLowerCase();
  return (
    limpia.startsWith("https://meet.jit.si/") ||
    limpia.startsWith("https://8x8.vc/")
  );
}

export function urlEmbedSala(url: string, nombreUsuario: string): string {
  const limpia = url.trim().split("#")[0];
  const nombre = encodeURIComponent(nombreUsuario.trim() || "Participante");
  return `${limpia}#userInfo.displayName=%22${nombre}%22&config.prejoinPageEnabled=true&interfaceConfig.SHOW_JITSI_WATERMARK=false`;
}

