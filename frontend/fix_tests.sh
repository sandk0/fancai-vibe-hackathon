#!/bin/bash

# Скрипт для обновления вызовов chapterCache в тестах

FILE="src/services/__tests__/chapterCache.test.ts"

# Замена chapterCache.get(bookId -> chapterCache.get(testUserId, bookId
sed -i '' 's/chapterCache\.get(\([^,)]*\), \([^,)]*\))/chapterCache.get(testUserId, \1, \2)/g' "$FILE"

# Замена chapterCache.has(bookId -> chapterCache.has(testUserId, bookId
sed -i '' 's/chapterCache\.has(\([^,)]*\), \([^,)]*\))/chapterCache.has(testUserId, \1, \2)/g' "$FILE"

# Замена chapterCache.delete(bookId -> chapterCache.delete(testUserId, bookId
sed -i '' 's/chapterCache\.delete(\([^,)]*\), \([^,)]*\))/chapterCache.delete(testUserId, \1, \2)/g' "$FILE"

# Замена chapterCache.clearBook(bookId -> chapterCache.clearBook(testUserId, bookId
sed -i '' 's/chapterCache\.clearBook(\([^,)]*\))/chapterCache.clearBook(testUserId, \1)/g' "$FILE"

echo "✅ Tests fixed"
