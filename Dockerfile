FROM node:26-slim

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN DATABASE_URL="postgresql://usuario:senha@localhost:5432/banco" npx prisma generate
RUN npm run build

EXPOSE 3333

CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma db seed && exec node dist/server.js"]
