FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
COPY tsconfig.base.json ./

COPY packages/shared/package.json ./packages/shared/
COPY packages/shared/tsconfig.json ./packages/shared/
COPY packages/shared/src ./packages/shared/src

COPY services/notification-service/package.json ./services/notification-service/
COPY services/notification-service/tsconfig.json ./services/notification-service/

RUN npm install --workspaces --include-workspace-root

COPY services/notification-service/src ./services/notification-service/src

RUN npm run build -w packages/shared
RUN npm run build -w services/notification-service

# --- Production stage ---
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY services/notification-service/package.json ./services/notification-service/

RUN npm install --workspaces --include-workspace-root --omit=dev

COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/services/notification-service/dist ./services/notification-service/dist

WORKDIR /app/services/notification-service

EXPOSE 3002

CMD ["node", "dist/index.js"]
