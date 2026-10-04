/**
 * Mide el portal en WebKit de verdad (el motor de Safari), a tres anchos.
 *
 *   npm install --no-save playwright && npx playwright install webkit
 *   node scripts/probar-webkit.mjs <carpeta> [correo] [rutas] [anchos]
 *
 *   rutas:  lista separada por comas (por defecto, el calendario con sus
 *           cuatro vistas). Ej.: /portal/estudiante,/portal/estudiante/solicitudes
 *   anchos: 390,768,1440 por defecto.
 *
 * Playwright NO está en `package.json` a propósito: es una herramienta de
 * diagnóstico, no una dependencia del producto. Se instala cuando hace falta
 * comprobar algo que solo se rompe en Safari.
 *
 * Comprueba en cada ruta y cada ancho que la página no se corra de lado
 * (scrollWidth > innerWidth) y deja una captura. Al final de cada ancho mira
 * que "Cerrar sesión" sea alcanzable: en escritorio está en la barra lateral;
 * en el móvil se llega por la pestaña "Más" de la barra inferior.
 */
import { webkit } from "playwright";
import { config } from "dotenv";
config({ path: ".env.local" });

const SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PUB = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const REF = new URL(SUPA).hostname.split(".")[0];
const SALIDA = process.argv[2];
const CORREO = process.argv[3] ?? "admin@globaleffect.org";

const res = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: PUB, "Content-Type": "application/json" },
  body: JSON.stringify({ email: CORREO, password: "GlobalEffect2026!" }),
});
if (!res.ok) { console.log("sin sesión:", res.status); process.exit(1); }

const valor = "base64-" + Buffer.from(JSON.stringify(await res.json())).toString("base64url");
const nombre = `sb-${REF}-auth-token`;
const TROZO = 3180;
const galletas = [];
if (valor.length <= TROZO) galletas.push({ name: nombre, value: valor });
else for (let i = 0, n = 0; i < valor.length; i += TROZO, n++)
  galletas.push({ name: `${nombre}.${n}`, value: valor.slice(i, i + TROZO) });

const RUTAS = (process.argv[4] ?? "").split(",").filter(Boolean);
const LISTA_ANCHOS = (process.argv[5] ?? "390,768,1440").split(",").map(Number);
const navegador = await webkit.launch();
const ANCHOS = LISTA_ANCHOS.map((w) => ({
  nombre: w < 768 ? `movil-${w}` : w < 1200 ? `tablet-${w}` : `escritorio-${w}`,
  width: w,
  height: w < 768 ? 844 : w < 1200 ? 1024 : 900,
}));

function fila(...c) { return c.map((v, i) => String(v).padEnd([18, 40, 9, 9, 8][i])).join(""); }
console.log("WebKit", (await navegador.version?.()) ?? "", "\n");
console.log(fila("ancho", "ruta / vista", "scrollW", "innerW", "desborde"));

async function medir(pagina, ancho, etiqueta) {
  const m = await pagina.evaluate(() => ({
    scrollW: document.documentElement.scrollWidth,
    innerW: window.innerWidth,
  }));
  const desborde = m.scrollW > m.innerW + 1 ? `SÍ +${m.scrollW - m.innerW}px` : "no";
  console.log(fila(ancho.nombre, etiqueta, m.scrollW, m.innerW, desborde));
}

for (const ancho of ANCHOS) {
  const contexto = await navegador.newContext({
    viewport: { width: ancho.width, height: ancho.height },
    deviceScaleFactor: 2,
  });
  await contexto.addCookies(
    galletas.map((g) => ({ ...g, domain: "localhost", path: "/" })),
  );
  const pagina = await contexto.newPage();
  const errores = [];
  pagina.on("pageerror", (e) => errores.push(e.message));

  if (RUTAS.length) {
    for (const ruta of RUTAS) {
      await pagina.goto(`http://localhost:3000/es${ruta}`, { waitUntil: "networkidle" });
      await pagina.waitForTimeout(300);
      await medir(pagina, ancho, ruta);
      const archivo = (ruta.replace(/^\//, "").replace(/[/?=&]+/g, "_") || "inicio");
      await pagina.screenshot({ path: `${SALIDA}/${archivo}-${ancho.nombre}.png`, fullPage: true });
    }
  } else {
    await pagina.goto("http://localhost:3000/calendario?mes=2026-08", { waitUntil: "networkidle" });
    for (const vista of ["Mes", "Semana", "Día", "Lista"]) {
      const boton = pagina.getByRole("button", { name: vista, exact: true });
      if (await boton.count()) { await boton.first().click(); await pagina.waitForTimeout(350); }
      await medir(pagina, ancho, `calendario · ${vista}`);
      await pagina.screenshot({
        path: `${SALIDA}/cal-${ancho.nombre}-${vista.toLowerCase().replace("í", "i")}.png`,
        fullPage: false,
      });
    }
  }

  // Cerrar sesión: en escritorio, en la lateral; en el móvil, tras "Más".
  if (ancho.width < 768) {
    await pagina.getByRole("button", { name: /^(más|more)$/i }).first().click().catch(() => {});
    await pagina.waitForTimeout(400);
  }
  const salir = pagina.getByRole("button", { name: /cerrar sesión/i }).first();
  let estado = "no encontrado";
  if (await salir.count()) {
    const caja = await salir.boundingBox();
    estado = !caja ? "sin caja"
      : caja.y + caja.height <= ancho.height + 1 ? `dentro (y=${Math.round(caja.y)})`
      : `FUERA (y=${Math.round(caja.y)} > ${ancho.height})`;
  }
  if (ancho.width < 768) await pagina.screenshot({ path: `${SALIDA}/menu-mas-${ancho.nombre}.png` });
  console.log(`   cerrar sesión → ${estado}${errores.length ? "  errores JS: " + errores.join(" | ") : ""}`);

  await contexto.close();
}

await navegador.close();
