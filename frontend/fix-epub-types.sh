#!/bin/bash
# Batch fix for epub.js 'any' types in hooks

# Fix useCFITracking.ts
sed -i '' 's/: any): string/: Book | Rendition): string/g' src/hooks/epub/useCFITracking.ts
sed -i '' 's/(cfi: string, book: any)/(cfi: string, book: Book)/g' src/hooks/epub/useCFITracking.ts
sed -i '' 's/(location: any)/(location: Location | null)/g' src/hooks/epub/useCFITracking.ts
sed -i '' 's/event: any/event: EpubLocationEvent/g' src/hooks/epub/useCFITracking.ts
sed -i '' 's/displayed: any/displayed: { page: number; total: number }/g' src/hooks/epub/useCFITracking.ts

# Fix useChapterManagement.ts
sed -i '' 's/book: any/book: Book/g' src/hooks/epub/useChapterManagement.ts
sed -i '' 's/spineItem: any/spineItem: SpineItem/g' src/hooks/epub/useChapterManagement.ts
sed -i '' 's/rendition: any/rendition: Rendition/g' src/hooks/epub/useChapterManagement.ts

# Fix useChapterMapping.ts
sed -i '' 's/book: any/book: Book/g' src/hooks/epub/useChapterMapping.ts

# Fix useContentHooks.ts
sed -i '' 's/: any): void/: HTMLElement): void/g' src/hooks/epub/useContentHooks.ts

# Fix useDescriptionHighlighting.ts
sed -i '' 's/rendition: any/rendition: Rendition/g' src/hooks/epub/useDescriptionHighlighting.ts

# Fix useEpubLoader.ts
sed -i '' 's/book: any/book: Book/g' src/hooks/epub/useEpubLoader.ts

# Fix useImageModal.ts
sed -i '' 's/event: any/event: MouseEvent/g' src/hooks/epub/useImageModal.ts

# Fix useProgressSync.ts
sed -i '' 's/event: any/event: EpubLocationEvent/g' src/hooks/epub/useProgressSync.ts
sed -i '' 's/position: any/position: { page: number; total: number }/g' src/hooks/epub/useProgressSync.ts

echo "✅ Epub hooks types fixed!"
