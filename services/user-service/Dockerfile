FROM node:20-alpine AS builder

WORKDIR /app

# Copy root package files
COPY package.json package-lock.json* ./
COPY tsconfig.base.json ./

# Copy shared package
COPY packages/shared/package.json ./packages/shared/
COPY packages/shared/tsconfig.json ./packages/shared/
COPY packages/shared/src ./packages/shared/src

# Copy user-service package
COPY services/user-service/package.json ./services/user-service/
COPY services/user-service/tsconfig.json ./services/user-service/

# Install all deps
RUN npm install --workspaces --include-workspace-root

# Copy source
COPY services/user-service/src ./services/user-service/src

# Build shared first, then service
RUN npm run build -w packages/shared
RUN npm run build -w services/user-service

# --- Production stage ---
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY services/user-service/package.json ./services/user-service/

RUN npm install --workspaces --include-workspace-root --omit=dev

COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/services/user-service/dist ./services/user-service/dist

WORKDIR /app/services/user-service

EXPOSE 3001

CMD ["node", "dist/index.js"]
