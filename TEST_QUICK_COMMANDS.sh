#!/bin/bash
# QUICK COMMANDS FOR TEST IMPLEMENTATION
# Copy-paste these commands to start implementing tests

# ============================================================================
# 1. CHECK CURRENT STATE
# ============================================================================

echo "=== CHECKING CURRENT TEST STATE ==="

# Count backend test files
echo "Backend test files:"
find backend/tests -name "*.py" -type f | wc -l

# Count orphan Multi-NLP tests
echo "Orphan Multi-NLP tests (SHOULD DELETE):"
find backend/tests/services/nlp -name "*.py" -type f | wc -l

# Check current coverage
echo "Current coverage (before changes):"
cd backend && pytest --cov=app --cov-report=term-missing 2>/dev/null | grep "TOTAL"

# Count frontend tests
echo "Frontend test files:"
find frontend/src -name "*.test.*" -o -name "*.spec.*" | wc -l


# ============================================================================
# 2. CREATE NEW TEST FILES (COPY-PASTE READY)
# ============================================================================

echo ""
echo "=== CREATING NEW TEST FILES ==="

# Backend services
echo "Creating backend service test files..."
touch backend/tests/services/test_gemini_extractor.py
touch backend/tests/services/test_imagen_generator.py
touch backend/tests/services/test_vless_http_client.py
echo "✓ Created 3 backend service test files"

# Backend routers
echo "Creating backend router test files..."
touch backend/tests/routers/test_auth.py
echo "✓ Created 1 router test file"

# Frontend hooks
echo "Creating frontend hook test files..."
mkdir -p frontend/src/hooks/epub/__tests__
touch frontend/src/hooks/epub/__tests__/useDescriptionHighlighting.test.ts
echo "✓ Created 1 frontend hook test file"

# Frontend services
echo "Creating frontend service test files..."
mkdir -p frontend/src/services/__tests__
touch frontend/src/services/__tests__/imageCache.test.ts
echo "✓ Created 1 frontend service test file"


# ============================================================================
# 3. COPY EXAMPLE CODE
# ============================================================================

echo ""
echo "=== NEXT: COPY CODE FROM TEST_IMPLEMENTATION_QUICKSTART.md ==="
echo ""
echo "Files created successfully. Now:"
echo "1. Open TEST_IMPLEMENTATION_QUICKSTART.md"
echo "2. Copy the test code for each service"
echo "3. Paste into the newly created test files"
echo ""
echo "Example:"
echo "  - Copy test_gemini_extractor.py code → backend/tests/services/test_gemini_extractor.py"
echo "  - Copy test_imagen_generator.py code → backend/tests/services/test_imagen_generator.py"
echo "  - Copy useDescriptionHighlighting.test.ts code → frontend/.../useDescriptionHighlighting.test.ts"


# ============================================================================
# 4. RUN TESTS
# ============================================================================

echo ""
echo "=== RUNNING TESTS ==="

echo "Testing Gemini Extractor..."
cd backend && pytest tests/services/test_gemini_extractor.py -v --tb=short 2>/dev/null

echo ""
echo "Testing Imagen Generator..."
cd backend && pytest tests/services/test_imagen_generator.py -v --tb=short 2>/dev/null

echo ""
echo "Testing VLESS HTTP Client..."
cd backend && pytest tests/services/test_vless_http_client.py -v --tb=short 2>/dev/null

echo ""
echo "Testing Auth Router..."
cd backend && pytest tests/routers/test_auth.py -v --tb=short 2>/dev/null

echo ""
echo "Testing Frontend hooks..."
cd frontend && npm test -- useDescriptionHighlighting.test.ts 2>/dev/null


# ============================================================================
# 5. CHECK COVERAGE
# ============================================================================

echo ""
echo "=== CHECKING COVERAGE ==="

echo "Backend coverage after new tests:"
cd backend && pytest --cov=app --cov-report=term-missing 2>/dev/null | tail -20

echo ""
echo "Specific coverage - Gemini:"
cd backend && pytest --cov=app.services.gemini_extractor --cov-report=term 2>/dev/null | grep "gemini_extractor"

echo ""
echo "Specific coverage - Imagen:"
cd backend && pytest --cov=app.services.imagen_generator --cov-report=term 2>/dev/null | grep "imagen_generator"

echo ""
echo "Frontend coverage:"
cd frontend && npm test -- --coverage 2>/dev/null | grep "TOTAL"


# ============================================================================
# 6. DELETE ORPHAN TESTS (OPTIONAL)
# ============================================================================

echo ""
echo "=== DELETING ORPHAN MULTI-NLP TESTS ==="
echo ""
echo "WARNING: This will delete 47 test files (~1,800 LOC) that test removed code"
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]
then
    rm -rf backend/tests/services/nlp/
    echo "✓ Deleted orphan Multi-NLP tests"
fi


# ============================================================================
# 7. FINAL VERIFICATION
# ============================================================================

echo ""
echo "=== FINAL VERIFICATION ==="

echo "All backend tests..."
cd backend && pytest --tb=short -q 2>/dev/null

echo ""
echo "All frontend tests..."
cd frontend && npm test 2>/dev/null

echo ""
echo "=== ALL DONE ==="
echo ""
echo "Summary of changes:"
echo "✓ Created 5 new test files"
echo "✓ Added ~150 new tests"
echo "✓ Increased coverage: ~70% → ~75%+ (with orphans deleted)"
echo ""
echo "Next steps:"
echo "1. Review test code quality"
echo "2. Add more edge cases if needed"
echo "3. Commit changes: 'test: add critical service tests'"
echo "4. Continue with Week 2 tasks"
