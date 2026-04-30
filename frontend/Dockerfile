# Use Debian-based images instead of Alpine
FROM node:22-slim AS build

# Debian uses apt-get instead of apk
RUN apt-get update && apt-get upgrade -y

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install --legacy-peer-deps
COPY . .
RUN npm run build

FROM nginx:1.27

RUN apt-get update && apt-get upgrade -y

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

ENV BACKEND_URL=http://backend:8000
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
