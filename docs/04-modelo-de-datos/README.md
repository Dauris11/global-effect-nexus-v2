# 03 · Modelo de Datos — Global Effect Nexus

Documentación del modelo de datos relacional (PostgreSQL 17 / Supabase), desplegado y verificado.

## Contenido

| Documento | Descripción |
|---|---|
| [Diagrama Entidad-Relación](diagrama-entidad-relacion.md) | ERD en Mermaid: diagrama global + por dominio, con atributos y cardinalidades. |
| [Diagrama de Flujo de Datos (DFD)](diagrama-flujo-datos.md) | Contexto (Nivel 0) y procesos (Nivel 1): entidades externas, procesos y almacenes. |
| [Diccionario de Datos](diccionario-de-datos.md) | Definición completa de las tablas del núcleo, columnas, tipos, constraints e índices. |
| [Normalización y Escalabilidad](normalizacion-y-escalabilidad.md) | Justificación SMART, formas normales (1NF–3NF), escalabilidad y soporte de IA. |

## Resumen

- **35 tablas** en 11 dominios funcionales (tras `0031`: salen las tres tablas de psicología y entran `solicitud` y `solicitud_paso`; tras `0047`: salen `curso` y `calificacion`, porque la Fundación dejó de impartir cursos técnicos).
- **6 tipos ENUM** (la `0047` retira `tipo_evaluacion` y deja `tipo_estudiante` solo con `becado`), **39 claves foráneas**, **20 triggers** de auditoría de fecha.
- **Extensiones:** `pgcrypto` (UUID), `citext` (emails), `pg_trgm` (búsqueda difusa), `vector`/pgvector (IA/RAG).
- **Normalizado a 3NF** con expediente estudiantil descompuesto y solicitudes con historial de pasos auditable.

El DDL fuente son las migraciones en [`db/migrations/`](../../db/migrations/); la guía de despliegue está en [`db/README.md`](../../db/README.md).
