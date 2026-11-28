import { appendFileSync } from "node:fs";
import { createRequire } from "node:module";

import { expect, test, type Page } from "@playwright/test";

import { itemsDeArea, menuVisibleDe } from "../src/lib/nav";
import { ROLES, type Rol } from "../src/lib/rbac";

/**
 * Guardián de UX: criterio de «terminado» del rediseño (docs/ux-rules.md). Recorre cada
 * ruta del sidebar de cada rol, a 1440×900, con el mecanismo real de «Ver como» (la
 * cookie `ge_ver_como`, que solo obedece si la sesión real es owner).
 *
 * Cada regla es un `test.step`; las fallas son suaves (expect.soft) para que una corrida
 * las cuente todas, y cada resultado se anota en e2e/.resultados para `resumen-ux.mjs`.
 */

const require = createRequire(import.meta.url);
const COOKIE_VER_COMO = "ge_ver_como";
const SALIDA = "e2e/.resultados/ux.ndjson";

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/** Los enlaces del sidebar con su marca de «pie» (Calendario, Reportes, Configuración: abajo y en gris). */
function enlacesDelSidebar(rol: Rol): { href: string; pie: boolean }[] {
  const vistas = new Map<string, boolean>();

  for (const area of menuVisibleDe(rol)) {
    for (const item of itemsDeArea(area)) vistas.set(item.href, Boolean(item.pie));
  }

  return [...vistas].map(([href, pie]) => ({ href, pie }));
}

/** Todas las pantallas del sidebar: el enlace de cada módulo y las rutas de sus pestañas (`activoEn`). */
function rutasDelSidebar(rol: Rol): string[] {
  const rutas = new Set<string>();

  for (const area of menuVisibleDe(rol)) {
    for (const item of itemsDeArea(area)) {
      rutas.add(item.href);
      for (const r of item.activoEn ?? []) rutas.add(r);
    }
  }

  return [...rutas];
}

const esPerfilOSalir = (href: string) => /\/perfil|logout|cerrar-sesion/.test(href);
const esInicio = (href: string) => href === "/inicio";
// «Reportes» es cualquier ruta cuyo tramo sea `reportes` (también `/habitudes/reportes`): ahí SÍ viven los gráficos.
const esReporte = (href: string) => href.split("/").includes("reportes");

function anotar(rol: string, ruta: string, regla: string, ok: boolean, detalle = "") {
  appendFileSync(SALIDA, `${JSON.stringify({ rol, ruta, regla, ok, detalle })}\n`);
  expect.soft(ok, `${regla} · ${rol} · ${ruta}${detalle ? ` → ${detalle}` : ""}`).toBe(true);
}

