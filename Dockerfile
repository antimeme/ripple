FROM node:10
LABEL maintainer="Jeff Gold (ripple@esclat.net)"
EXPOSE 8443/tcp
WORKDIR /usr/src/app
COPY server-*.pem ca-cert.pem package*.json ./
