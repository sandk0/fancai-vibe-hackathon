FROM node:18-alpine

# Установка системных зависимостей
RUN apk add --no-cache libc6-compat

# Создание рабочей директории
WORKDIR /app

# Копирование package.json и package-lock.json
COPY package*.json ./

# Установка зависимостей (чистая установка для правильной платформы)
RUN rm -rf node_modules package-lock.json && npm install

# Копирование исходного кода (исключая node_modules)
COPY . .

# Экспорт порта
EXPOSE 3000

# Команда по умолчанию для разработки
CMD ["npm", "run", "dev"]