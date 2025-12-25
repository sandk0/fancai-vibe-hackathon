#!/bin/bash

# Script to test ESLint directive cleanup
# Tests each file individually to see if directives can be removed

set -e

echo "🔍 Testing ESLint directive cleanup..."
echo ""

FILES=(
  "src/stores/images.ts"
  "src/hooks/epub/useEpubLoader.ts"
  "src/hooks/epub/useDescriptionHighlighting.ts"
  "src/hooks/epub/useTouchNavigation.ts"
  "src/hooks/epub/useChapterManagement.ts"
  "src/hooks/epub/useImageModal.ts"
  "src/hooks/epub/useCFITracking.ts"
  "src/hooks/epub/useResizeHandler.ts"
  "src/hooks/epub/useTextSelection.ts"
  "src/hooks/epub/useLocationGeneration.ts"
  "src/hooks/epub/useContentHooks.ts"
  "src/hooks/reader/useDescriptionManagement.ts"
  "src/hooks/reader/useAutoParser.ts"
  "src/hooks/reader/useChapterNavigation.ts"
  "src/components/Reader/EpubReader.tsx"
  "src/components/UI/ParsingOverlay.tsx"
)

for file in "${FILES[@]}"; do
  echo "Testing: $file"
  npx eslint "$file" --quiet || echo "  ⚠️  Has ESLint errors"
done

echo ""
echo "✅ Test complete"
