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

ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

ENV NODE_ENV=production

RUN npm prune --omit=dev --workspace=@talkie/frontend && npm cache clean --force

USER node

# Production stage (static files served by unprivileged nginx on port 8080)
FROM nginxinc/nginx-unprivileged:alpine AS production

ARG GIT_COMMIT=local-dev
ARG NODE_VERSION=24-alpine
ARG NODE_ENV=production

LABEL org.opencontainers.image.revision="${GIT_COMMIT}" \
      org.opencontainers.image.environment="${NODE_ENV}" \
      builder.node.version="${NODE_VERSION}"

COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /usr/src/app/apps/frontend/dist /usr/share/nginx/html

EXPOSE 8080
