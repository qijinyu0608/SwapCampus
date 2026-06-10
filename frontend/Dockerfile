FROM node:20-alpine AS builder
WORKDIR /app
ARG VITE_API_BASE_URL=http://localhost:3001/api
ARG VITE_API_DOMAIN=http://localhost:3001
ARG VITE_SOCKET_URL=http://localhost:3001
ARG VITE_WEBSITE_DOMAIN=http://localhost:5178
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_API_DOMAIN=$VITE_API_DOMAIN
ENV VITE_SOCKET_URL=$VITE_SOCKET_URL
ENV VITE_WEBSITE_DOMAIN=$VITE_WEBSITE_DOMAIN
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
