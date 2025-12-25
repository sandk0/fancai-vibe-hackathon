# ✅ TanStack Query Cache Bugs - Fix Checklist

**Quick reference для исправления найденных багов**
**Приоритет:** 🔴 Critical → 🟡 Medium → 🔵 Minor

---

## 🔴 CRITICAL FIXES (Требуют немедленного исправления)

### [ ] 1. User-Specific Data Leakage (SECURITY ISSUE)
**Файлы:** `queryKeys.ts`, `HomePage.tsx`, `StatsPage.tsx`, `ProfilePage.tsx`
**Время:** ~1 час

**Шаги:**
1. [ ] Создать `userKeys` в `frontend/src/hooks/api/queryKeys.ts`:
   ```typescript
   export const userKeys = {
     all: ['user'] as const,
     current: (userId: string) => [...userKeys.all, userId] as const,
     statistics: (userId: string) => [...userKeys.all, userId, 'statistics'] as const,
     readingStats: (userId: string) => [...userKeys.all, userId, 'reading-stats'] as const,
     imageStats: (userId: string) => [...userKeys.all, userId, 'image-stats'] as const,
   };
   ```

2. [ ] Обновить `frontend/src/pages/HomePage.tsx`:
   - [ ] Import `userKeys`
   - [ ] Изменить `queryKey: ['userReadingStatistics']` → `userKeys.readingStats(user?.id || '')`
   - [ ] Изменить `queryKey: ['books', 'homepage']` → `[...bookKeys.list({...}), user?.id]`
   - [ ] Изменить `queryKey: ['userImagesStats']` → `userKeys.imageStats(user?.id || '')`
   - [ ] Добавить `enabled: !!user?.id` ко всем queries

3. [ ] Обновить `frontend/src/pages/StatsPage.tsx`:
   - [ ] Изменить `queryKey: ['user-reading-statistics']` → `userKeys.readingStats(user?.id || '')`
   - [ ] Изменить `queryKey: ['books-for-stats']` → `[...bookKeys.list({...}), user?.id]`
   - [ ] Добавить `enabled: !!user?.id`

4. [ ] Обновить `frontend/src/pages/ProfilePage.tsx`:
   - [ ] Изменить `queryKey: ['user-statistics']` → `userKeys.statistics(user?.id || '')`
   - [ ] Изменить `queryKey: ['current-user']` → `userKeys.current(user?.id || '')`
   - [ ] Добавить `enabled: !!user?.id`

