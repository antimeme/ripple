FROM node:10
LABEL maintainer="Jeff Gold (jgold@esclat.net)"
ENV container docker
WORKDIR /usr/src/app

# Install package.json and (if necessary) package-lock.json
COPY package*.json ./
RUN npm install
# RUN npm ci --only=production
COPY . .

EXPOSE 80/tcp 443/tcp
CMD [ "node", "source/server.js" ]
