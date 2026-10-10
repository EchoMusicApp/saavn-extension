FROM oven/bun AS base

WORKDIR /user/app

COPY package.json .

COPY bun.lockb .

RUN bun install --frozen-lockfile --production

# Making build file
FROM base AS build

WORKDIR /user/app

COPY . .

RUN bun install --frozen-lockfile

RUN bun run build

# Production
FROM oven/bun:alpine AS production

WORKDIR /user/app

COPY --from=build /user/app/dist ./dist
COPY --from=base /user/app/node_modules ./node_modules
COPY --from=base /user/app/package.json ./package.json

EXPOSE 3000

CMD ["bun", "run", "start"]
