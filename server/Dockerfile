FROM node:18-alpine

# Crea directory di lavoro
WORKDIR /app

# Copia package.json e package-lock.json
COPY package*.json ./

# Installa dipendenze
RUN npm ci --only=production

# Copia i file specifici
COPY server.js ./
COPY public/index.html ./public/

# Espone la porta
EXPOSE 3888

# Comando di avvio
CMD ["npm", "start"]
