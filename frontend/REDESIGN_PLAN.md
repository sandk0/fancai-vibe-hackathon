# Frontend Pages Redesign Plan

Редизайн всех страниц приложения с использованием shadcn UI и современного стиля.

## ✅ Completed

### 1. HomePage
- ✅ Hero section с градиентным фоном
- ✅ Статистика (3 карточки)
- ✅ Features cards с hover эффектами
- ✅ Quick actions (Библиотека, Загрузка)
- ✅ Полностью theme-aware (Light/Dark/Sepia)

### 2. EpubReader (BookReaderPage)
- ✅ Компактный header с прогресс-баром
- ✅ Минимальные отступы для максимального пространства
- ✅ Кнопки TOC и Info (только иконки)
- ✅ Theme-aware components

## 🚧 In Progress

### 3. LibraryPage
**Текущий дизайн:** Простая сетка карточек с поиском
**Новый дизайн:**
- Градиентный hero header со статистикой
- 4 stats cards (Всего книг, В процессе, Завершено, AI обработка)
- Улучшенный поиск с кнопками Grid/List view
- Современные карточки книг с hover эффектами
- Progress bars для каждой книги
- Empty state с призывом к действию
- CSS переменные для тем

**Ключевые компоненты:**
```tsx
- Gradient hero: linear-gradient(135deg, var(--accent-color), purple)
- Stats grid: grid-cols-1 sm:grid-cols-2 lg:grid-cols-4
- Book cards: hover:-translate-y-2, rounded-xl, shadow-lg
- View toggle: Grid/List mode buttons
```

### 4. BookPage (Book Detail)
**Текущий дизайн:** Стандартная двухколоночная страница
**Новый дизайн:**
- Hero section с обложкой и gradient background
- Большие кнопки действий: "Начать читать", "Продолжить", "Галерея AI"
- Stats bar (Главы, Прогресс, Изображения)
- Tabs для Description/Chapters/Generated Images
- Modern card для каждой главы
- Progress visualization

**Ключевые секции:**
- Hero с cover (левая) + info (правая)
- Action buttons с иконками и градиентами
- Stats в 3 колонки
- Tabs navigation
- Content area

### 5. LoginPage & RegisterPage
**Текущий дизайн:** Простые формы
**Новый дизайн:**
- Split screen: форма слева, gradient+benefits справа
- Modern input fields с иконками
- Social login buttons
- Animated gradient background
- Form validation with animations
- "Forgot password" и "Sign up" links

**Компоненты:**
```tsx
- Split layout: grid-cols-1 md:grid-cols-2
- Input fields: rounded-xl, border-2, focus:ring
- Gradient sidebar: linear-gradient(to-br, blue, purple)
- Benefits list с checkmarks
```

### 6. ProfilePage
**Новый дизайн:**
- Cover photo header (gradient)
- Avatar с upload button
- Stats cards (Книги прочитано, Часы, AI изображений)
- Tabs: Profile/Reading History/Preferences
- Edit profile form
- Reading activity timeline

### 7. SettingsPage
**Новый дизайн:**
- Sidebar navigation для категорий
- Sections: Account, Preferences, Notifications, Security
- Toggle switches для настроек
- Theme preview cards
- Danger zone (удаление аккаунта) в конце

### 8. BookImagesPage (AI Gallery)
**Новый дизайн:**
- Masonry grid layout для изображений
- Filter по типу (Location/Character/Atmosphere)
- Search по описаниям
- Image card: hover overlay с описанием
- Lightbox modal для full view
- Stats: Total images, By chapter, By type

### 9. NotFoundPage (404)
**Новый дизайн:**
- Центрированная страница
- Большая анимированная иллюстрация "404"
- Gradient text
- Search bar "Может быть, вы искали..."
- Quick links: Home, Library, Upload
- Анимация на загрузке

## Design System

