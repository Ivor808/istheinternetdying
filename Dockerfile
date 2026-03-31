FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist dist
COPY server.js .
COPY drizzle drizzle
COPY drizzle.config.ts .
COPY src/db src/db
CMD ["sh", "-c", "echo 'Starting... PORT='$PORT && echo 'DATABASE_URL set:'$([ -n \"$DATABASE_URL\" ] && echo 'yes' || echo 'NO') && npx drizzle-kit migrate 2>&1 && echo 'Migrations done, starting server...' && node server.js"]
