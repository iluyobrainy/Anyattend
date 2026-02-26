FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY apps/pwa/package.json ./apps/pwa/package.json
RUN npm install --workspaces
COPY . .
RUN npm run build -w apps/pwa

FROM caddy:2.8-alpine
COPY --from=build /app/apps/pwa/dist /srv
EXPOSE 80
