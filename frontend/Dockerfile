FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM python:3.12-alpine

WORKDIR /app
COPY --from=build /app/dist ./dist

EXPOSE 5173

CMD ["python", "-m", "http.server", "5173", "--directory", "dist"]
