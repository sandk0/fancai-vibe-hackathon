# Анализ мобильной версии BookReader AI

**Дата:** 29 декабря 2025

---

## 1. Критичные проблемы

### 1.1 ReaderToolbar.tsx - Фиксированная ширина прогресс-секции

**Файл:** `frontend/src/components/Reader/ReaderToolbar.tsx:105`

```tsx
<div className="flex flex-col items-center gap-2 min-w-[240px]">
```

**Проблема:** min-w-[240px] слишком велика для экранов 320-375px.

**Исправление:**
```tsx
<div className="flex flex-col items-center gap-2 min-w-[160px] sm:min-w-[240px]">
```

---

### 1.2 ReaderToolbar.tsx - Большие отступы

**Файл:** `frontend/src/components/Reader/ReaderToolbar.tsx:81-86`

```tsx
"fixed bottom-6 left-1/2 -translate-x-1/2 z-50",
"rounded-full shadow-2xl px-6 py-3.5",
"flex items-center gap-4",
```

**Исправление:**
```tsx
"fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-50",
"rounded-full shadow-2xl px-3 sm:px-6 py-2.5 sm:py-3.5",
"flex items-center gap-2 sm:gap-4",
```

---

### 1.3 LibraryHeader.tsx - Слишком большие шрифты

**Файл:** `frontend/src/components/Library/LibraryHeader.tsx:58`

```tsx
<h1 className="text-4xl md:text-5xl font-bold mb-3" ...>
```

**Исправление:**
```tsx
<h1 className="text-2xl sm:text-4xl md:text-5xl font-bold mb-2 sm:mb-3" ...>
```

---

### 1.4 LibraryHeader.tsx - Большие отступы

**Файл:** `frontend/src/components/Library/LibraryHeader.tsx:55`

```tsx
<div className="relative px-8 py-12">
```

**Исправление:**
```tsx
<div className="relative px-4 sm:px-8 py-6 sm:py-12">
```

---

### 1.5 TocSidebar.tsx - Нет safe-area для iOS

**Файл:** `frontend/src/components/Reader/TocSidebar.tsx:276`

**Исправление:** Добавить в style:
```tsx
style={{
  paddingLeft: 'env(safe-area-inset-left)',
  paddingRight: 'env(safe-area-inset-right)',
}}
```

---

## 2. Важные проблемы

### 2.1 BookCard.tsx - Фиксированные размеры обложки

**Файл:** `frontend/src/components/Library/BookCard.tsx:200`

```tsx
<div className="w-24 h-32 flex-shrink-0 ...">
```

**Исправление:**
```tsx
<div className="w-20 h-28 sm:w-24 sm:h-32 flex-shrink-0 ...">
```

---

### 2.2 LibraryStats.tsx - Большие шрифты

**Файл:** `frontend/src/components/Library/LibraryStats.tsx:77`

```tsx
<div className="text-3xl font-bold mb-1" ...>
```

**Исправление:**
```tsx
<div className="text-2xl sm:text-3xl font-bold mb-1" ...>
```

---

### 2.3 LibraryStats.tsx - Большие отступы

**Файл:** `frontend/src/components/Library/LibraryStats.tsx:68`

```tsx
className="p-6 rounded-2xl border-2 ..."
```

**Исправление:**
```tsx
className="p-4 sm:p-6 rounded-2xl border-2 ..."
```

---

### 2.4 BookGrid.tsx - Большой gap

**Файл:** `frontend/src/components/Library/BookGrid.tsx:123`

```tsx
'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6'
```

**Исправление:**
```tsx
'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-6'
```

---

### 2.5 ProgressIndicator.tsx - Фиксированная ширина

**Файл:** `frontend/src/components/Reader/ProgressIndicator.tsx:71`

```tsx
<div className="flex items-center gap-4 min-w-[200px]">
```

**Исправление:**
```tsx
<div className="flex items-center gap-2 sm:gap-4 min-w-[140px] sm:min-w-[200px]">
```

---

### 2.6 ReaderHeader.tsx - Нестандартный breakpoint

**Файл:** `frontend/src/components/Reader/ReaderHeader.tsx:167`

```tsx
<span className="font-medium hidden xs:inline">
```

**Проблема:** `xs:` не существует в стандартном Tailwind.

**Исправление:** Добавить в tailwind.config.js:
```js
theme: {
  screens: {
    'xs': '375px',
    // ... остальные
  },
}
```

---

## 3. Желательные улучшения

| Файл | Строка | Проблема | Исправление |
|------|--------|----------|-------------|
| HomePage.tsx | 134 | text-4xl md:text-6xl | text-2xl sm:text-4xl md:text-6xl |
| NotFoundPage.tsx | 60 | text-9xl | text-7xl sm:text-9xl |
| BookUploadModal.tsx | 272 | mx-4 | mx-2 sm:mx-4 |
| Header.tsx | 76 | hidden md:block (поиск) | Добавить мобильную иконку |
| ImageGenerationStatus.tsx | 158 | min-w-[250px] | min-w-[200px] sm:min-w-[250px] |

---

## 4. Отображение прогресса

### Места с прогрессом в страницах:
- BookCard.tsx:161 - `{currentPage}/{totalPages} стр`
- ReaderHeader.tsx:168 - `{currentPage}/{totalPages}`
- ReaderToolbar.tsx:118 - `Страница {currentPage} / {totalPages}`
- ProgressIndicator.tsx:100-102 - `Стр. {currentPage}/{totalPages}`

### Места с прогрессом в процентах:
- BookCard.tsx:164 - `{progress}%`
- ReaderHeader.tsx:172 - `{progress}%`
- ReaderToolbar.tsx:122 - `{progress}%`
- ProgressIndicator.tsx:74 - `{progress}%`

---

## 5. Рекомендации

### Общие принципы:
1. **Mobile-first** - начинать с мобильных стилей
2. **Адаптивные отступы** - `p-4 sm:p-6 lg:p-8`
3. **Адаптивные шрифты** - `text-xl sm:text-2xl md:text-3xl`
4. **Адаптивные gaps** - `gap-3 sm:gap-4 lg:gap-6`
5. **Избегать фиксированных размеров**

### Тестовые устройства:
- 320px (iPhone SE 1st gen)
- 375px (iPhone SE 2nd gen)
- 390px (iPhone 14)
- 428px (iPhone 14 Pro Max)
- 768px (iPad mini)
