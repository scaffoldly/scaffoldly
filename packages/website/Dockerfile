# syntax=docker/dockerfile:1.9
FROM alpine:3 AS install-base
WORKDIR /var/task
RUN apk update && apk add --no-cache npm && rm -rf /var/cache/apk/*
RUN npm install -g serve@14 --omit=dev --omit=optional --omit=peer && npm cache clean --force

# syntax=docker/dockerfile:1.9
FROM node:22-alpine AS install-docusaurus
WORKDIR /var/task
COPY . /var/task/
RUN npm install

# syntax=docker/dockerfile:1.9
FROM install-base AS build-base
WORKDIR /var/task
ENV PATH="/var/task:$PATH"
ENV PATH="/var/task/node_modules/.bin:$PATH"
COPY . /var/task/

# syntax=docker/dockerfile:1.9
FROM install-docusaurus AS build-docusaurus
WORKDIR /var/task
ENV PATH="/var/task:$PATH"
ENV PATH="/var/task/node_modules/.bin:$PATH"
COPY . /var/task/
RUN docusaurus build

# syntax=docker/dockerfile:1.9
FROM install-base AS package-base
WORKDIR /var/task
ENV PATH="/var/task:$PATH"
ENV PATH="/var/task/node_modules/.bin:$PATH"

# syntax=docker/dockerfile:1.9
FROM install-docusaurus AS package-docusaurus
WORKDIR /var/task
ENV PATH="/var/task:$PATH"
ENV PATH="/var/task/node_modules/.bin:$PATH"
COPY --from=build-docusaurus /var/task/package.json /var/task/package.json
COPY --from=build-docusaurus /var/task/build* /var/task/build

# syntax=docker/dockerfile:1.9
FROM install-base AS runtime
WORKDIR /var/task
ENV PATH="/var/task:$PATH"
ENV PATH="/var/task/node_modules/.bin:$PATH"
COPY .entrypoint* /var/task/.entrypoint
COPY --from=package-docusaurus /var/task/package.json /var/task/package.json
COPY --from=package-docusaurus /var/task/build /var/task/build
CMD [ "( serve build )" ]

