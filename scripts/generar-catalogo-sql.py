#!/usr/bin/env python3
"""Genera el bloque VALUES del catálogo contable de la migración 0121.

Uso: python3 -I scripts/generar-catalogo-sql.py "<ruta al .xlsx>"

Reescribe, dentro de db/migrations/0121_catalogo_global_effect_v2.sql, lo que hay
entre las marcas `-- INICIO-CATALOGO` y `-- FIN-CATALOGO`. Se deja el script en
el repo para que el SQL de la migración sea reproducible desde el Excel que
entregó la Fundación y no una transcripción a mano.

Por qué se valida tanto: en el Excel los códigos vienen mezclados (números
como 1.1 y textos como '1.1.1'), y un 5.2.3.10 leído como número sería 5.2.3.1.
"""
import re
import sys
from pathlib import Path

import openpyxl

TIPOS = {"1": "activo", "2": "pasivo", "3": "patrimonio", "4": "ingreso", "5": "gasto"}
RAIZ = Path(__file__).resolve().parent.parent
MIGRACION = RAIZ / "db" / "migrations" / "0121_catalogo_global_effect_v2.sql"


def a_texto(valor) -> str:
    # Un código numérico (1, 1.1) llega como int/float; repr() evita perder
    # dígitos. Ninguno de los 5 grupos de dos segmentos termina en cero.
    return repr(valor) if isinstance(valor, float) else str(valor).strip()


def clave(codigo: str):
    # Orden por segmentos numéricos: 5.4.2 antes que 5.4.10.
    return tuple(int(p) for p in codigo.split("."))


def main(ruta: str) -> None:
    hoja = openpyxl.load_workbook(ruta, data_only=True).active
    filas = []
    banco_n = 0
    for cuenta, nombre, recibe in list(hoja.iter_rows(values_only=True))[1:]:
        if cuenta is None:
            continue
        codigo = a_texto(cuenta)
        if not re.fullmatch(r"\d+(\.\d+)*", codigo):
            sys.exit(f"Código inválido: {codigo!r}")
        recibe_norm = "NO" if recibe is None else str(recibe).strip().upper()
        if recibe_norm not in ("SI", "NO"):
            sys.exit(f"Recibe Movimiento inválido en {codigo}: {recibe!r}")
        desc = str(nombre).strip()
        if desc == "Banco Santa Cruz (No. de Cuenta)":
            banco_n += 1
            desc = f"Banco Santa Cruz (No. de Cuenta {banco_n})"
        filas.append((codigo, desc, recibe_norm == "SI"))

    codigos = [f[0] for f in filas]
    if len(set(codigos)) != len(codigos):
        sys.exit("Hay códigos repetidos en el Excel")
    existentes = set(codigos)
    for codigo in codigos:
        if "." in codigo and codigo.rsplit(".", 1)[0] not in existentes:
            sys.exit(f"{codigo} no tiene padre en el Excel")

    # Una cuenta con hijas es agrupadora aunque el Excel diga SI (caso 5.2.1).
    con_hijas = {c.rsplit(".", 1)[0] for c in codigos if "." in c}
    lineas = []
    for codigo, nombre, recibe in sorted(filas, key=lambda f: clave(f[0])):
        admite = recibe and codigo not in con_hijas
        if recibe and not admite:
            print(f"aviso: {codigo} dice SI pero tiene hijas; se carga como agrupadora", file=sys.stderr)
        nombre_sql = nombre.replace("'", "''")
        lineas.append(
            f"  ('{codigo}', '{nombre_sql}', '{TIPOS[codigo[0]]}', {'true' if admite else 'false'})"
        )

    bloque = ",\n".join(lineas)
    texto = MIGRACION.read_text(encoding="utf-8")
    nuevo, n = re.subn(
        r"(-- INICIO-CATALOGO\n).*?(\n  -- FIN-CATALOGO)",
        lambda m: m.group(1) + bloque + m.group(2),
        texto,
        flags=re.S,
    )
    if n != 1:
        sys.exit("No encontré las marcas INICIO-CATALOGO / FIN-CATALOGO en la migración")
    MIGRACION.write_text(nuevo, encoding="utf-8")
    print(f"{len(lineas)} cuentas escritas en {MIGRACION.name}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
