# Test Fixtures Files

This directory should contain sample book files for E2E testing.

## Required Files:

1. **sample.epub** - Small EPUB file for testing upload and reading
2. **sample.fb2** - Small FB2 file for testing FB2 format support
3. **large-sample.epub** - Larger EPUB file for performance testing
4. **invalid.txt** - Invalid file format for error handling tests

## Where to Get Sample Files:

### EPUB Files:
- Project Gutenberg: https://www.gutenberg.org/
- Standard Ebooks: https://standardebooks.org/
- Create test EPUB: Use Calibre or Sigil

### FB2 Files:
- Convert EPUB to FB2 using Calibre
- FictionBook.org sample files

## Size Recommendations:

- **sample.epub**: < 500KB (quick tests)
- **sample.fb2**: < 500KB (quick tests)
- **large-sample.epub**: 2-5MB (performance tests)
- **invalid.txt**: Any small text file

## Setup Instructions:

1. Download or create sample files
2. Place them in this directory
3. Ensure file names match exactly as listed above
4. Run tests: `npm run test:e2e`

## Note:

These files are NOT checked into version control (.gitignore).
Each developer needs to set up their own test files locally.
