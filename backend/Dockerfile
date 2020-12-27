FROM node:15-alpine

WORKDIR /usr/src/app

ENV WAIT_HOSTS=db:5432,cache:6379

COPY package*.json ./
COPY ./ .

RUN mv wait /wait

RUN npm install

EXPOSE 80
CMD /wait && node app.js