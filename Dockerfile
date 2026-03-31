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
COPY --from=build /app/.output .output
COPY drizzle drizzle
COPY drizzle.config.ts .
COPY src/db src/db
RUN npx drizzle-kit generate 2>/dev/null || true
EXPOSE 3000
ENV PORT=3000
CMD ["sh", "-c", "npx drizzle-kit migrate && node .output/server/index.mjs"]
