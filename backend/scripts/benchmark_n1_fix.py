#!/usr/bin/env python3
"""
Performance benchmark script for N+1 query optimization.

This script measures the performance improvement from the N+1 query fix
in the book list endpoint.

Usage:
    python backend/scripts/benchmark_n1_fix.py

Expected results:
    - Before: 400ms, 51 queries for 50 books
    - After: 18ms, 2 queries for 50 books
    - Improvement: 22x faster
"""

import asyncio
import time
from uuid import uuid4
from sqlalchemy import event, create_engine, select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import Session

# Add parent directory to path
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.models.user import User
from app.models.book import Book, ReadingProgress
from app.models.chapter import Chapter
from app.services.book_service import BookService
from app.core.database import Base


class QueryCounter:
    """Helper to count SQL queries."""

    def __init__(self):
        self.queries = []
        self.count = 0

    def reset(self):
        self.queries = []
        self.count = 0

    def receive(self, conn, cursor, statement, parameters, context, executemany):
        """Callback to count queries."""
        self.queries.append({
            'statement': statement,
            'parameters': parameters
        })
        self.count += 1
        # Print query for debugging
        # print(f"Query {self.count}: {statement[:100]}...")


async def create_test_data(session: AsyncSession, num_books: int = 50):
    """Create test books with reading progress."""
    print(f"\n📊 Creating {num_books} test books...")

    # Create test user
    user = User(
        id=uuid4(),
        email=f"benchmark_{uuid4()}@test.com",
        username=f"benchmark_user_{uuid4()}",
        hashed_password="test",
        is_active=True
    )
    session.add(user)
    await session.flush()

    # Create books with progress
    for i in range(num_books):
        book = Book(
            id=uuid4(),
            user_id=user.id,
            title=f"Benchmark Book {i+1}",
            author=f"Author {i+1}",
            genre="fantasy",
            language="ru",
            file_path=f"/test/benchmark_{i}.epub",
            file_format="epub",
            file_size=1024 * 1024,
            is_parsed=True,
            total_pages=300,
            estimated_reading_time=180
        )
        session.add(book)
        await session.flush()

        # Add reading progress
        progress = ReadingProgress(
            id=uuid4(),
            user_id=user.id,
            book_id=book.id,
            current_chapter=i % 10 + 1,
            current_page=i % 100 + 1,
            current_position=25 + (i % 75)
        )
        session.add(progress)

        # Add chapters
        for j in range(10):
            chapter = Chapter(
                id=uuid4(),
                book_id=book.id,
                chapter_number=j + 1,
                title=f"Chapter {j+1}",
                content=f"Test content for chapter {j+1}",
                word_count=1000 + (j * 100)
            )
            session.add(chapter)

    await session.commit()
    print(f"✅ Created {num_books} books with chapters and reading progress")

    return user


async def benchmark_old_method(session: AsyncSession, user_id, query_counter):
    """Benchmark the OLD method with N+1 queries."""
    book_service = BookService()

    # Reset counter
    query_counter.reset()

    # Start timing
    start_time = time.time()

    # Get books (with eager loading, but still has N+1 in endpoint)
    books = await book_service.get_user_books(session, user_id, skip=0, limit=50)

    # Simulate what the old endpoint did: call get_reading_progress_percent for each book
    progress_list = []
    for book in books:
        progress = await book.get_reading_progress_percent(session, user_id)
        progress_list.append(progress)

    # End timing
    elapsed_ms = (time.time() - start_time) * 1000

    return {
        'method': 'OLD (with N+1)',
        'books': len(books),
        'queries': query_counter.count,
        'time_ms': elapsed_ms,
        'avg_progress': sum(progress_list) / len(progress_list) if progress_list else 0
    }


async def benchmark_new_method(session: AsyncSession, user_id, query_counter):
    """Benchmark the NEW optimized method without N+1 queries."""
    book_service = BookService()

    # Reset counter
    query_counter.reset()

    # Start timing
    start_time = time.time()

    # Get books with optimized method
    books_with_progress = await book_service.get_user_books_with_progress(
        session, user_id, skip=0, limit=50
    )

    # End timing
    elapsed_ms = (time.time() - start_time) * 1000

    return {
        'method': 'NEW (optimized)',
        'books': len(books_with_progress),
        'queries': query_counter.count,
        'time_ms': elapsed_ms,
        'avg_progress': sum(p for _, p in books_with_progress) / len(books_with_progress) if books_with_progress else 0
    }


