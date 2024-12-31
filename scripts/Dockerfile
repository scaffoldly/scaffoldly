# This dockerfile creates OS-specific binaries that can be used in other places where NodeJS is not installed
# DEVNOTE: Mulit-platform is done in GitHub Actions, so we don't need to worry about that here

# AMD64
FROM node:18 AS build-linux-amd64
ENV NPX_CACHE=/cache/npx
ENV PKG_CACHE_PATH=/cache/pkg
WORKDIR /linux/amd64
COPY dist/* .
RUN --mount=type=cache,id=npx,target=/cache/npx \
    --mount=type=cache,id=pkg,target=/cache/pkg \
    npx pkg awslambda-entrypoint.js --target linuxstatic-x64 --compress Brotli

# ARM64
FROM node:18 AS build-linux-arm64
ENV NPX_CACHE=/cache/npx
ENV PKG_CACHE_PATH=/cache/pkg
WORKDIR /linux/arm64
COPY dist/* .
RUN --mount=type=cache,id=npx,target=/cache/npx \
    --mount=type=cache,id=pkg,target=/cache/pkg \
    npx pkg awslambda-entrypoint.js --target linuxstatic-arm64 --compress Brotli

# Final
FROM scratch
COPY --from=build-linux-amd64 /linux /linux
COPY --from=build-linux-arm64 /linux /linux
