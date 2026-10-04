================================================================
  PROMPT — ESTRUCTURA Y ESTILO DE LA PÁGINA DE INICIO
  Global Effect Nexus
================================================================

Crea una página de inicio (landing page) para el ERP institucional
de la "Global Effect Foundation" (sistema de gestión con portal del
estudiante integrado). La página debe ser
pública (sin login), completamente responsive (mobile + desktop),
con estética moderna, limpia e institucional. Usar React + Tailwind
CSS. Color primario institucional: #2096BA (turquesa corporativo).

A continuación se detalla la estructura sección por sección, desde
el hero hasta el footer:

------------------------------------------------------------------
1. NAVBAR STICKY (Header fijo superior)
------------------------------------------------------------------
• Fondo: blanco translúcido con blur (bg-white/90 backdrop-blur-md)
• Borde inferior sutil (border-b border-slate-200/80)
• Altura: h-16, contenedor max-w-6xl centrado
• IZQUIERDA: Logo de la fundación (imagen, h-9) clicable al inicio
• CENTRO (desktop, hidden en mobile): 3 enlaces de navegación
  con anchor links (#portales, #eventos, #footer), texto slate-600,
  hover slate-900
• DERECHA: 2 elementos:
  - Botón "Inscripción de Comida" (bg amber-500, texto blanco,
    rounded-xl, icono utensils, hover amber-600, shadow-sm)
  - Badge "Sistema activo" (bg emerald-50, texto emerald-600,
    borde emerald-200, punto verde pulsante)

------------------------------------------------------------------
2. HERO SLIDER (Carrusel de anuncios)
------------------------------------------------------------------
• Altura mínima: 72vh, overflow-hidden, posición relative
• FONDO: imagen de Unsplash a pantalla completa (bg-cover bg-center)
  con transición de opacidad (duration-700) al cambiar de slide
• OVERLAY: gradiente vertical oscuro (from-slate-900/60 →
  via-slate-900/70 → to-slate-900/90) para legibilidad del texto
• CONTENIDO centrado (text-center, text-white, z-10):
  - Tag opcional (pill colored, texto blanco, icono sparkles)
    ej: "Convocatoria Abierta" en verde #10b981
  - Título H1 grande: font-bold, clamp(28px, 5.5vw, 56px),
    letter-spacing -0.03em, max-w-3xl, blanco
  - Descripción: texto slate-300, clamp(14px, 2vw, 18px),
    max-w-xl, mb-10
  - Botones de acción (flex-wrap gap-3 justify-center):
    * Botón primario: bg #2096BA, texto blanco, hover #187a99,
      shadow-lg shadow-[#2096BA]/30, hover -translate-y-0.5
    * Botón secundario: bg-white/10, texto blanco, borde white/25,
      backdrop-blur-sm, hover bg-white/20
    * Cada botón con icono (lucide-react) + label
• CONTROLES del slider:
  - Botón anterior/siguiente (izquierda/derecha, centrados vertical):
    w-10 h-10, rounded-full, bg-white/10, hover bg-white/25,
    borde white/20, backdrop-blur-sm, icono chevron
  - Indicadores (bottom-6, centrados): pills que cambian de tamaño
    (activo: w-8 h-2 bg-white / inactivo: w-2 h-2 bg-white/40)
• ROTACIÓN automática cada 6 segundos (setInterval)
• Transición suave: 150ms de fade-out antes de cambiar

3 SLIDES:
  Slide 1: "Transformando Vidas a Través de la Educación"
    - Botones: "Cursos Técnicos" (primario) + "Solicitar un
      trámite" (secundario, lleva al portal del estudiante)
  Slide 2: "Becas Universitarias 2026" (tag verde "Convocatoria
    Abierta")
    - Botón: "Ver Requisitos" (primario)
  Slide 3: "Reunión de Coordinación Docente" (tag ámbar "Aviso
    Importante")
    - Botón: "Ver Calendario" (primario)

------------------------------------------------------------------
3. BARRA DE ESTADÍSTICAS (Stats Bar)
------------------------------------------------------------------
• Fondo blanco, borde inferior sutil
• Contenedor max-w-6xl, grid 2 columnas (mobile) / 4 columnas
  (desktop) con divisores verticales (divide-x divide-slate-100)
• 4 estadísticas centradas:
  - Icono pequeño (w-5 h-5, color #2096BA) arriba
  - Valor grande (text-2xl font-bold text-slate-900)
  - Label pequeño (text-xs text-slate-500) abajo
• Datos: 1,200+ Estudiantes / 86 Materias / 340+ Patrocinadores /
  98% Satisfacción

------------------------------------------------------------------
4. SECCIÓN DE PORTALES (Grid de tarjetas)
------------------------------------------------------------------
• ID: #portales, padding py-16 md:py-20
• ENCABEZADO centrado:
  - Eyebrow: texto xs, uppercase, tracking-widest, color #2096BA
    ("Acceso al Sistema")
  - Título H2: text-3xl md:text-4xl, font-bold, slate-900
    ("Selecciona tu portal")
  - Subtítulo: text-slate-500, max-w-lg, text-sm
• GRID: 1 col (mobile) / 2 cols (sm) / 3 cols (lg), gap-5
• TARJETAS (6 portales, cada una es un <button> clicable):
  - Fondo blanco, rounded-2xl, borde slate-200/80
  - Hover: -translate-y-1.5, shadow-xl, borde se ilumina
  - Barra superior de 1px de altura que cambia de gris a gradiente
    de color al hacer hover
  - Interior (p-6):
    * Icono en cuadro redondeado (w-12 h-12, rounded-xl) con
      gradiente de color del portal, shadow-sm, group-hover:scale-110
    * Título H3: font-bold, text-base, slate-900
    * Descripción: text-sm, slate-500, leading-relaxed
    * Lista de features (3 items) con icono check verde del color
      de acento del portal, text-xs
    * CTA "Acceder al portal" + icono arrow-right que se desplaza
      al hacer hover (group-hover:translate-x-1)
  - Cada portal tiene su propio color de gradiente:
    * Administración Global → #2096BA → #187a99
    * Portal del Estudiante → #2096BA → #0a6a8a
    * Contabilidad → #059669 → #047857
    * Cursos Técnicos → #2096BA → #187a99
    * Portal Administrativo → #d97706 → #b45309
    * Solicitudes y trámites → #187a99 → #0a6a8a

------------------------------------------------------------------
5. PRÓXIMOS EVENTOS (Condicional, solo si hay eventos)
------------------------------------------------------------------
• ID: #eventos, fondo blanco, borde superior e inferior
• ENCABEZADO con flex justify-between:
  - IZQUIERDA: eyebrow "Calendario Institucional" (#2096BA) +
    título H2 "Próximos Eventos"
  - DERECHA: botón "Ver todos" con icono external-link
    (color #2096BA, hover underline, hidden en mobile)
• GRID: 1/2/4 columnas, gap-4
• TARJETAS de evento (bg-slate-50, rounded-xl, borde slate-200):
  - Icono calendario en cuadro (bg #2096BA/10, texto #2096BA)
  - Título del evento (font-semibold, text-sm, slate-900)
  - Fecha formateada en español (dd 'de' MMMM, yyyy)
  - Ubicación con icono map-pin (text-xs, slate-400)
  - Hover: borde #2096BA/40, bg #2096BA/5

------------------------------------------------------------------
6. PROPUESTA DE VALOR (Trust Strip)
------------------------------------------------------------------
• Padding py-14, contenedor max-w-6xl
• GRID de 3 columnas (md), gap-6
• 3 tarjetas horizontales (flex gap-4, bg blanco, rounded-2xl,
  borde slate-200/80, p-5):
  1. "Acceso Seguro por Roles" (icono Shield)
     — RBAC, cada usuario solo ve lo que le corresponde
  2. "Reportes en Tiempo Real" (icono BarChart3)
     — Analíticas de estudiantes, finanzas, calificaciones
  3. "Asistente IA Integrado" (icono Bot)
     — Consultas inteligentes 24/7
• Icono en cuadro redondeado (w-10 h-10, bg #2096BA/10,
  texto #2096BA), título font-semibold text-sm, descripción
  text-xs slate-500

------------------------------------------------------------------
7. FOOTER (Pie de página)
------------------------------------------------------------------
• Fondo slate-900 (casi negro)
• Borde superior de 4px en color #2096BA (border-t-4)
• Contenedor max-w-6xl, padding py-12
• GRID 4 columnas (md), gap-8:
  COLUMNA 1 (Marca, md:col-span-1):
    - Logo de la fundación (brightness-200 para verse en oscuro)
    - Tagline: "Bringing Hope · Changing Lives · Transforming
      Communities" (text-slate-400, text-xs)
    - 3 iconos de redes sociales (Instagram, Facebook, Globe):
      w-8 h-8, rounded-lg, bg-white/5, hover bg-white/10,
      texto slate-400 → hover white, SVG inline

  COLUMNAS 2-4 (Enlaces, 3 nav):
    - "Plataforma": Portal Académico, Contabilidad, Solicitudes
      y trámites, Gestión de Becas
    - "Institución": Sobre Nosotros, Programas Académicos,
      Donaciones, Noticias
    - "Soporte": Centro de Ayuda, Soporte Técnico, Términos de Uso,
      Privacidad
    - Cada columna: título H3 blanco font-semibold text-sm +
      lista de enlaces (text-slate-400 text-xs hover white)

• BARRA INFERIOR (border-t border-slate-800, pt-6):
  - Flex justify-between, text-xs text-slate-500:
    * "© 2026 Global Effect Foundation. Todos los derechos
      reservados."
    * "Plataforma Integral de Gestión Educativa"

------------------------------------------------------------------
PALETA DE COLORES Y ESTILO GENERAL
------------------------------------------------------------------
• Fondo principal: slate-50 (gris muy claro)
• Texto principal: slate-900 (casi negro)
• Texto secundario: slate-500 / slate-400
• Color de acento institucional: #2096BA (turquesa)
  - Hover: #187a99
  - Variantes translúcidas: #2096BA/10, #2096BA/5
• Bordes: slate-200/80 (sutil)
• Tipografía: sans-serif del sistema (font-sans)
• Rounded: xl y 2xl para tarjetas, xl para botones
• Shadows: shadow-sm normal, shadow-xl en hover
• Transiciones: duration-200 a duration-700 según elemento
• Iconos: lucide-react exclusivamente
• Imágenes: Unsplash con params ixlib=rb-4.0.3&auto=format&fit=crop

ACCESIBILIDAD:
• ARIA labels en todos los botones de control del slider
• role="tablist" en indicadores, role="tab" en cada uno
• aria-label en secciones (aria-labelledby en headings)
• alt en imágenes, role="img" en backgrounds decorativos
• focus-visible:ring-2 ring-[#2096BA] en tarjetas clickeables

================================================================
  FIN DEL PROMPT
================================================================