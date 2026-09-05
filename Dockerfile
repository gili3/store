# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package.json only (lock file will be generated during install)
COPY package.json ./

# Install pnpm and generate lock file
RUN npm install -g pnpm && \
    pnpm install --no-frozen-lockfile

# Copy the rest of the source code
COPY . .

# Build the application
RUN pnpm build

# Production stage
FROM node:22-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package.json and generated lock file from builder
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-lock.yaml ./

# Install production dependencies using frozen lockfile
RUN pnpm install --frozen-lockfile

# Copy built application from builder
COPY --from=builder /app/dist ./dist

# Expose port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production

# Start the application
CMD ["node", "dist/index.js"]