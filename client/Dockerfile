# --- Build Stage ---
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package manifests
COPY package.json package-lock.json ./

# Install dependencies cleanly
RUN npm ci

# Define build arguments for Vite (baked in at build time)
ARG VITE_NETSUITE_API_ENDPOINT=http://localhost:8000
ENV VITE_NETSUITE_API_ENDPOINT=$VITE_NETSUITE_API_ENDPOINT

# Copy source code and build config
COPY . .

# Build production bundle
RUN npm run build

# --- Production Stage ---
FROM nginx:alpine

# Remove default nginx welcome page
RUN rm -rf /usr/share/nginx/html/*

# Copy built static assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose HTTP port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -q -O /dev/null http://localhost:80/ || exit 1

# Start Nginx server
CMD ["nginx", "-g", "daemon off;"]