### Colors (CSS Variables)
```css
/* Light Theme */
--bg-primary: #ffffff
--bg-secondary: #f8fafc
--bg-tertiary: #f1f5f9
--text-primary: #1f2937
--text-secondary: #6b7280
--text-tertiary: #9ca3af
--border-color: #e5e7eb
--accent-color: #3b82f6
--accent-hover: #2563eb

/* Dark Theme */
--bg-primary: #1f2937
--bg-secondary: #111827
--bg-tertiary: #0f172a
--text-primary: #f9fafb
--text-secondary: #d1d5db
--text-tertiary: #9ca3af
--border-color: #374151
--accent-color: #60a5fa
--accent-hover: #3b82f6

/* Sepia Theme */
--bg-primary: #f7f3e9
--bg-secondary: #f0e6d2
--bg-tertiary: #e8dcc0
--text-primary: #5d4037
--text-secondary: #8d6e63
--text-tertiary: #a1887f
--border-color: #d7ccc8
--accent-color: #d97706
--accent-hover: #b45309
```

### Common Patterns

#### Gradient Headers
```tsx
<div className="relative overflow-hidden rounded-3xl">
  <div
    className="absolute inset-0 opacity-50"
    style={{
      background: 'linear-gradient(135deg, var(--accent-color), rgba(147, 51, 234, 0.3))'
    }}
  />
  <div className="relative px-8 py-12">
    {/* Content */}
  </div>
</div>
```

#### Cards with Hover
```tsx
<div
  className="p-6 rounded-2xl border-2 transition-all duration-300 hover:scale-105 hover:shadow-xl"
  style={{
    backgroundColor: 'var(--bg-primary)',
    borderColor: 'var(--border-color)',
  }}
>
  {/* Content */}
</div>
```

#### Buttons
```tsx
<button
  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all hover:scale-105 shadow-lg"
  style={{
    backgroundColor: 'var(--accent-color)',
    color: 'white',
  }}
>
  {/* Content */}
</button>
```

#### Stats Cards
```tsx
<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
  {stats.map(stat => (
    <div className="p-6 rounded-2xl border-2" style={{...}}>
      <Icon className="w-8 h-8" />
      <div className="text-3xl font-bold">{stat.value}</div>
      <div className="text-sm">{stat.label}</div>
    </div>
  ))}
</div>
```

### Typography
- Hero titles: `text-4xl md:text-5xl font-bold`
- Section titles: `text-2xl md:text-3xl font-bold`
- Card titles: `text-lg font-semibold`
- Body text: `text-base`
- Secondary text: `text-sm` + `color: var(--text-secondary)`

### Spacing
- Page margin: `max-w-7xl mx-auto`
- Section gaps: `mb-12` or `mb-16`
- Grid gaps: `gap-6` or `gap-8`
- Card padding: `p-6` or `p-8`

### Animations
- Hover scale: `hover:scale-105`
- Hover translate: `hover:-translate-y-2`
- Transitions: `transition-all duration-300`
- Shadows: `shadow-lg hover:shadow-xl`

## Implementation Priority
1. ✅ HomePage
2. ✅ EpubReader
3. 🚧 LibraryPage
4. 📝 BookPage
5. 📝 LoginPage/RegisterPage
6. 📝 ProfilePage/SettingsPage
7. 📝 BookImagesPage
8. 📝 NotFoundPage

## Timeline
- Phase 1 (Done): HomePage, EpubReader
- Phase 2 (Current): LibraryPage, BookPage
- Phase 3 (Next): Auth pages (Login/Register)
- Phase 4: Profile/Settings
- Phase 5: Gallery and 404

## Notes
- Все страницы должны использовать CSS переменные для тем
- Responsive design обязателен (sm:, md:, lg: breakpoints)
- Hover effects на всех интерактивных элементах
- Loading states с анимацией
- Empty states с призывом к действию
- Accessibility (ARIA labels, keyboard navigation)
