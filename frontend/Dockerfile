FROM node:18-alpine

# Установка системных зависимостей
RUN apk add --no-cache libc6-compat

# Создание рабочей директории
WORKDIR /app

# Копирование package.json и package-lock.json
COPY package*.json ./

# Установка зависимостей
RUN npm ci --only=production

# Копирование исходного кода
COPY . .

# Экспорт порта
EXPOSE 3000

# Команда по умолчанию для разработки
CMD ["npm", "run", "dev"]