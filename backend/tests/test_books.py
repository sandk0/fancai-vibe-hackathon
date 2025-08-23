import pytest
from httpx import AsyncClient
from unittest.mock import AsyncMock, patch
from io import BytesIO


class TestBooks:
    """Test book management endpoints."""

    @pytest.mark.asyncio
    async def test_get_books_empty(self, client: AsyncClient, authenticated_headers):
        """Test getting books when none exist."""
        headers = await authenticated_headers()
        
        response = await client.get("/api/v1/books", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["books"] == []
        assert data["pagination"]["total_found"] == 0

    @pytest.mark.asyncio
    async def test_upload_book_unauthorized(self, client: AsyncClient):
        """Test uploading book without authentication."""
        files = {"file": ("test.epub", b"fake epub content", "application/epub+zip")}
        
        response = await client.post("/api/v1/books/upload", files=files)
        
        assert response.status_code == 401

    @pytest.mark.asyncio
    @patch('app.services.book_service.BookService.create_book_with_file')
    async def test_upload_book_success(self, mock_create_book, client: AsyncClient, 
                                     authenticated_headers, sample_book_data):
        """Test successful book upload."""
        headers = await authenticated_headers()
        
        # Mock the book creation
        mock_create_book.return_value = {
            "id": "test-book-id",
            **sample_book_data,
            "upload_date": "2023-01-01T00:00:00",
            "processing_status": "processing"
        }
        
        files = {"file": ("test.epub", b"fake epub content", "application/epub+zip")}
        
        response = await client.post("/api/v1/books/upload", files=files, headers=headers)
        
        assert response.status_code == 201
        data = response.json()
        assert data["title"] == sample_book_data["title"]
        assert data["processing_status"] == "processing"

    @pytest.mark.asyncio
    async def test_upload_book_invalid_format(self, client: AsyncClient, authenticated_headers):
        """Test uploading book with invalid format."""
        headers = await authenticated_headers()
        files = {"file": ("test.txt", b"not an epub file", "text/plain")}
        
        response = await client.post("/api/v1/books/upload", files=files, headers=headers)
        
        assert response.status_code == 400
        assert "unsupported file format" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_upload_book_too_large(self, client: AsyncClient, authenticated_headers):
        """Test uploading book that's too large."""
        headers = await authenticated_headers()
        
        # Create a large fake file (over 50MB)
        large_content = b"x" * (50 * 1024 * 1024 + 1)
        files = {"file": ("large.epub", large_content, "application/epub+zip")}
        
        response = await client.post("/api/v1/books/upload", files=files, headers=headers)
        
        assert response.status_code == 413

    @pytest.mark.asyncio
    @patch('app.services.book_service.BookService.get_book_by_id')
    async def test_get_book_by_id(self, mock_get_book, client: AsyncClient, 
                                 authenticated_headers, sample_book_data):
        """Test getting a book by ID."""
        headers = await authenticated_headers()
        book_id = "test-book-id"
        
        mock_get_book.return_value = {
            "id": book_id,
            **sample_book_data
        }
        
        response = await client.get(f"/api/v1/books/{book_id}", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == book_id
        assert data["title"] == sample_book_data["title"]

    @pytest.mark.asyncio
    async def test_get_nonexistent_book(self, client: AsyncClient, authenticated_headers):
        """Test getting a non-existent book."""
        headers = await authenticated_headers()
        
        response = await client.get("/api/v1/books/nonexistent-id", headers=headers)
        
        assert response.status_code == 404

    @pytest.mark.asyncio
    @patch('app.services.book_service.BookService.get_chapter')
    async def test_get_chapter(self, mock_get_chapter, client: AsyncClient, 
                              authenticated_headers, sample_chapter_data):
        """Test getting a chapter."""
        headers = await authenticated_headers()
        book_id = "test-book-id"
        chapter_num = 1
        
        mock_get_chapter.return_value = {
            "id": "chapter-id",
            "book_id": book_id,
            **sample_chapter_data
        }
        
        response = await client.get(
            f"/api/v1/books/{book_id}/chapters/{chapter_num}", 
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["chapter_number"] == chapter_num
        assert data["title"] == sample_chapter_data["title"]

    @pytest.mark.asyncio
    async def test_get_nonexistent_chapter(self, client: AsyncClient, authenticated_headers):
        """Test getting a non-existent chapter."""
        headers = await authenticated_headers()
        
        response = await client.get(
            "/api/v1/books/book-id/chapters/999", 
            headers=headers
        )
        
        assert response.status_code == 404

    @pytest.mark.asyncio
    @patch('app.services.book_service.BookService.update_reading_progress')
    async def test_update_reading_progress(self, mock_update, client: AsyncClient, 
                                         authenticated_headers):
        """Test updating reading progress."""
        headers = await authenticated_headers()
        book_id = "test-book-id"
        
        mock_update.return_value = {
            "book_id": book_id,
            "chapter_number": 2,
            "progress_percentage": 45.5,
            "last_read_at": "2023-01-01T12:00:00"
        }
        
        progress_data = {
            "chapter_number": 2,
            "progress_percentage": 45.5
        }
        
        response = await client.post(
            f"/api/v1/books/{book_id}/progress", 
            json=progress_data,
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["chapter_number"] == 2
        assert data["progress_percentage"] == 45.5

    @pytest.mark.asyncio
    async def test_update_progress_invalid_data(self, client: AsyncClient, authenticated_headers):
        """Test updating progress with invalid data."""
        headers = await authenticated_headers()
        book_id = "test-book-id"
        
        # Invalid progress (over 100%)
        progress_data = {
            "chapter_number": 1,
            "progress_percentage": 150.0
        }
        
        response = await client.post(
            f"/api/v1/books/{book_id}/progress", 
            json=progress_data,
            headers=headers
        )
        
        assert response.status_code == 422

    @pytest.mark.asyncio
    @patch('app.services.book_service.BookService.get_user_books')
    async def test_get_books_with_pagination(self, mock_get_books, client: AsyncClient, 
                                           authenticated_headers, sample_book_data):
        """Test getting books with pagination."""
        headers = await authenticated_headers()
        
        mock_books = [
            {**sample_book_data, "id": f"book-{i}", "title": f"Book {i}"}
            for i in range(5)
        ]
        
        mock_get_books.return_value = {
            "books": mock_books[:3],
            "pagination": {
                "skip": 0,
                "limit": 3,
                "total_found": 5
            }
        }
        
        response = await client.get(
            "/api/v1/books?skip=0&limit=3", 
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["books"]) == 3
        assert data["pagination"]["total_found"] == 5

    @pytest.mark.asyncio
    @patch('app.services.book_service.BookService.get_reading_statistics')
    async def test_get_reading_statistics(self, mock_get_stats, client: AsyncClient, 
                                        authenticated_headers):
        """Test getting reading statistics."""
        headers = await authenticated_headers()
        
        mock_stats = {
            "total_books": 5,
            "books_completed": 2,
            "books_in_progress": 2,
            "total_reading_time_hours": 25.5,
            "pages_read_today": 15,
            "current_streak_days": 7,
            "favorite_genres": ["Fiction", "Mystery"],
            "reading_goals": {
                "yearly_goal": 24,
                "books_read_this_year": 8,
                "progress_percentage": 33.3
            }
        }
        
        mock_get_stats.return_value = mock_stats
        
        response = await client.get("/api/v1/books/statistics", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["total_books"] == 5
        assert data["books_completed"] == 2
        assert data["reading_goals"]["yearly_goal"] == 24

    @pytest.mark.asyncio
    @patch('app.services.book_service.BookService.delete_book')
    async def test_delete_book(self, mock_delete, client: AsyncClient, authenticated_headers):
        """Test deleting a book."""
        headers = await authenticated_headers()
        book_id = "test-book-id"
        
        mock_delete.return_value = True
        
        response = await client.delete(f"/api/v1/books/{book_id}", headers=headers)
        
        assert response.status_code == 200
        assert "successfully deleted" in response.json()["message"].lower()

    @pytest.mark.asyncio
    async def test_delete_nonexistent_book(self, client: AsyncClient, authenticated_headers):
        """Test deleting a non-existent book."""
        headers = await authenticated_headers()
        
        response = await client.delete("/api/v1/books/nonexistent-id", headers=headers)
        
        assert response.status_code == 404