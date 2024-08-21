# This dockerfile creates OS-specific binaries that can be used in other places where NodeJS is not installed
# DEVNOTE: Mulit-platform is done in GitHub Actions, so we don't need to worry about that here

# AMD64
FROM node:18 AS build-linux-amd64
WORKDIR /linux/amd64
COPY dist/* .
RUN npx pkg awslambda-entrypoint.js --target linuxstatic-x64
RUN npx pkg scaffoldly.js --target linuxstatic-x64

# ARM64
FROM node:18 AS build-linux-arm64
WORKDIR /linux/arm64
COPY dist/* .
RUN npx pkg awslambda-entrypoint.js --target linuxstatic-arm64
RUN npx pkg scaffoldly.js --target linuxstatic-arm64

# Final
FROM scratch
COPY --from=build-linux-amd64 /linux /linux
COPY --from=build-linux-arm64 /linux /linux
