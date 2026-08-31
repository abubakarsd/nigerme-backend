# ─── Stage 1: Build stage ───
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies needed for compiling native modules if any
RUN apk add --no-cache python3 make g++

# Copy dependency manifests
COPY package*.json tsconfig.json ./

# Install all dependencies (including devDependencies for building)
RUN npm ci

# Copy source code
COPY src/ ./src/

# Compile TypeScript
RUN npm run build

# ─── Stage 2: Production runtime ───
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Copy package manifests and install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled JavaScript from builder stage
COPY --from=builder /app/dist ./dist

# Create a non-root user for security
USER node

# Expose HTTP & GraphQL port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/health || exit 1

# Start the sovereign backend server
CMD ["node", "dist/server.js"]
