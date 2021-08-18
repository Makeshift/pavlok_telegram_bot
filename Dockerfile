#FROM node:alpine
# official alpine container appears to be broken right now :(
FROM node:slim
WORKDIR /usr/src/app
COPY . .
RUN npm install
EXPOSE 80
CMD ["node", "index.js"]
