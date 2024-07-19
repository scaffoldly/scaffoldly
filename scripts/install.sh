#!/bin/sh

set -e
set -x

# Determine the package manager
if command -v apk > /dev/null; then
    PKG_MANAGER="apk"
elif command -v apt-get > /dev/null; then
    PKG_MANAGER="apt"
elif command -v dnf > /dev/null; then
    PKG_MANAGER="dnf"
else
    set +x
    echo "Unsupported package manager or OS."
    exit 1
fi

# Install the packages
if [ "$PKG_MANAGER" == "apk" ]; then
    apk update
    apk add --no-cache "$@"
    # Clean up
    rm -rf /var/cache/apk/*
elif [ "$PKG_MANAGER" == "apt" ]; then
    apt update
    apt install -y --no-install-recommends "$@"
    # Clean up
    apt clean
    rm -rf /var/lib/apt/lists/*
elif [ "$PKG_MANAGER" == "dnf" ]; then
    dnf install -y "$@"
    # Clean up
    dnf clean all
    rm -rf /var/cache/dnf
fi

set +x
echo "Installation complete and cleanup done."