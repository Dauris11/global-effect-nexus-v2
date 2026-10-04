"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AZUL_OSCURO, FINANZAS, GRAFICA, SERIE, TINTA } from "@/lib/paleta";

/**
 * Las gráficas del panel.
 *
 * Van juntas en un archivo porque comparten lo que las hace parecer del mismo
 * sitio: el gris de los ejes, el estilo del globo de datos y la altura. Separar
 * cada una en su archivo obligaba a repetir esas tres decisiones tres veces, y
 * repetirlas es exactamente cómo dejan de coincidir.
 *
 * Son cliente porque recharts mide el contenedor en el navegador, pero reciben
 * los datos ya consultados y los textos ya traducidos: aquí no se calcula nada
 * ni se lee ningún mensaje, así que no viaja al navegador ni el diccionario ni
 * una segunda copia de las cifras.
 *
 * Ninguna dibuja eje ni rejilla de más. Una gráfica de panel se mira dos
 * segundos para saber si algo va bien o mal; las marcas que no ayudan a eso
 * solo tapan las barras. Por eso la rejilla, donde la hay, es solo horizontal
 * y en `GRAFICA.rejilla`: ayuda a leer la altura sin cuadricular la tarjeta.
 */

/**
 * Estilo del globo de datos, igual en todas: el de un popover de la norma
 * (`rounded-control`, `shadow-elevada`, borde `linea`). Va con las variables
 * CSS y no con hex porque el globo es HTML, no SVG, y así sigue al modo oscuro
 * como el resto de las superficies.
 */
const GLOBO = {
  contentStyle: {
    borderRadius: "var(--radius-control)",
    border: "1px solid var(--linea)",
    background: "var(--card)",
    color: "var(--tinta)",
    fontSize: 13,
    padding: "8px 12px",
    boxShadow: "var(--shadow-elevada)",
  },
  labelStyle: { fontWeight: 600, color: "var(--tinta)", marginBottom: 2 },
  itemStyle: { padding: 0 },
  cursor: { fill: GRAFICA.rejilla, fillOpacity: 0.5 },
} as const;

/** Rejilla horizontal, sin verticales: se lee la altura, no la columna. */
const REJILLA = {
  vertical: false,
  stroke: GRAFICA.rejilla,
  strokeDasharray: "3 3",
} as const;

const EJE = { fontSize: 11, fill: GRAFICA.texto } as const;

/**
 * Ingresos y egresos por mes, en barras enfrentadas.
 *
 * Barras y no líneas: son doce valores sueltos por serie, no una tendencia
 * continua, y una línea entre dos meses sugiere que hubo algo en medio.
 */
