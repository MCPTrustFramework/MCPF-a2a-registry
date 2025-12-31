FROM node:20-alpine
WORKDIR /app
COPY src/package*.json ./
RUN npm ci --production
COPY src/ ./
EXPOSE 4003
CMD ["node", "server.js"]
