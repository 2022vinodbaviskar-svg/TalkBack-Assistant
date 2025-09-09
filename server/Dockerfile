FROM node:18-alpine

# Crea directory di lavoro
WORKDIR /app

# Copia package.json e package-lock.json
COPY package*.json ./

# Installa dipendenze
RUN npm ci --only=production

# Copia tutto il codice sorgente
COPY . .

# Espone la porta
EXPOSE 3888

# Comando di avvio
CMD ["npm", "start"]