export function GraficaFlujo({
  datos,
  etiquetas,
}: {
  datos: readonly { mes: string; ingresos: number; egresos: number }[];
  etiquetas: { ingresos: string; egresos: string; vacio: string };
}) {
  // Sin un solo movimiento no se dibuja una rejilla vacía con seis meses a cero:
  // parece una gráfica rota y en realidad es que no hay nada que contar.
  const hayAlgo = datos.some((mes) => mes.ingresos > 0 || mes.egresos > 0);

  if (!hayAlgo) return <Vacio texto={etiquetas.vacio} />;

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={[...datos]} barGap={2}>
        <CartesianGrid {...REJILLA} />
        <XAxis
          dataKey="mes"
          tick={EJE}
          axisLine={{ stroke: GRAFICA.rejilla }}
          tickLine={false}
          tickFormatter={(mes: string) => mes.slice(5)}
        />
        <YAxis tick={EJE} axisLine={false} tickLine={false} width={44} />
        {/* El monto con su símbolo y sus miles: "$12,400" y no "12400". El
            tipo del formateador de recharts admite valor ausente, así que se
            comprueba antes de darle formato. */}
        <Tooltip
          {...GLOBO}
          formatter={(valor, nombre) => [
            typeof valor === "number" ? `$${valor.toLocaleString()}` : "—",
            String(nombre ?? ""),
          ]}
        />
        <Bar
          dataKey="ingresos"
          name={etiquetas.ingresos}
          fill={FINANZAS.ingreso}
          radius={[4, 4, 0, 0]}
        />
        <Bar
          dataKey="egresos"
          name={etiquetas.egresos}
          fill={FINANZAS.egreso}
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

/**
 * Reparto en anillo: tareas por prioridad, estudiantes por programa.
 *
 * Anillo y no tarta: el hueco del centro deja sitio al total, que es el número
 * que se busca primero. Cada porción trae su color decidido por quien llama,
 * porque el de una prioridad no es libre —urgente es tinta y punto—.
 */
export function GraficaAnillo({
  datos,
  total,
  etiquetaTotal,
  vacio,
}: {
  datos: readonly { nombre: string; valor: number; color: string }[];
  total: number;
  etiquetaTotal: string;
  vacio: string;
}) {
  if (total === 0) return <Vacio texto={vacio} />;

  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={[...datos]}
            dataKey="valor"
            nameKey="nombre"
            innerRadius={58}
            outerRadius={82}
            paddingAngle={2}
            strokeWidth={0}
          >
            {datos.map((porcion) => (
              <Cell key={porcion.nombre} fill={porcion.color} />
            ))}
          </Pie>
          <Tooltip {...GLOBO} />
        </PieChart>
      </ResponsiveContainer>

      {/* El total, centrado en el hueco. `pointer-events-none` para no robarle
          el ratón a las porciones que hay debajo. */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[28px] leading-none font-semibold tracking-tight text-tinta">
          {total}
        </span>
        <span className="texto-meta mt-1">{etiquetaTotal}</span>
      </div>
    </div>
  );
}

/**
 * Barras horizontales para comparar unas pocas categorías con nombre largo.
 *
 * En vertical, "Academia de liderazgo" no cabe bajo su barra y recharts lo
 * gira; girado no se lee. En horizontal el nombre va a su izquierda, derecho.
 */
export function GraficaBarras({
  datos,
  vacio,
}: {
  datos: readonly { nombre: string; valor: number; color?: string }[];
  vacio: string;
}) {
  if (datos.every((fila) => fila.valor === 0)) return <Vacio texto={vacio} />;

  return (
    <ResponsiveContainer width="100%" height={Math.max(120, datos.length * 42)}>
      <BarChart data={[...datos]} layout="vertical" margin={{ left: 4, right: 12 }}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="nombre"
          tick={EJE}
          axisLine={false}
          tickLine={false}
          width={110}
        />
        <Tooltip {...GLOBO} />
        <Bar dataKey="valor" radius={[0, 6, 6, 0]} barSize={18}>
          {datos.map((fila, indice) => (
            <Cell
              key={fila.nombre}
              fill={fila.color ?? SERIE[indice % SERIE.length]}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/**
 * Índice académico a lo largo de los cuatrimestres.
 *
 * ES LA ÚNICA LÍNEA DEL SISTEMA, y aquí sí toca: los cuatrimestres de un
 * estudiante son consecutivos y lo que se lee es la PENDIENTE —si va subiendo o
 * cayendo—, no el valor de cada uno. Es justo lo contrario del flujo financiero,
 * que son doce valores sueltos y va en barras.
 *
 * El eje va de 0 a 4: es una escala fija, no una que se ajuste a los datos. Con
 * el eje automático, un estudiante entre 3.6 y 3.8 dibujaría una montaña
 * dramática y otro entre 1.0 y 3.5 una línea plana, y las dos serían mentira.
 *
 * La línea de la prueba académica se dibuja siempre, incluso si nadie está
 * cerca: es la referencia contra la que se lee el resto, y esconderla cuando no
 * hace falta dejaría la gráfica sin nada con lo que comparar.
 */
export function GraficaTendencia({
  datos,
  umbral,
  etiquetas,
}: {
  datos: readonly { periodo: string; indice: number; materias: number }[];
  /** Índice por debajo del cual el estudiante entra en prueba académica. */
  umbral: number;
  etiquetas: { indice: string; umbral: string; vacio: string };
}) {
  if (datos.length === 0) return <Vacio texto={etiquetas.vacio} />;

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={[...datos]} margin={{ left: -16, right: 8, top: 8 }}>
        <CartesianGrid {...REJILLA} />
        <XAxis
          dataKey="periodo"
          tick={EJE}
          axisLine={{ stroke: GRAFICA.rejilla }}
          tickLine={false}
        />
        <YAxis
          tick={EJE}
          axisLine={false}
          tickLine={false}
          domain={[0, 4]}
          ticks={[0, 1, 2, 3, 4]}
          width={44}
        />

        <Tooltip
          {...GLOBO}
          formatter={(valor) => [
            typeof valor === "number" ? valor.toFixed(2) : "—",
            etiquetas.indice,
          ]}
        />

        {/* La referencia, en el negro de la marca y a rayas: es un límite, no
            una serie de datos. */}
        <ReferenceLine
          y={umbral}
          stroke={TINTA}
          strokeDasharray="4 4"
          strokeOpacity={0.5}
          label={{
            value: etiquetas.umbral,
            position: "insideBottomRight",
            fontSize: 10,
            fill: GRAFICA.texto,
          }}
        />

        <Line
          type="monotone"
          dataKey="indice"
          name={etiquetas.indice}
          stroke={AZUL_OSCURO}
          strokeWidth={2}
          // El punto se dibuja siempre: con dos cuatrimestres, una línea sin
          // puntos no dice dónde están las medidas y dónde la interpolación.
          dot={{ r: 3, fill: AZUL_OSCURO, strokeWidth: 0 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Hueco de la misma altura que la gráfica, para que la tarjeta no se encoja. */
function Vacio({ texto }: { texto: string }) {
  return (
    <div className="flex h-[200px] items-center justify-center">
      <p className="texto-meta">{texto}</p>
    </div>
  );
}
