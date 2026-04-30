FROM node:22-alpine AS build

RUN apk update && apk upgrade --no-cache

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install --legacy-peer-deps

COPY . .
RUN npm run build

FROM nginx:1.27-alpine

RUN apk update && apk upgrade --no-cache

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

ENV BACKEND_URL=http://backend:8000

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
