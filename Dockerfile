FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY --from=build /app/dist dist
COPY server.js .
COPY drizzle drizzle
COPY drizzle.config.ts .
COPY src/db src/db
CMD ["sh", "-c", "echo 'Running migrations...' && ./node_modules/.bin/drizzle-kit migrate && echo 'Starting server on port '$PORT && node server.js"]
