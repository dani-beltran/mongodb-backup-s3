FROM mongo:7

# Install Node.js
RUN apt-get update && apt-get install -y \
    curl \
    gnupg \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci

# Build the TypeScript code
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Remove development dependencies
RUN npm prune --production

# MongoDB data directory
VOLUME /data/db

# Expose MongoDB port
EXPOSE 27017

# Use the original MongoDB entrypoint
CMD ["mongod"]
