FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY src ./src
RUN npm run build

ENV NODE_ENV=production

EXPOSE 3000

CMD ["npm", "start"]