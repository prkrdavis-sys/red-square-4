# Cursor Cloud Agent image. Do not COPY the project; Cursor checks out the commit.
FROM node:22-bookworm

ENV DEBIAN_FRONTEND=noninteractive

USER root

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    git \
    python3 \
    sudo \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# OS libraries for Playwright Chromium. Browser binaries are installed in `install`.
RUN npx --yes playwright@1.62.1 install-deps chromium

RUN id -u ubuntu >/dev/null 2>&1 || useradd -m -s /bin/bash ubuntu \
    && usermod -aG sudo ubuntu \
    && echo "ubuntu ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/ubuntu \
    && chmod 0440 /etc/sudoers.d/ubuntu

USER ubuntu
WORKDIR /home/ubuntu