/** Todo lo medible de una página en un solo viaje al navegador. */
async function medir(page: Page) {
  return page.evaluate(() => {
    const visible = (e: Element) => {
      const r = e.getBoundingClientRect();
      const s = getComputedStyle(e);

      return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none";
    };
    const rgba = (c: string) => {
      const m = c.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const [r, g, b, a = "1"] = m[1].split(/[ ,/]+/).filter(Boolean);

      return { r: +r, g: +g, b: +b, a: +a };
    };
    const lum = ({ r, g, b }: { r: number; g: number; b: number }) => {
      const f = (v: number) => {
        const x = v / 255;

        return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
      };

      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };

    const raiz = getComputedStyle(document.documentElement);
    const variables = Object.fromEntries(
      ["--primary", "--destructive", "--ring", "--canvas"].map((v) => [v, raiz.getPropertyValue(v).trim().toLowerCase()]),
    );
    const fondoBody = getComputedStyle(document.body).backgroundColor;

    const oscuros: string[] = [];
    for (const e of document.body.querySelectorAll("*")) {
      if (!visible(e)) continue;
      const r = e.getBoundingClientRect();
      if (r.width <= 200 || r.height <= 40) continue;
      if (e.closest("[data-chip][data-active],[data-impersonation-bar]")) continue;
      const c = rgba(getComputedStyle(e).backgroundColor);
      if (c && c.a > 0.5 && lum(c) < 0.05) {
        oscuros.push(`${e.tagName.toLowerCase()}.${String(e.className).split(" ").slice(0, 3).join(".")}`);
      }
    }

    const main = document.querySelector("main") ?? document.body;
    // El orbe del asistente (≈56 px) también pinta en un <canvas>: un gráfico real mide bastante más.
    const graficos = [...main.querySelectorAll("svg.recharts-surface, canvas")].filter((e) => e.getBoundingClientRect().width >= 120).length;
    const kpis = main.querySelectorAll("[data-kpi]").length;
    const lista = [...main.querySelectorAll("table, [role=list], [data-list]")].find(visible);
    const listaTop = lista ? Math.round(lista.getBoundingClientRect().top + window.scrollY) : null;
    const primarios = [...main.querySelectorAll("header [data-variant=primary]")].filter(visible).length;
    const prioritarios = [...main.querySelectorAll("[data-priority-item]")].filter(visible).map((el) => ({
      conAccion: !!el.querySelector("button, a"),
    }));
    const h1 = main.querySelector("h1")?.textContent?.trim() ?? null;
    const nombreDe = (e: Element) => {
      // El distintivo numérico («Solicitudes 6») no es parte del nombre del enlace.
      const copia = e.cloneNode(true) as Element;
      copia.querySelectorAll("[data-insignia]").forEach((x) => x.remove());

      return (copia.textContent ?? "").trim();
    };
    // Módulo = enlace activo del menú; pestaña = la activa dentro del módulo. El título es el módulo, nunca la pestaña.
    const activos = [...document.querySelectorAll('nav [aria-current="page"]')].filter(visible).map(nombreDe);
    const pestanasActivas = [...document.querySelectorAll('[role=tab][aria-selected="true"]')].filter(visible).map(nombreDe);

    // Vencidas: un chip «Vencidas N» con N>0 exige verlas sin tocar nada.
    const chips = [...document.querySelectorAll("[data-chip],[aria-pressed],[role=tab]")];
    const chipVencidas = chips.find((e) => /vencid|overdue/i.test(e.textContent ?? ""));
    const nVencidas = Number(chipVencidas?.textContent?.match(/\d+/)?.[0] ?? 0);
    const vencidasVisibles = [...main.querySelectorAll("*")].filter(
      (e) => e.children.length === 0 && visible(e) && /vencid|overdue/i.test(e.textContent ?? "") && !e.closest("[data-chip],[aria-pressed],[role=tab]"),
    ).length;

    // El filtro con el que arranca la vista (el chip pulsado) tiene que incluir lo vencido.
    const chipActivo = chips.find((e) => e.getAttribute("aria-pressed") === "true" || e.hasAttribute("data-active"))?.textContent?.trim() ?? "";


    // — Botones (docs/ux-rules.md «un solo botón») —
    const fondoReal = (e: Element | null): string => {
      for (let n = e; n; n = n.parentElement) {
        const c = rgba(getComputedStyle(n).backgroundColor);
        if (c && c.a > 0.05) return `${c.r},${c.g},${c.b}`;
      }

      return "255,255,255";
    };
    const etiquetaDe = (e: Element) => `${(e.textContent ?? e.getAttribute("aria-label") ?? "").trim().slice(0, 24)}(${Math.round(e.getBoundingClientRect().height)}px)`;
    // Solo cuentan los botones con caja (el componente Button, o uno con fondo/borde propio): chips, pestañas,
    // interruptores, filas y controles de mapa son otra cosa y tienen su propia regla.
    const botones = [...document.querySelectorAll("button")].filter((b) => {
      if (!visible(b) || b.closest("[data-chip],[role=tab],[role=menuitem],[role=switch],[role=checkbox],[role=combobox],.leaflet-container,[data-barra-lateral],[data-gantt]")) return false;
      if (b.hasAttribute("data-slot")) return true;
      const s = getComputedStyle(b);

      return (rgba(s.backgroundColor)?.a ?? 0) > 0.05 || parseFloat(s.borderTopWidth) > 0;
    });
    const alturasMalas = botones.filter((b) => ![32, 36, 44].includes(Math.round(b.getBoundingClientRect().height))).map(etiquetaDe);
    const secundariosIguales = [...document.querySelectorAll("[data-variant=secondary]")]
      .filter(visible)
      .filter((b) => fondoReal(b) === fondoReal(b.parentElement))
      .map(etiquetaDe);
    // En oscuro, nada grande puede ser casi blanco (salvo el chip activo y las imágenes).
    const blancos: string[] = [];
    for (const e of document.body.querySelectorAll("*")) {
      if (!visible(e) || e.closest("[data-chip][data-active],img,picture,video,canvas,svg,.leaflet-container,[data-impersonation-bar]")) continue;
      const r = e.getBoundingClientRect();
      if (r.width <= 120 || r.height <= 32) continue;
      const c = rgba(getComputedStyle(e).backgroundColor);
      if (c && c.a > 0.5 && lum(c) > 0.85) blancos.push(`${e.tagName.toLowerCase()}.${String(e.className).split(" ").slice(0, 2).join(".")}`);
    }
    const botonesFuera: string[] = [];
    for (const tabla of document.querySelectorAll("main table")) {
      if (!visible(tabla)) continue;
      let caja: Element = tabla;
      for (let n: Element | null = tabla.parentElement; n && n !== document.body; n = n.parentElement) {
        const o = getComputedStyle(n).overflowX;
        if (o === "auto" || o === "scroll" || o === "hidden") { caja = n; break; }
      }
      const c = caja.getBoundingClientRect();
      for (const b of tabla.querySelectorAll("tbody button, tbody [data-slot=button]")) {
        if (!visible(b)) continue;
        const r = b.getBoundingClientRect();
        if (r.right > c.right + 1 || r.left < c.left - 1) botonesFuera.push(etiquetaDe(b));
      }
    }

    return { blancos, alturasMalas, secundariosIguales, botonesFuera, variables, fondoBody, oscuros, graficos, kpis, listaTop, primarios, prioritarios, h1, activos, pestanasActivas, nVencidas, vencidasVisibles, tieneChipVencidas: !!chipVencidas, chipActivo };
  });
}

