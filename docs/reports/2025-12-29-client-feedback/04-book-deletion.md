# План реализации удаления книг

**Дата:** 29 декабря 2025

---

## 1. Текущее состояние

| Компонент | Статус | Файл |
|-----------|--------|------|
| Backend: Сервис удаления | Реализован | `book_service.py:273-320` |
| Backend: DELETE эндпоинт | **ОТСУТСТВУЕТ** | `crud.py` |
| Frontend: API метод | Реализован | `books.ts:80-82` |
| Frontend: React Query Hook | Реализован | `useBooks.ts:348-411` |
| Frontend: UI кнопка | **ОТСУТСТВУЕТ** | - |
| Frontend: Модальное окно | **ОТСУТСТВУЕТ** | - |

---

## 2. Каскадное удаление

Настроено корректно через `cascade="all, delete-orphan"`:

```
Book (удаляется)
├── Chapter -> Description -> GeneratedImage
├── ReadingProgress
└── ReadingSession
```

---

## 3. План реализации

### 3.1 Backend: DELETE эндпоинт

**Файл:** `backend/app/routers/books/crud.py`

```python
@router.delete("/{book_id}", status_code=200)
async def delete_book(
    book: Book = Depends(get_user_book),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_database_session),
    book_svc: BookService = Depends(get_book_service_dep),
) -> dict:
    """Удаляет книгу и все связанные данные."""
    success = await book_svc.delete_book(db, book.id, current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Book not found")
    return {"message": f"Book '{book.title}' deleted successfully"}
```

### 3.2 Frontend: DeleteConfirmModal.tsx

```tsx
interface DeleteConfirmModalProps {
  book: Book;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
}
```

**Содержимое модального окна:**
- Название книги
- Предупреждение о удалении данных
- Кнопки "Отмена" / "Удалить"

### 3.3 Frontend: Кнопка в BookCard.tsx

```tsx
// Добавить проп
onDelete?: (bookId: string) => void;

// Кнопка (появляется при hover)
<button
  onClick={(e) => { e.stopPropagation(); onDelete?.(book.id); }}
  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 ..."
>
  <Trash2 className="w-4 h-4 text-red-500" />
</button>
```

---

## 4. UX требования

- Кнопка появляется при hover на карточке
- Обязательное подтверждение через модальное окно
- Loading state при удалении
- Toast уведомление об успехе/ошибке
- Оптимистичное обновление списка

---

## 5. Безопасность

- Dependency `get_user_book` проверяет владельца книги
- Нельзя удалить книгу в процессе обработки
- Очистка файлов с диска через `book_service`

---

## 6. Оценка времени

| Задача | Время |
|--------|-------|
| Backend: DELETE эндпоинт | 30 мин |
| Frontend: DeleteConfirmModal | 1 час |
| Frontend: Кнопка в BookCard | 30 мин |
| Frontend: Интеграция | 30 мин |
| Тестирование | 2 часа |
| **Итого** | **~5 часов** |
