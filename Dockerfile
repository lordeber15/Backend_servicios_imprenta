# ── Base común: sistema y Chromium ─────────────────────────────────────
FROM node:20-alpine AS base

# Chromium del repositorio de Alpine (arquitectura nativa: funciona en x86 y ARM)
RUN apk add --no-cache \
      chromium \
      nss \
      freetype \
      harfbuzz \
      ca-certificates \
      ttf-freefont \
      postgresql17-client
# postgresql17-client: pg_dump para el backup automático previo a cada
# migración (misma versión mayor que el servidor Postgres 17).

# puppeteer-core no descarga navegador: usa este Chromium del sistema.
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

WORKDIR /app
COPY package*.json ./

# Chromium corre con --no-sandbox (ver browserPool.js); que además corra como
# root dentro del contenedor duplica el riesgo de un escape del navegador.
# uid/gid 501 coincide con el dueño de ./storage en el host (bind mount con
# permisos 700), así el proceso deja de ser root pero conserva el mismo
# acceso a storage/certs que tenía, sin aflojar permisos en el host.
RUN addgroup -g 501 appuser && adduser -D -u 501 -G appuser appuser

# ── Pruebas: con dependencias de desarrollo (jest). Solo docker-compose.test.yml ──
# Los tests no se hornean (están en .dockerignore): se montan en /app/tests.
FROM base AS test
RUN npm ci
COPY . .
RUN chown -R appuser:appuser /app
USER appuser
CMD ["npm", "test"]

# ── Producción (etapa por defecto: debe quedar la última) ───────────────
FROM base AS produccion
RUN npm ci --omit=dev
COPY . .
RUN chown -R appuser:appuser /app
USER appuser

EXPOSE 3000

CMD ["node", "main.js"]