test.describe("ux-guard", () => {
  test.describe.configure({ mode: "default" });

  // `developer` no se recorre: tiene el mismo menú y permisos que `owner` y «Ver como» no puede asumirlo (haría falta una cuenta real).
  // Cada rol se recorre dos veces: en claro y en oscuro (mismas reglas, más las del modo oscuro).
  const combinaciones = ROLES.filter((r) => r !== "developer").flatMap((r) => (["claro", "oscuro"] as const).map((m) => [r, m] as const));

  for (const [rol, modo] of combinaciones) {
    test(`rol ${rol} · ${modo}`, async ({ page, context }) => {
      test.setTimeout(20 * 60_000);
      const oscuro = modo === "oscuro";

      await page.emulateMedia({ colorScheme: oscuro ? "dark" : "light" });
      // La apariencia vive en localStorage: se fija antes de que cargue cualquier página.
      await context.addInitScript((tema) => {
        try {
          localStorage.setItem("ge-apariencia", JSON.stringify({ tema, acento: "azul" }));
        } catch {}
      }, oscuro ? "oscuro" : "claro");

      if (rol !== "owner") {
        await context.addCookies([{ name: COOKIE_VER_COMO, value: rol, url: test.info().project.use.baseURL ?? "http://localhost:3000" }]);
      }

      const rutas = rutasDelSidebar(rol);

      await test.step("sidebar-corto", async () => {
        if (oscuro) return;
        // ≤ 9 enlaces principales; los de «pie» (abajo, en gris) y perfil/cerrar sesión no cuentan.
        const enlaces = enlacesDelSidebar(rol);
        const principales = enlaces.filter((e) => !e.pie && !esPerfilOSalir(e.href));
        anotar(rol, "(sidebar)", "sidebar-corto", principales.length <= 9, `${principales.length} principales + ${enlaces.length - principales.length} en el pie`);
      });

      await test.step("inicio-unico (ítems de sidebar → /inicio)", async () => {
        if (oscuro) return;
        const n = rutas.filter(esInicio).length;
        anotar(rol, "(sidebar)", "inicio-unico", n === 1, `${n} ítems apuntan a /inicio`);
      });

      await test.step("inicio-accionable (/inicio)", async () => {
        const resp = await page.goto("/inicio", { waitUntil: "domcontentloaded" });
        await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
        if (!resp || resp.status() >= 400 || !new URL(page.url()).pathname.endsWith("/inicio")) {
          anotar(rol, "/inicio", "inicio-accionable", false, `la ruta no existe (HTTP ${resp?.status()}, termina en ${new URL(page.url()).pathname})`);

          return;
        }
        const m = await medir(page);
        const ok = m.graficos === 0 && (m.prioritarios.length === 0 || m.prioritarios[0].conAccion);
        anotar(rol, "/inicio", "inicio-accionable", ok, `gráficos=${m.graficos}, prioritarios=${m.prioritarios.length}, primero con acción=${m.prioritarios[0]?.conAccion}`);
      });

      for (const href of rutas) {
        await test.step(`ruta ${href}`, async () => {
          const resp = await page.goto(href, { waitUntil: "domcontentloaded" });
          await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
          const estado = resp?.status() ?? 0;
          if (estado >= 400) {
            anotar(rol, href, "ruta-carga", false, `HTTP ${estado}`);

            return;
          }
          const m = await medir(page);

          await test.step("tokens", async () => {
            if (oscuro) return;
            const v = m.variables;
            const fallos = [
              v["--primary"] !== "#177a99" && `--primary=${v["--primary"] || "∅"}`,
              v["--destructive"] !== "#b91c1c" && `--destructive=${v["--destructive"] || "∅"}`,
              v["--ring"] !== "#2096ba" && `--ring=${v["--ring"] || "∅"}`,
              v["--canvas"] !== "#f5f7f9" && `--canvas=${v["--canvas"] || "∅"}`,
              m.fondoBody !== "rgb(245, 247, 249)" && `body=${m.fondoBody}`,
            ].filter(Boolean);
            anotar(rol, href, "tokens", fallos.length === 0, fallos.join("; "));
          });

          await test.step("sin-negro", async () => {
            if (oscuro) return;
            anotar(rol, href, "sin-negro", m.oscuros.length === 0, `${m.oscuros.length} fondos oscuros: ${m.oscuros.slice(0, 2).join(" | ")}`);
          });

          await test.step("sin-dashboard-en-modulos", async () => {
            if (esInicio(href) || esReporte(href)) return;
            anotar(rol, href, "sin-dashboard-en-modulos", m.graficos === 0 && m.kpis === 0, `gráficos=${m.graficos}, KPIs=${m.kpis}`);
          });

          await test.step("accion-primero", async () => {
            if (m.listaTop === null) return;
            anotar(rol, href, "accion-primero", m.listaTop < 420, `la primera lista empieza en y=${m.listaTop}px`);
          });

          await test.step("un-primario", async () => {
            anotar(rol, href, "un-primario", m.primarios <= 1, `${m.primarios} botones primarios en el header`);
          });

          await test.step("vencidas-visibles", async () => {
            if (!/\/tareas$/.test(href)) return;
            const incluyeVencidas = /abiert|todas|vencid|open|all|overdue/i.test(m.chipActivo);
            const ok = m.nVencidas === 0 || m.vencidasVisibles > 0 || incluyeVencidas;
            anotar(rol, href, "vencidas-visibles", ok, `chip Vencidas=${m.tieneChipVencidas ? m.nVencidas : "no existe"}, filtro por defecto="${m.chipActivo}", vencidas visibles=${m.vencidasVisibles}`);
          });

          await test.step("sin-blanco", async () => {
            if (!oscuro) return;
            anotar(rol, href, "sin-blanco", m.blancos.length === 0, `${m.blancos.length} fondos casi blancos: ${m.blancos.slice(0, 3).join(" | ")}`);
          });

          await test.step("contraste-oscuro", async () => {
            if (!oscuro) return;
            await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") }).catch(() => {});
            const informe = await page.evaluate(async () => (window as any).axe.run(document.body, { runOnly: ["color-contrast"] }).then((r: { violations: { nodes: { target: string[]; any: { data?: { contrastRatio?: number } }[] }[] }[] }) => r.violations.flatMap((v) => v.nodes.map((n) => `${n.target.join(" ")} ${n.any[0]?.data?.contrastRatio ?? ""}`)))).catch(() => ["axe no cargó"]);
            anotar(rol, href, "contraste-oscuro", informe.length === 0, `${informe.length} textos bajo 4,5:1: ${informe.slice(0, 3).join(" | ")}`);
          });

          await test.step("altura-botones", async () => {
            anotar(rol, href, "altura-botones", m.alturasMalas.length === 0, `fuera de 32/36/44 px: ${m.alturasMalas.slice(0, 4).join(", ")}`);
          });

          await test.step("secundario-visible", async () => {
            anotar(rol, href, "secundario-visible", m.secundariosIguales.length === 0, `mismo fondo que su contenedor: ${m.secundariosIguales.slice(0, 4).join(", ")}`);
          });

          await test.step("acciones-dentro", async () => {
            anotar(rol, href, "acciones-dentro", m.botonesFuera.length === 0, `sobresalen de su tabla: ${m.botonesFuera.slice(0, 4).join(", ")}`);
          });

          await test.step("titulo = modulo", async () => {
            // `/inicio` abre con el saludo («Buenos días, {nombre}»), no con el nombre del módulo: es la excepción de diseño.
            if (esInicio(href)) return;
            const esModulo = !!m.h1 && m.activos.some((a) => norm(a) === norm(m.h1!));
            const igualAPestana = !!m.h1 && m.pestanasActivas.some((a) => norm(a) === norm(m.h1!));
            anotar(rol, href, "titulo = modulo", esModulo && !igualAPestana, `h1="${m.h1}" · módulo=${JSON.stringify(m.activos)} · pestaña=${JSON.stringify(m.pestanasActivas)}`);
          });
        });
      }
    });
  }

  test("inicio-unico: rutas viejas redirigen (308) a /inicio", async ({ request }) => {
    for (const vieja of ["/ejecutivo", "/bandeja", "/administrativo", "/contabilidad/mi-dia", "/portal/contabilidad", "/portal/profesor", "/portal/estudiante"]) {
      const r = await request.get(vieja, { maxRedirects: 0 });
      const destino = r.headers()["location"] ?? "";
      anotar("owner", vieja, "inicio-unico", r.status() === 308 && /\/inicio$/.test(destino), `HTTP ${r.status()} → ${destino || "(sin location)"}`);
    }
  });
});
