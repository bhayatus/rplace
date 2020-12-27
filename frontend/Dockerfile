FROM node:15-alpine

WORKDIR /usr/src/app

COPY package*.json ./
COPY ./ .

RUN npm install

ENV STATIC_SERVER_PORT=3000

EXPOSE 3000
CMD node static_server.js