# Pruebas

Todo corre en Docker; no hace falta Node en la máquina.

```bash
tests/integracion/correr.sh              # unitarias (Jest) + todas las de integración
tests/integracion/correr.sh caja sesion  # solo esas pruebas de integración
```

## Qué garantiza el entorno (`docker-compose.test.yml`)

- **Sin Internet**: la red `aislada` es `internal: true`. Ninguna prueba puede llegar a SUNAT, ni beta ni producción. Además, las URLs SUNAT apuntan a `127.0.0.1:9`.
- **Postgres y Redis desechables**, en memoria. No se usa `postgres_db` ni la BD `servicios`.
- **Certificado autofirmado** generado en cada corrida (`tests/integracion/certificadoPrueba.js`). Nunca se lee `storage/certs`.
- **Secretos aleatorios** en cada corrida (`JWT_SECRET`, `DATA_ENCRYPTION_KEY`).
- Cada `*.prueba.js` recibe una BD nueva, migrada desde cero con las migraciones reales.

## Suites

| Tipo | Archivo | Qué cubre |
|---|---|---|
| Unitaria | `tests/unit/calculoComprobante.test.js` | IGV por línea, totales en céntimos |
| Unitaria | `tests/unit/plazosSunat.test.js` | D+3 factura, D+5 boleta, fin de mes y año |
| Unitaria | `tests/unit/cifrado.test.js` | AES-GCM, contexto (AAD), alteración |
| Unitaria | `tests/unit/cdrParser.test.js` | ACEPTADO / OBSERVADO / RECHAZADO, CDR ilegible |
| Unitaria | `tests/unit/xmlBuilders.test.js` | XML bien formado, IGV de línea, inyección por `]]>`, snapshot |
| Unitaria | `tests/unit/permisos.test.js` | Matriz: denegar por defecto, solo-admin, formatos |
| Unitaria | `tests/unit/validaciones.test.js` | Contraseñas, documentos, emisión, guía, magic bytes, lista blanca |
| Integración | `emision.prueba.js` | 20 emisiones concurrentes, rollback, NC, inmutabilidad |
| Integración | `caja.prueba.js` | Caja global, desglose, cierre, caja cerrada inmutable |
| Integración | `sesion.prueba.js` | Login, refresh rotativo, robo de refresh, revocación, rate limit |
| Integración | `permisos.prueba.js` | Cobertura de la matriz sobre el router real, credenciales cifradas, subidas, guía atómica |
| Integración | `vigilante.prueba.js` | Reencolado, FUERA_PLAZO, pendientes, health |
| Integración | `pdf.prueba.js` | PDFs reales con puppeteer-core y el Chromium del sistema |

El snapshot del XML (`tests/unit/__snapshots__`) se actualiza a propósito: `docker compose -f docker-compose.test.yml run --rm pruebas npx jest -u` (quitando `:ro` del volumen de tests).

## CI (`.github/workflows/ci.yml`)

En cada push corren:

- **Secretos:** gitleaks sobre el árbol actual.
- **Vulnerabilidades:** `scripts/auditar-dependencias.js`. Falla ante cualquier vulnerabilidad de producción que no esté en `audit-excepciones.json` o cuya excepción venció.
- **Pruebas:** las de este documento.
- **Imagen de producción:** se verifica que no lleve certificados, llaves, pruebas ni Jest.