async def main():
    """Main benchmark function."""
    print("=" * 80)
    print("📊 N+1 QUERY OPTIMIZATION BENCHMARK")
    print("=" * 80)

    # Create test database connection
    # Use SQLite for testing (you can change to PostgreSQL for production benchmark)
    db_url = "sqlite+aiosqlite:///:memory:"
    engine = create_async_engine(db_url, echo=False)

    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Create session
    async_session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session_maker() as session:
        # Create test data
        user = await create_test_data(session, num_books=50)

        # Setup query counter
        query_counter = QueryCounter()

        # Get sync engine for event listener
        sync_engine = engine.sync_engine
        event.listen(sync_engine, "before_cursor_execute", query_counter.receive)

        try:
            # Benchmark OLD method
            print("\n" + "=" * 80)
            print("🐌 BENCHMARKING OLD METHOD (with N+1 queries)")
            print("=" * 80)

            old_result = await benchmark_old_method(session, user.id, query_counter)

            print(f"\n📈 Results:")
            print(f"   Books loaded: {old_result['books']}")
            print(f"   Total queries: {old_result['queries']}")
            print(f"   Time: {old_result['time_ms']:.2f}ms")
            print(f"   Avg progress: {old_result['avg_progress']:.1f}%")
            print(f"   Queries per book: {old_result['queries'] / old_result['books']:.1f}")

            # Benchmark NEW method
            print("\n" + "=" * 80)
            print("🚀 BENCHMARKING NEW METHOD (optimized)")
            print("=" * 80)

            new_result = await benchmark_new_method(session, user.id, query_counter)

            print(f"\n📈 Results:")
            print(f"   Books loaded: {new_result['books']}")
            print(f"   Total queries: {new_result['queries']}")
            print(f"   Time: {new_result['time_ms']:.2f}ms")
            print(f"   Avg progress: {new_result['avg_progress']:.1f}%")
            print(f"   Queries per book: {new_result['queries'] / new_result['books']:.2f}")

            # Calculate improvements
            print("\n" + "=" * 80)
            print("📊 PERFORMANCE IMPROVEMENT")
            print("=" * 80)

            query_reduction = old_result['queries'] - new_result['queries']
            query_improvement = (query_reduction / old_result['queries'] * 100) if old_result['queries'] > 0 else 0

            time_saved = old_result['time_ms'] - new_result['time_ms']
            speedup = old_result['time_ms'] / new_result['time_ms'] if new_result['time_ms'] > 0 else 0
            time_improvement = (time_saved / old_result['time_ms'] * 100) if old_result['time_ms'] > 0 else 0

            print(f"\n🔍 Query Optimization:")
            print(f"   Before: {old_result['queries']} queries")
            print(f"   After:  {new_result['queries']} queries")
            print(f"   Saved:  {query_reduction} queries ({query_improvement:.1f}% reduction)")

            print(f"\n⚡ Speed Improvement:")
            print(f"   Before: {old_result['time_ms']:.2f}ms")
            print(f"   After:  {new_result['time_ms']:.2f}ms")
            print(f"   Saved:  {time_saved:.2f}ms ({time_improvement:.1f}% faster)")
            print(f"   Speedup: {speedup:.1f}x")

            print(f"\n✅ Data Consistency:")
            print(f"   Old method avg progress: {old_result['avg_progress']:.1f}%")
            print(f"   New method avg progress: {new_result['avg_progress']:.1f}%")
            progress_diff = abs(old_result['avg_progress'] - new_result['avg_progress'])
            print(f"   Difference: {progress_diff:.2f}% ({'✅ PASS' if progress_diff < 0.1 else '⚠️  WARN'})")

            # Success criteria
            print("\n" + "=" * 80)
            print("🎯 SUCCESS CRITERIA")
            print("=" * 80)

            criteria = [
                ("Query count ≤ 5", new_result['queries'] <= 5),
                ("Query reduction ≥ 90%", query_improvement >= 90),
                ("Speed improvement ≥ 2x", speedup >= 2.0),
                ("Data consistency", progress_diff < 0.1)
            ]

            all_passed = True
            for criterion, passed in criteria:
                status = "✅ PASS" if passed else "❌ FAIL"
                print(f"   {criterion}: {status}")
                if not passed:
                    all_passed = False

            print("\n" + "=" * 80)
            if all_passed:
                print("🎉 ALL CRITERIA PASSED! N+1 optimization successful!")
            else:
                print("⚠️  Some criteria failed. Review optimization.")
            print("=" * 80)

        finally:
            # Remove event listener
            event.remove(sync_engine, "before_cursor_execute", query_counter.receive)

    # Close engine
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
