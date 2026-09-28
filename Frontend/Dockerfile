# Stage 1: Build React App with Vite
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . ./

# Build arguments for Vite environment variables
ARG VITE_USER_SERVICE_URL=http://localhost:5000/api/v1
ARG VITE_CHAT_SERVICE_URL=http://localhost:5002/api/v1
ARG VITE_CHAT_SOCKET_URL=http://localhost:5002

ENV VITE_USER_SERVICE_URL=$VITE_USER_SERVICE_URL
ENV VITE_CHAT_SERVICE_URL=$VITE_CHAT_SERVICE_URL
ENV VITE_CHAT_SOCKET_URL=$VITE_CHAT_SOCKET_URL

RUN npm run build

# Stage 2: Serve with Nginx Alpine
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
