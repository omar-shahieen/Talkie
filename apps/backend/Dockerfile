# build from the monorepo ROOT so the root package-lock.json is in context:
#   docker build -f apps/backend/Dockerfile -t talkie-backend .

# Development stage
FROM node:24-alpine AS development

WORKDIR /usr/src/app

# Root workspace manifests + lockfile (all workspace package.json files are needed to validate the lock)
COPY package.json package-lock.json ./
COPY apps/backend/package.json ./apps/backend/

RUN npm ci --workspace=@talkie/backend

COPY apps/backend ./apps/backend

RUN mkdir -p /usr/src/app/uploads && \
    chown -R node:node /usr/src/app

EXPOSE 3000
USER node

# Build stage
FROM node:24-alpine AS build

WORKDIR /usr/src/app

COPY --from=development /usr/src/app/node_modules ./node_modules
COPY --from=development /usr/src/app/package.json /usr/src/app/package-lock.json ./
COPY --from=development /usr/src/app/apps/backend ./apps/backend

WORKDIR /usr/src/app/apps/backend

RUN npm run build

ENV NODE_ENV=production

RUN npm prune --omit=dev --workspace=@talkie/backend && npm cache clean --force

USER node


# Production stage
FROM node:24-alpine AS production

WORKDIR /usr/src/app

RUN mkdir -p /usr/src/app/uploads && \
    chown -R node:node /usr/src/app

COPY --from=build --chown=node:node /usr/src/app/node_modules ./node_modules
COPY --from=build --chown=node:node /usr/src/app/apps/backend/dist ./dist

EXPOSE 3000
USER node

ARG GIT_COMMIT=unknown
ARG BUILD_DATE=unknown
ARG NODE_ENV=production

# 2. Add OCI Standard Labels (inspectable via 'docker inspect')
LABEL org.opencontainers.image.revision="${GIT_COMMIT}" \
      org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.environment="${NODE_ENV}"

# 3. Make them accessible at runtime inside NestJS via process.env
ENV GIT_COMMIT=${GIT_COMMIT} \
    NODE_ENV=${NODE_ENV}
CMD ["node", "dist/main.js"]



