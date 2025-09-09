FROM node:18-alpine

# Crea directory di lavoro
WORKDIR /app

# Copia package.json e package-lock.json
COPY package*.json ./

# Installa dipendenze
RUN npm ci --only=production

# Copia il codice sorgente
COPY server.js ./
COPY public/ ./public/

# Verifica che i file siano presenti
RUN ls -la /app/
RUN ls -la /app/public/
RUN cat /app/public/index.html | head -5

# Espone la porta
EXPOSE 3888

# Comando di avvio
CMD ["npm", "start"]
