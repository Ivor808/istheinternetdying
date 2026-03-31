FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
# Install all deps (including drizzle-kit for migrations)
RUN npm ci
COPY --from=build /app/dist dist
COPY server.js .
COPY drizzle drizzle
COPY drizzle.config.ts .
COPY src/db src/db
CMD ["sh", "-c", "echo 'Starting... PORT='$PORT && npx drizzle-kit migrate 2>&1 && echo 'Migrations done' && node server.js"]
