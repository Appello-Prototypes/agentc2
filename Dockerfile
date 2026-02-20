# Multi-stage Dockerfile for AgentC2 AI Agent Framework
# Optimized for Digital Ocean Droplet deployment with MCP and Playwright support

# ============================================
# Stage 1: Base image with system dependencies
# ============================================
FROM oven/bun:1.3.4-debian AS base

WORKDIR /app

# Install system dependencies for Playwright and MCP servers
RUN apt-get update && apt-get install -y \
    # Playwright browser dependencies
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpango-1.0-0 \
    libcairo2 \
    # Node.js for npx/MCP servers
    nodejs \
    npm \
    # Git for deployment
    git \
    # CA certificates for HTTPS
    ca-certificates \
    # Clean up
    && rm -rf /var/lib/apt/lists/*

# ============================================
# Stage 2: Install dependencies
# ============================================
FROM base AS deps

# Copy package files for dependency installation
COPY package.json bun.lock turbo.json ./
COPY packages/auth/package.json ./packages/auth/
COPY packages/database/package.json ./packages/database/
COPY packages/agentc2/package.json ./packages/agentc2/
COPY packages/ui/package.json ./packages/ui/
COPY packages/next-config/package.json ./packages/next-config/
COPY packages/typescript-config/package.json ./packages/typescript-config/
COPY apps/agent/package.json ./apps/agent/
COPY apps/frontend/package.json ./apps/frontend/

# Install all dependencies
RUN bun install --frozen-lockfile

# ============================================
# Stage 3: Build application
# ============================================
FROM deps AS builder

# Copy source code
COPY . .

# Generate Prisma client
RUN bun run db:generate

# Build all applications
ENV NODE_ENV=production
RUN bun run build

# ============================================
# Stage 4: Production runner
# ============================================
FROM base AS runner

WORKDIR /app

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 agentc2
USER agentc2

# Copy built application from builder
COPY --from=builder --chown=agentc2:nodejs /app ./

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000
ENV AGENT_PORT=3001

# Expose ports for frontend and agent apps
EXPOSE 3000 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/ || exit 1

# Default command (override with docker-compose or PM2)
CMD ["bun", "run", "start"]
