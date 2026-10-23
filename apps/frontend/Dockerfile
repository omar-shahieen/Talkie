# build from the monorepo ROOT so the root package-lock.json is in context:
#   docker build -f apps/frontend/Dockerfile -t talkie-frontend .

# Development stage
FROM node:24-alpine AS development

WORKDIR /usr/src/app

# Root workspace manifests + lockfile (all workspace package.json files are needed to validate the lock)
COPY package.json package-lock.json ./
COPY apps/frontend/package.json ./apps/frontend/

RUN npm ci --workspace=@talkie/frontend

COPY apps/frontend ./apps/frontend

USER node

# Build stage
FROM node:24-alpine AS build

WORKDIR /usr/src/app

COPY --from=development /usr/src/app/node_modules ./node_modules
COPY --from=development /usr/src/app/package.json /usr/src/app/package-lock.json ./
COPY --from=development /usr/src/app/apps/frontend ./apps/frontend

WORKDIR /usr/src/app/apps/frontend

RUN npm run build

ENV NODE_ENV=production

RUN npm prune --omit=dev --workspace=@talkie/frontend && npm cache clean --force

USER node

# Production stage
FROM node:24-alpine AS production

WORKDIR /usr/src/app

COPY --from=build /usr/src/app/node_modules ./node_modules

COPY --from=build /usr/src/app/apps/frontend/dist ./dist

USER node

CMD ["node", "dist/main.js"]