5. [ ] **ТЕСТ:** Multi-user data isolation
   - [ ] Login as User A → check statistics
   - [ ] Logout → Login as User B
   - [ ] Verify User B sees only their data (not User A's)

---

### [ ] 2. bookKeys.list() Partial Matching Failed
**Файл:** `frontend/src/hooks/api/useBooks.ts`
**Время:** ~30 минут

**Шаги:**
1. [ ] В `useDeleteBook` mutation:
   - [ ] Изменить `cancelQueries({ queryKey: bookKeys.list() })` → `cancelQueries({ queryKey: bookKeys.all })`
   - [ ] Изменить `getQueryData(bookKeys.list())` → `getQueriesData({ queryKey: bookKeys.all })`
   - [ ] Изменить `setQueriesData({ queryKey: bookKeys.list() })` → `setQueriesData({ queryKey: bookKeys.all, exact: false })`
   - [ ] Update context type: `previousBooks` → `previousQueries: Array<[QueryKey, any]>`
   - [ ] Fix onError rollback: iterate over `previousQueries` и restore каждый

2. [ ] В `frontend/src/hooks/api/queryKeys.ts`:
   - [ ] Изменить `invalidateAfterDelete`:
     ```typescript
     [
       bookKeys.all,  // Changed from bookKeys.list()
       bookKeys.statistics(),
       // ... rest
     ]
     ```

3. [ ] **ТЕСТ:** Optimistic delete
   - [ ] Go to LibraryPage
   - [ ] Delete book → verify instant removal from UI
   - [ ] Simulate network delay → verify UI shows optimistic state
   - [ ] Test delete failure → verify rollback works

---

### [ ] 3. useUpdateReadingProgress Missing Invalidations
**Файл:** `frontend/src/hooks/api/useBooks.ts`
**Время:** ~20 минут

**Шаги:**
1. [ ] В `useUpdateReadingProgress` mutation `onSuccess`:
   - [ ] Заменить `setQueriesData({ queryKey: bookKeys.list() })` на:
     ```typescript
     await queryClient.invalidateQueries({
       queryKey: bookKeys.all,
       refetchType: 'active',
     });
     ```
   - [ ] Добавить invalidation для statistics:
     ```typescript
     await queryClient.invalidateQueries({
       queryKey: bookKeys.statistics(),
       refetchType: 'active',
     });
     ```
   - [ ] (Optional) Добавить invalidation для userKeys:
     ```typescript
     const { user } = useAuthStore.getState();
     if (user?.id) {
       await queryClient.invalidateQueries({
         queryKey: userKeys.all,
         refetchType: 'active',
       });
     }
     ```

2. [ ] **ТЕСТ:** Progress update propagation
   - [ ] Read book to 50%
   - [ ] Close reader → go to LibraryPage
   - [ ] Verify book shows 50% progress
   - [ ] Go to HomePage
   - [ ] Verify statistics updated (reading time, chapters read)

---

### [ ] 4. BookUploadModal - Fix invalidateAfterUpload
**Файл:** `frontend/src/hooks/api/queryKeys.ts`
**Время:** ~5 минут

**Шаги:**
1. [ ] В `queryKeyUtils.invalidateAfterUpload`:
   ```typescript
   invalidateAfterUpload: () => [
     bookKeys.all,  // Changed from bookKeys.list()
     bookKeys.statistics()
   ]
   ```

2. [ ] (Already correct) Verify `BookUploadModal.tsx:106-110`:
   ```typescript
   await queryClient.invalidateQueries({
     queryKey: bookKeys.all,
     refetchType: 'all',
   });
   ```

3. [ ] **ТЕСТ:** Upload book
   - [ ] Upload new book
   - [ ] Verify book appears in LibraryPage immediately
   - [ ] Verify statistics updated
   - [ ] Check network tab - no double requests

---

### [ ] 5. useChapter Prefetch Race Condition
**Файл:** `frontend/src/hooks/api/useChapter.ts`
**Время:** ~15 минут

**Шаги:**
1. [ ] В `useChapter` hook, useEffect (lines 132-181):
   - [ ] Wrap prefetch в async function:
     ```typescript
     const prefetchNeighbors = async () => {
       if (query.data?.navigation.has_next) {
         await queryClient.prefetchQuery({...});
       }
       if (query.data?.navigation.has_previous) {
         await queryClient.prefetchQuery({...});
       }
     };

     if (query.data) {
       queryClient.setQueryData(...);  // Sync first
       prefetchNeighbors().catch(console.error);  // Then async
     }
     ```

2. [ ] **ТЕСТ:** Fast chapter navigation
   - [ ] Open book reader
   - [ ] Rapidly click Next → Next → Prev → Next
   - [ ] Verify correct chapter content shows
   - [ ] No wrong chapter content flashing

---

### [ ] 6. Missing Statistics Invalidation in useGenerateImage
**Файл:** `frontend/src/hooks/api/useImages.ts`
**Время:** ~10 минут

**Шаги:**
1. [ ] В `useGenerateImage` mutation `onSuccess` (line 288):
   - [ ] Already has `imageKeys.userStats()` invalidation ✅
   - [ ] Verify it works properly

2. [ ] В `useBatchGenerateImages` mutation `onSuccess` (line 372):
   - [ ] Добавить:
     ```typescript
     await queryClient.invalidateQueries({
       queryKey: imageKeys.userStats(),
     });
     ```

3. [ ] **ТЕСТ:** Image generation updates stats
   - [ ] Generate image
   - [ ] Check HomePage → verify image count increased
   - [ ] Generate batch → verify batch update

---

## 🟡 MEDIUM FIXES (Важно, но не блокирует)

### [ ] 7. Дублирование в useChapter vs useChapterDescriptions
**Файлы:** `useChapter.ts`, `useDescriptions.ts`
**Время:** ~1 час

**Шаги:**
1. [ ] Refactor `useChapter` to use `useChapterDescriptions`:
   ```typescript
   export function useChapter(bookId, chapterNumber) {
     const descriptionsQuery = useChapterDescriptions(bookId, chapterNumber);

     const chapterQuery = useQuery({
       queryKey: chapterKeys.detail(bookId, chapterNumber),
       queryFn: async () => {
         const response = await booksAPI.getChapter(bookId, chapterNumber);
         return {
           ...response,
           descriptions: descriptionsQuery.data?.nlp_analysis.descriptions || []
         };
       },
     });

     return chapterQuery;
   }
   ```

2. [ ] **ТЕСТ:** Chapter loading
   - [ ] Open chapter
   - [ ] Check network tab - only 1 API call (not 2)

---

### [ ] 8. Deprecate useBookDescriptions
**Файл:** `frontend/src/hooks/api/useDescriptions.ts`
**Время:** ~5 минут

**Шаги:**
1. [ ] Add JSDoc warning:
   ```typescript
   /**
    * ⚠️ WARNING: NOT IMPLEMENTED
    * Backend doesn't have batch endpoint yet.
    * Use useChapterDescriptions for individual chapters instead.
    *
    * @deprecated Use useChapterDescriptions
    */
   export function useBookDescriptions(...) {
     throw new Error('useBookDescriptions not implemented. Use useChapterDescriptions instead.');
   }
   ```

---

### [ ] 9. Standardize staleTime Values
**Файлы:** Все hooks
**Время:** ~30 минут

**Шаги:**
1. [ ] Создать `frontend/src/hooks/api/staleTime.ts`:
   ```typescript
   export const STALE_TIME = {
     VERY_SHORT: 10 * 1000,      // 10s - realtime (progress)
     SHORT: 30 * 1000,           // 30s - frequent (book list)
     MEDIUM: 5 * 60 * 1000,      // 5m - moderate (book details)
     LONG: 15 * 60 * 1000,       // 15m - rare (chapters)
     VERY_LONG: 30 * 60 * 1000,  // 30m - static (images)
   };
   ```

2. [ ] Применить во всех hooks:
   - [ ] `useBooks`: SHORT
   - [ ] `useBook`: MEDIUM
   - [ ] `useReadingProgress`: VERY_SHORT
   - [ ] `useChapter`: LONG
   - [ ] `useChapterDescriptions`: LONG
   - [ ] `useBookImages`: MEDIUM
   - [ ] `useImageForDescription`: VERY_LONG

---

### [ ] 10. Add refetchOnMount to LibraryPage
**Файл:** `frontend/src/pages/LibraryPage.tsx`
**Время:** ~5 минут

**Шаги:**
1. [ ] В useBooks call (line 56):
   ```typescript
   const { data, isLoading, error } = useBooks(
     { skip, limit: BOOKS_PER_PAGE, sort_by: sortBy },
     {
       refetchOnMount: 'always',  // ✅ Add this
       refetchInterval: (query) => {...},
     }
   );
   ```

2. [ ] **ТЕСТ:** Book upload → LibraryPage refresh
   - [ ] Upload book
   - [ ] Navigate to LibraryPage
   - [ ] Verify new book shows immediately

---

## 🔵 MINOR FIXES (Можно отложить)

### [ ] 11. Remove Duplicate refetch in LibraryPage
**Файл:** `frontend/src/pages/LibraryPage.tsx`
**Время:** ~2 минуты

**Шаги:**
1. [ ] Remove `refetch()` from `handleModalClose` (line 133):
   ```typescript
   const handleModalClose = () => {
     setShowUploadModal(false);
     // refetch() removed - invalidateQueries already refetches
   };
   ```

---

### [ ] 12. Add Error Handling to Prefetch
**Файл:** `frontend/src/hooks/api/useChapter.ts`
**Время:** ~5 минут

**Шаги:**
1. [ ] Add `.catch()` to prefetch calls (lines 166, 176):
   ```typescript
   queryClient.prefetchQuery({...}).catch((error) => {
     console.warn(`⚠️ Failed to prefetch chapter ${nextChapter}:`, error);
   });
   ```

---

### [ ] 13. Centralize Hardcoded Query Keys
**Файлы:** `HomePage.tsx`, `StatsPage.tsx`, `ProfilePage.tsx`, `AdminDashboard.tsx`
**Время:** ~30 минут

**Шаги:**
1. [ ] Move to `queryKeys.ts`:
   ```typescript
   export const adminKeys = {
     all: ['admin'] as const,
     stats: () => [...adminKeys.all, 'stats'] as const,
   };
   ```

2. [ ] Replace hardcoded strings:
   - [ ] HomePage: Use `userKeys`
   - [ ] StatsPage: Use `userKeys`
   - [ ] ProfilePage: Use `userKeys`
   - [ ] AdminDashboard: Use `adminKeys`

---

## 📊 PROGRESS TRACKING

**Total Issues:** 13
- 🔴 Critical: 6
- 🟡 Medium: 4
- 🔵 Minor: 3

**Estimated Time:**
- Critical: ~2.5 hours
- Medium: ~2 hours
- Minor: ~45 minutes
- **Total: ~5 hours**

**Completion:**
- [ ] Critical: 0/6 (0%)
- [ ] Medium: 0/4 (0%)
- [ ] Minor: 0/3 (0%)
- [ ] **Overall: 0/13 (0%)**

---

## 🧪 FINAL TESTING CHECKLIST

После всех fixes:

### [ ] Multi-User Isolation Test
- [ ] Login as User A → note statistics
- [ ] Logout
- [ ] Login as User B
- [ ] Verify NO data from User A visible

### [ ] Book CRUD Test
- [ ] Upload book → instant appearance
- [ ] Delete book → instant removal + rollback on error
- [ ] Update progress → instant UI update

### [ ] Statistics Update Test
- [ ] Read chapter
- [ ] Check HomePage stats update
- [ ] Generate image
- [ ] Check image stats update

### [ ] Navigation Performance Test
- [ ] Open book reader
- [ ] Rapidly navigate chapters
- [ ] Verify smooth, correct content
- [ ] Check network tab - minimal requests

### [ ] Cache Persistence Test
- [ ] Refresh page
- [ ] Verify cached data loads instantly
- [ ] Logout → verify cache cleared
- [ ] Login → verify fresh data

---

**Last Updated:** 2025-12-24
**Generated by:** Frontend Developer Agent v2.0
