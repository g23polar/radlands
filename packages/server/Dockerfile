FROM node:20-slim

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copy workspace files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/core/package.json ./packages/core/
COPY packages/server/package.json ./packages/server/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/core ./packages/core
COPY packages/server ./packages/server

# Build core package
RUN pnpm --filter @radlands/core build

# Expose port
ENV PORT=3001
EXPOSE 3001

# Start server
CMD ["pnpm", "--filter", "@radlands/server", "start"]
