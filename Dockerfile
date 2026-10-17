FROM node:20-alpine

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

# Decirle a Puppeteer que NO descargue su propio Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# Chromium corre con --no-sandbox (ver browserPool.js); que además corra como
# root dentro del contenedor duplica el riesgo de un escape del navegador.
# uid/gid 501 coincide con el dueño de ./storage en el host (bind mount con
# permisos 700), así el proceso deja de ser root pero conserva el mismo
# acceso a storage/certs que tenía, sin aflojar permisos en el host.
RUN addgroup -g 501 appuser \
    && adduser -D -u 501 -G appuser appuser \
    && chown -R appuser:appuser /app
USER appuser

EXPOSE 3000

CMD ["node", "main.js"]
