FROM node:22-alpine AS dependencies

WORKDIR /app
COPY package*.json ./
COPY apps/api/package*.json apps/api/
COPY apps/admin-web/package*.json apps/admin-web/
COPY apps/display-web/package*.json apps/display-web/
COPY apps/audio-player/package*.json apps/audio-player/
COPY packages/shared-types/package*.json packages/shared-types/
RUN npm ci

FROM dependencies AS api-build
COPY apps/api apps/api
RUN npm run prisma:generate -w apps/api && npm run build -w apps/api

FROM dependencies AS web-build
ARG WEB_APP
COPY apps/${WEB_APP} apps/${WEB_APP}
COPY packages/shared-types packages/shared-types
ARG VITE_API_URL
ARG VITE_SOCKET_URL
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_SOCKET_URL=${VITE_SOCKET_URL}
RUN npm run build -w apps/${WEB_APP}

FROM node:22-alpine AS api

WORKDIR /app
ENV NODE_ENV=production
COPY --from=api-build /app/package*.json ./
COPY --from=api-build /app/apps/api/package*.json apps/api/
COPY --from=api-build /app/apps/admin-web/package*.json apps/admin-web/
COPY --from=api-build /app/apps/display-web/package*.json apps/display-web/
COPY --from=api-build /app/apps/audio-player/package*.json apps/audio-player/
COPY --from=api-build /app/packages/shared-types/package*.json packages/shared-types/
RUN npm ci --omit=dev
COPY --from=api-build /app/apps/api/dist apps/api/dist
COPY --from=api-build /app/apps/api/prisma apps/api/prisma
COPY --from=api-build /app/node_modules/.prisma node_modules/.prisma
RUN mkdir -p /app/storage/audio
EXPOSE 3000
CMD ["npm", "run", "start", "-w", "apps/api"]

FROM nginx:1.27-alpine AS web

ARG WEB_APP
COPY nginx-spa.conf /etc/nginx/conf.d/default.conf
COPY --from=web-build /app/apps/${WEB_APP}/dist /usr/share/nginx/html
EXPOSE 80
