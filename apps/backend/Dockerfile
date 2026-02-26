FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
COPY apps/backend/package.json ./apps/backend/package.json
RUN npm install --workspaces

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build -w apps/backend

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/apps/backend/dist ./dist
COPY --from=build /app/apps/backend/sql ./sql
COPY --from=build /app/apps/backend/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
EXPOSE 8080
CMD ["node", "dist/index.js"]
