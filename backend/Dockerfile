FROM python:3.11-slim

# Установка системных зависимостей
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Создание рабочей директории
WORKDIR /app

# Копирование файлов зависимостей
COPY requirements.txt .

# Установка Python зависимостей
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# Загрузка NLP моделей
RUN python -m spacy download ru_core_news_lg
RUN python -c "import nltk; nltk.download('punkt'); nltk.download('stopwords'); nltk.download('wordnet'); nltk.download('averaged_perceptron_tagger')"
RUN python -c "import stanza; stanza.download('ru')"

# Копирование исходного кода
COPY . .

# Создание директорий для загрузок и логов
RUN mkdir -p /app/uploads /app/logs

# Установка переменной окружения для Python
ENV PYTHONPATH=/app

# Экспорт порта
EXPOSE 8000

# Команда по умолчанию
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]