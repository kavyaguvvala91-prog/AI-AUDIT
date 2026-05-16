FROM node:20-alpine AS frontend-build

WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./

ARG VITE_API_BASE_URL=/api/v1
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN npm run build

FROM node:20-alpine AS backend-deps

WORKDIR /app/backend/server

COPY backend/server/package*.json ./
RUN npm ci --omit=dev

FROM node:20-alpine AS runtime

ENV NODE_ENV=production

WORKDIR /app/backend/server

COPY backend/server/ ./
COPY --from=backend-deps /app/backend/server/node_modules ./node_modules
COPY --from=frontend-build /app/frontend/dist /app/frontend/dist

RUN mkdir -p uploads

EXPOSE 5000

CMD ["node", "server.js"]
