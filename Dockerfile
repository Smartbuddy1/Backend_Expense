# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Install openssl (required for Prisma)
RUN apk add --no-cache openssl

# Copy package files and install ALL dependencies
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci

# Generate Prisma client
RUN npx prisma generate

# Copy application source
COPY . .

# Production stage
FROM node:18-alpine

WORKDIR /app

# Install openssl for production Prisma client
RUN apk add --no-cache openssl

# Copy production dependencies and built code from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src ./src

# Expose backend port
EXPOSE 5000

# Start the server
CMD ["npm", "start"]
