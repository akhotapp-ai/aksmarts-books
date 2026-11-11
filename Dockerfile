FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
ENV PORT=8080 DATA_DIR=/app/data NODE_ENV=production
VOLUME ["/app/data"]
EXPOSE 8080
CMD ["node", "--no-warnings", "server/start.js"]
