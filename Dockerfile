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
COPY drizzle drizzle
COPY drizzle.config.ts .
COPY src/db src/db
EXPOSE 3000
ENV PORT=3000
CMD ["sh", "-c", "npx drizzle-kit migrate && node dist/server/ssr.js"]
