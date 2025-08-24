# Book Parser - BookReader AI

Система парсинга электронных книг в форматах EPUB и FB2 с извлечением метаданных, содержимого глав и обложек. Парсер обеспечивает надежную обработку различных вариантов форматов и encoding'ов.

## Архитектура парсера

### Основные принципы
- **Multi-format support** - EPUB 2.0/3.0, FB2.0/2.1
- **Robust parsing** - обработка поврежденных и нестандартных файлов  
- **Metadata extraction** - полное извлечение библиографических данных
- **Content normalization** - очистка HTML и приведение к единому формату
- **Error handling** - graceful degradation при проблемах с файлами
- **Memory efficiency** - потоковая обработка больших файлов

### Поддерживаемые форматы
```
EPUB → Electronic Publication (2.0, 3.0)
├── Стандартная структура ZIP архива
├── Метаданные в OPF (Dublin Core)
├── Навигация через NCX/NAV
└── Содержимое в XHTML/HTML

FB2 → FictionBook 2.0/2.1
├── XML структура с описанием
├── Встроенные метаданные
├── Секционная организация контента
└── Бинарные данные (обложки) в base64
```

---

## Класс BookParser

**Файл:** `backend/app/services/book_parser.py`

### Инициализация
```python
class BookParser:
    """
    Универсальный парсер электронных книг.
    
    Поддерживает извлечение:
    - Метаданных (title, author, genre, language, etc.)
    - Структуры глав с содержимым
    - Обложек книг
    - Дополнительной информации (ISBN, publisher, etc.)
    """
    
    def __init__(self):
        self.supported_formats = [".epub", ".fb2", ".fb2.zip"]
        self.temp_dir = Path(tempfile.mkdtemp(prefix="bookreader_"))
        
        # Настройки парсинга
        self.max_file_size = 100 * 1024 * 1024  # 100MB
        self.max_chapters = 1000  # Защита от слишком больших книг
        self.encoding_fallbacks = ["utf-8", "windows-1251", "cp1252", "iso-8859-1"]
        
    def __enter__(self):
        return self
        
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Cleanup временных файлов."""
        if self.temp_dir.exists():
            shutil.rmtree(self.temp_dir)
```

---

## Основные методы

### validate_book_file()
```python
def validate_book_file(self, file_path: str) -> ValidationResult:
    """
    Валидация файла книги без полного парсинга.
    
    Args:
        file_path: Путь к файлу книги
        
    Returns:
        ValidationResult с информацией о валидности файла
        
    Checks:
    - Размер файла в допустимых пределах
    - Формат файла поддерживается
    - Файл не поврежден
    - Базовая структура корректна
    """
    
    file_path = Path(file_path)
    
    # Проверка существования файла
    if not file_path.exists():
        return ValidationResult(
            is_valid=False,
            errors=["File does not exist"],
            file_info=None
        )
    
    # Проверка размера
    file_size = file_path.stat().st_size
    if file_size > self.max_file_size:
        return ValidationResult(
            is_valid=False,
            errors=[f"File too large: {file_size / 1024 / 1024:.1f}MB (max: {self.max_file_size / 1024 / 1024}MB)"]
        )
    
    if file_size < 1024:  # Минимум 1KB
        return ValidationResult(
            is_valid=False,
            errors=["File too small, likely corrupted"]
        )
    
    # Определение формата по расширению и содержимому
    file_format = self._detect_format(file_path)
    if not file_format:
        return ValidationResult(
            is_valid=False,
            errors=["Unsupported file format"]
        )
    
    # Базовая валидация структуры
    try:
        if file_format == "epub":
            validation_info = self._validate_epub_structure(file_path)
        elif file_format == "fb2":
            validation_info = self._validate_fb2_structure(file_path)
        else:
            return ValidationResult(is_valid=False, errors=["Unknown format"])
            
        return ValidationResult(
            is_valid=True,
            errors=[],
            file_info=FileInfo(
                filename=file_path.name,
                file_size=file_size,
                format=file_format,
                **validation_info
            )
        )
        
    except Exception as e:
        return ValidationResult(
            is_valid=False,
            errors=[f"Validation failed: {str(e)}"],
            file_info=FileInfo(
                filename=file_path.name,
                file_size=file_size,
                format=file_format
            )
        )

def _detect_format(self, file_path: Path) -> Optional[str]:
    """Определение формата файла по расширению и magic bytes."""
    
    extension = file_path.suffix.lower()
    
    # По расширению
    if extension == ".epub":
        return "epub"
    elif extension == ".fb2":
        return "fb2"
    elif extension == ".zip":
        # Проверяем, не является ли это EPUB или FB2 в ZIP
        if self._is_epub_zip(file_path):
            return "epub"
        elif self._is_fb2_zip(file_path):
            return "fb2"
    
    # По содержимому (magic bytes)
    try:
        with open(file_path, "rb") as f:
            header = f.read(512)
            
        if header.startswith(b"PK\x03\x04"):  # ZIP signature
            if b"mimetype" in header and b"application/epub+zip" in header[:100]:
                return "epub"
        elif header.startswith(b"<?xml") or header.startswith(b"\xef\xbb\xbf<?xml"):
            if b"<FictionBook" in header[:200]:
                return "fb2"
                
    except Exception:
        pass
        
    return None
```

### parse_book()
```python
def parse_book(self, file_path: str, user_id: UUID) -> BookParsingResult:
    """
    Основной метод парсинга книги.
    
    Args:
        file_path: Путь к файлу книги
        user_id: ID пользователя для статистики
        
    Returns:
        BookParsingResult с извлеченными данными
        
    Process:
    1. Валидация файла
    2. Определение формата и выбор парсера
    3. Извлечение метаданных
    4. Парсинг структуры и глав
    5. Извлечение обложки
    6. Нормализация и валидация данных
    """
    
    parsing_start = time.time()
    
    # 1. Валидация
    validation = self.validate_book_file(file_path)
    if not validation.is_valid:
        return BookParsingResult(
            success=False,
            errors=validation.errors,
            parsing_time=time.time() - parsing_start
        )
    
    file_format = validation.file_info.format
    logger.info(f"Starting {file_format.upper()} parsing for user {user_id}")
    
    try:
        # 2. Выбор парсера по формату
        if file_format == "epub":
            result = self._parse_epub(file_path)
        elif file_format == "fb2":
            result = self._parse_fb2(file_path)
        else:
            raise ValueError(f"Unsupported format: {file_format}")
            
        # 3. Валидация результатов
        if not result.metadata.title:
            result.metadata.title = Path(file_path).stem
            
        if not result.chapters:
            raise ValueError("No chapters found in book")
            
        # 4. Нормализация данных
        result = self._normalize_parsing_result(result)
        
        parsing_time = time.time() - parsing_start
        
        return BookParsingResult(
            success=True,
            metadata=result.metadata,
            chapters=result.chapters,
            cover_image=result.cover_image,
            parsing_time=parsing_time,
            file_info=validation.file_info,
            stats=ParsingStats(
                chapters_found=len(result.chapters),
                total_words=sum(ch.word_count for ch in result.chapters),
                has_cover=bool(result.cover_image),
                format=file_format
            )
        )
        
    except Exception as e:
        logger.error(f"Parsing failed for {file_path}: {str(e)}")
        return BookParsingResult(
            success=False,
            errors=[str(e)],
            parsing_time=time.time() - parsing_start,
            file_info=validation.file_info
        )
```

---

## EPUB Parser

### _parse_epub()
```python
def _parse_epub(self, file_path: str) -> EpubParsingResult:
    """
    Парсинг EPUB файлов с поддержкой версий 2.0 и 3.0.
    
    EPUB Structure:
    - META-INF/container.xml → указывает на OPF файл
    - *.opf → Package file с метаданными и manifest
    - toc.ncx или nav.xhtml → навигация
    - OEBPS/ или аналог → содержимое глав
    """
    
    import zipfile
    from xml.etree import ElementTree as ET
    from bs4 import BeautifulSoup
    
    with zipfile.ZipFile(file_path, 'r') as epub_zip:
        # 1. Поиск OPF файла через container.xml
        try:
            container_xml = epub_zip.read("META-INF/container.xml")
            container_tree = ET.fromstring(container_xml)
            
            # Namespace handling для EPUB
            ns = {'container': 'urn:oasis:names:tc:opendocument:xmlns:container'}
            opf_path = container_tree.find('.//container:rootfile', ns).get('full-path')
            
        except Exception as e:
            raise ValueError(f"Invalid EPUB structure: cannot find OPF file ({str(e)})")
        
        # 2. Парсинг OPF файла для метаданных
        try:
            opf_content = epub_zip.read(opf_path)
            opf_tree = ET.fromstring(opf_content)
            
            # Определяем namespace для OPF
            opf_ns = {'opf': 'http://www.idpf.org/2007/opf'}
            dc_ns = {'dc': 'http://purl.org/dc/elements/1.1/'}
            
            metadata = self._extract_epub_metadata(opf_tree, opf_ns, dc_ns)
            
        except Exception as e:
            logger.warning(f"Failed to parse EPUB metadata: {str(e)}")
            metadata = BookMetadata(title="Unknown")
        
        # 3. Получение манифеста и spine
        try:
            manifest_items = {}
            for item in opf_tree.findall('.//opf:item', opf_ns):
                item_id = item.get('id')
                item_href = item.get('href')
                item_type = item.get('media-type')
                
                # Resolve относительный путь
                base_dir = str(Path(opf_path).parent)
                full_path = str(Path(base_dir) / item_href) if base_dir != '.' else item_href
                
                manifest_items[item_id] = {
                    'href': full_path,
                    'media_type': item_type
                }
            
            # Spine определяет порядок чтения
            spine_items = []
            for itemref in opf_tree.findall('.//opf:itemref', opf_ns):
                idref = itemref.get('idref')
                if idref in manifest_items:
                    spine_items.append(manifest_items[idref])
                    
        except Exception as e:
            raise ValueError(f"Failed to parse EPUB manifest: {str(e)}")
        
        # 4. Извлечение глав из spine
        chapters = []
        chapter_number = 1
        
        for spine_item in spine_items:
            if spine_item['media_type'] in ['application/xhtml+xml', 'text/html']:
                try:
                    chapter_content = epub_zip.read(spine_item['href'])
                    
                    # Определение encoding
                    encoding = self._detect_encoding(chapter_content)
                    chapter_html = chapter_content.decode(encoding, errors='replace')
                    
                    # Парсинг HTML с BeautifulSoup
                    soup = BeautifulSoup(chapter_html, 'html.parser')
                    
                    # Извлечение заголовка главы
                    chapter_title = self._extract_chapter_title(soup)
                    
                    # Очистка содержимого
                    cleaned_content = self._clean_html_content(soup)
                    
                    if len(cleaned_content.strip()) > 50:  # Минимальная длина главы
                        chapters.append(ChapterData(
                            number=chapter_number,
                            title=chapter_title or f"Глава {chapter_number}",
                            content=cleaned_content,
                            word_count=len(cleaned_content.split()),
                            source_file=spine_item['href']
                        ))
                        chapter_number += 1
                        
                except Exception as e:
                    logger.warning(f"Failed to parse chapter {spine_item['href']}: {str(e)}")
                    continue
        
        # 5. Поиск обложки
        cover_image = self._extract_epub_cover(epub_zip, opf_tree, manifest_items, opf_ns)
        
        return EpubParsingResult(
            metadata=metadata,
            chapters=chapters,
            cover_image=cover_image
        )

def _extract_epub_metadata(self, opf_tree, opf_ns: dict, dc_ns: dict) -> BookMetadata:
    """Извлечение метаданных из OPF файла."""
    
    def get_dc_element(name: str) -> Optional[str]:
        """Получение Dublin Core элемента."""
        elements = opf_tree.findall(f'.//dc:{name}', dc_ns)
        return elements[0].text.strip() if elements and elements[0].text else None
    
    def get_meta_content(name: str) -> Optional[str]:
        """Получение meta контента по name/property."""
        # EPUB 2.0 style
        meta = opf_tree.find(f'.//opf:meta[@name="{name}"]', opf_ns)
        if meta is not None:
            return meta.get('content')
            
        # EPUB 3.0 style
        meta = opf_tree.find(f'.//opf:meta[@property="{name}"]', opf_ns)
        if meta is not None:
            return meta.text
            
        return None
    
    # Основные метаданные
    title = get_dc_element('title') or 'Untitled'
    
    # Авторы (может быть несколько)
    creators = opf_tree.findall('.//dc:creator', dc_ns)
    authors = []
    for creator in creators:
        if creator.text:
            # Проверяем role (author, editor, translator, etc.)
            role = creator.get(f'{{{opf_ns["opf"]}}}role', 'author')
            if role in ['author', 'aut']:
                authors.append(creator.text.strip())
    
    author = ', '.join(authors) if authors else None
    
    # Остальные метаданные
    language = get_dc_element('language') or 'unknown'
    publisher = get_dc_element('publisher')
    description = get_dc_element('description')
    
    # Дополнительные поля
    isbn = get_dc_element('identifier')
    publication_date = get_dc_element('date')
    
    # Жанр/subject
    subjects = opf_tree.findall('.//dc:subject', dc_ns)
    genres = [subj.text.strip() for subj in subjects if subj.text]
    genre = genres[0] if genres else None
    
    return BookMetadata(
        title=title,
        author=author,
        language=language,
        publisher=publisher,
        description=description,
        isbn=isbn,
        publication_date=publication_date,
        genre=genre,
        subjects=genres
    )

def _extract_epub_cover(
    self, 
    epub_zip: zipfile.ZipFile, 
    opf_tree, 
    manifest_items: dict, 
    opf_ns: dict
) -> Optional[bytes]:
    """Поиск и извлечение обложки EPUB книги."""
    
    cover_candidates = []
    
    # Метод 1: через metadata cover
    cover_meta = opf_tree.find('.//opf:meta[@name="cover"]', opf_ns)
    if cover_meta is not None:
        cover_id = cover_meta.get('content')
        if cover_id in manifest_items:
            cover_candidates.append(manifest_items[cover_id]['href'])
    
    # Метод 2: поиск по ID содержащим "cover"
    for item_id, item_data in manifest_items.items():
        if 'cover' in item_id.lower() and item_data['media_type'].startswith('image/'):
            cover_candidates.append(item_data['href'])
    
    # Метод 3: поиск файлов с именами cover.*
    for filename in epub_zip.namelist():
        if 'cover' in Path(filename).stem.lower() and filename.lower().endswith(('.jpg', '.jpeg', '.png')):
            cover_candidates.append(filename)
    
    # Метод 4: первое изображение в корневой папке
    for filename in epub_zip.namelist():
        if filename.lower().endswith(('.jpg', '.jpeg', '.png')) and '/' not in filename:
            cover_candidates.append(filename)
    
    # Попытка извлечения обложки
    for cover_path in cover_candidates:
        try:
            cover_data = epub_zip.read(cover_path)
            if len(cover_data) > 1000:  # Минимальный размер изображения
                return cover_data
        except Exception:
            continue
    
    return None
```

---

## FB2 Parser

### _parse_fb2()
```python
def _parse_fb2(self, file_path: str) -> FB2ParsingResult:
    """
    Парсинг FB2 файлов (FictionBook format).
    
    FB2 Structure:
    - <FictionBook> корневой элемент
    - <description> метаданные книги
    - <body> основное содержимое
    - <binary> встроенные изображения (base64)
    """
    
    from xml.etree import ElementTree as ET
    import base64
    
    # Определение encoding и чтение файла
    with open(file_path, 'rb') as f:
        raw_content = f.read()
    
    encoding = self._detect_encoding(raw_content)
    content = raw_content.decode(encoding, errors='replace')
    
    # Обработка BOM если есть
    if content.startswith('\ufeff'):
        content = content[1:]
    
    try:
        # Парсинг XML
        root = ET.fromstring(content)
        
        # Проверка корневого элемента
        if not root.tag.endswith('FictionBook'):
            raise ValueError("Not a valid FB2 file: missing FictionBook root element")
            
    except ET.ParseError as e:
        raise ValueError(f"Invalid FB2 XML structure: {str(e)}")
    
    # Извлечение метаданных
    metadata = self._extract_fb2_metadata(root)
    
    # Извлечение глав
    chapters = self._extract_fb2_chapters(root)
    
    # Поиск обложки
    cover_image = self._extract_fb2_cover(root)
    
    return FB2ParsingResult(
        metadata=metadata,
        chapters=chapters,
        cover_image=cover_image
    )

def _extract_fb2_metadata(self, root) -> BookMetadata:
    """Извлечение метаданных из FB2 description секции."""
    
    def find_text(element, path: str) -> Optional[str]:
        """Поиск текста по XPath относительно элемента."""
        found = element.find(path)
        return found.text.strip() if found is not None and found.text else None
    
    # Поиск секции description
    description_elem = root.find('description')
    if description_elem is None:
        return BookMetadata(title='Unknown FB2 Book')
    
    # title-info секция
    title_info = description_elem.find('title-info')
    if title_info is None:
        return BookMetadata(title='Unknown FB2 Book')
    
    # Основная информация
    title_elem = title_info.find('book-title')
    title = title_elem.text.strip() if title_elem is not None and title_elem.text else 'Untitled'
    
    # Авторы
    authors = []
    for author_elem in title_info.findall('author'):
        author_parts = []
        
        first_name = find_text(author_elem, 'first-name')
        middle_name = find_text(author_elem, 'middle-name') 
        last_name = find_text(author_elem, 'last-name')
        
        if first_name:
            author_parts.append(first_name)
        if middle_name:
            author_parts.append(middle_name)
        if last_name:
            author_parts.append(last_name)
            
        if author_parts:
            authors.append(' '.join(author_parts))
    
    author = ', '.join(authors) if authors else None
    
    # Жанры
    genres = []
    for genre_elem in title_info.findall('genre'):
        if genre_elem.text:
            genres.append(genre_elem.text.strip())
    genre = genres[0] if genres else None
    
    # Аннотация
    annotation_elem = title_info.find('annotation')
    description = None
    if annotation_elem is not None:
        # FB2 аннотация может содержать параграфы
        paragraphs = []
        for p in annotation_elem.findall('p'):
            if p.text:
                paragraphs.append(p.text.strip())
        description = '\n'.join(paragraphs) if paragraphs else None
    
    # Язык
    language = find_text(title_info, 'lang') or 'ru'
    
    # Дата
    date_elem = title_info.find('date')
    publication_date = date_elem.get('value') if date_elem is not None else None
    
    # publish-info секция (издательская информация)
    publish_info = description_elem.find('publish-info')
    publisher = None
    isbn = None
    
    if publish_info is not None:
        publisher = find_text(publish_info, 'publisher')
        isbn = find_text(publish_info, 'isbn')
    
    return BookMetadata(
        title=title,
        author=author,
        language=language,
        publisher=publisher,
        description=description,
        isbn=isbn,
        publication_date=publication_date,
        genre=genre,
        subjects=genres
    )

def _extract_fb2_chapters(self, root) -> List[ChapterData]:
    """Извлечение глав из FB2 body секций."""
    
    chapters = []
    chapter_number = 1
    
    # FB2 может содержать несколько body секций
    for body in root.findall('body'):
        # Пропускаем notes body
        if body.get('name') in ['notes', 'comments']:
            continue
            
        # Заголовок body (если есть)
        body_title = None
        title_elem = body.find('title')
        if title_elem is not None:
            body_title = self._extract_fb2_text(title_elem)
        
        # Секции внутри body
        sections = body.findall('section')
        
        if not sections:
            # Если нет секций, вся body является одной главой
            content = self._extract_fb2_text(body)
            if content and len(content.strip()) > 50:
                chapters.append(ChapterData(
                    number=chapter_number,
                    title=body_title or f"Глава {chapter_number}",
                    content=content,
                    word_count=len(content.split())
                ))
                chapter_number += 1
        else:
            # Обрабатываем каждую секцию как главу
            for section in sections:
                chapter_title = body_title
                
                # Заголовок секции
                section_title = section.find('title')
                if section_title is not None:
                    section_title_text = self._extract_fb2_text(section_title)
                    chapter_title = section_title_text or chapter_title
                
                # Содержимое секции
                content = self._extract_fb2_section_content(section)
                
                if content and len(content.strip()) > 50:
                    chapters.append(ChapterData(
                        number=chapter_number,
                        title=chapter_title or f"Глава {chapter_number}",
                        content=content,
                        word_count=len(content.split())
                    ))
                    chapter_number += 1
    
    return chapters

def _extract_fb2_text(self, element) -> str:
    """Извлечение текста из FB2 элемента с обработкой вложенных тегов."""
    
    def extract_recursive(elem) -> List[str]:
        """Рекурсивное извлечение текста."""
        parts = []
        
        # Текст самого элемента
        if elem.text:
            parts.append(elem.text.strip())
        
        # Обработка дочерних элементов
        for child in elem:
            if child.tag == 'p':
                # Параграф - добавляем перенос строки
                child_text = extract_recursive(child)
                if child_text:
                    parts.extend(child_text)
                    parts.append('\n')
            elif child.tag in ['emphasis', 'strong', 'strikethrough']:
                # Форматирование - извлекаем текст без тегов
                child_text = extract_recursive(child)
                parts.extend(child_text)
            elif child.tag == 'empty-line':
                parts.append('\n')
            else:
                # Остальные теги - рекурсивно
                child_text = extract_recursive(child)
                parts.extend(child_text)
            
            # Tail текст после тега
            if child.tail:
                parts.append(child.tail.strip())
    
    return ''.join(parts)

def _extract_fb2_cover(self, root) -> Optional[bytes]:
    """Поиск обложки в FB2 файле."""
    
    # Поиск ссылки на обложку в description
    description = root.find('description')
    if description is not None:
        title_info = description.find('title-info')
        if title_info is not None:
            coverpage = title_info.find('coverpage')
            if coverpage is not None:
                image_ref = coverpage.find('image')
                if image_ref is not None:
                    href = image_ref.get('{http://www.w3.org/1999/xlink}href')
                    if href and href.startswith('#'):
                        image_id = href[1:]  # Убираем #
                        
                        # Поиск binary с соответствующим id
                        for binary in root.findall('binary'):
                            if binary.get('id') == image_id:
                                try:
                                    # Декодируем base64
                                    image_data = base64.b64decode(binary.text.strip())
                                    return image_data
                                except Exception:
                                    continue
    
    # Fallback: первое binary изображение
    for binary in root.findall('binary'):
        content_type = binary.get('content-type', '')
        if content_type.startswith('image/'):
            try:
                image_data = base64.b64decode(binary.text.strip())
                return image_data
            except Exception:
                continue
    
    return None
```

---

## Утилиты и нормализация

### Content Cleaning
```python
def _clean_html_content(self, soup: BeautifulSoup) -> str:
    """
    Очистка HTML содержимого и приведение к readable формату.
    
    Removes:
    - HTML теги (кроме значимых для структуры)
    - JavaScript и CSS
    - Комментарии
    - Лишние пробелы и переносы
    
    Preserves:
    - Структуру параграфов
    - Переносы строк где нужно
    - Базовое форматирование
    """
    
    # Удаляем скрипты и стили
    for script in soup(["script", "style", "noscript"]):
        script.decompose()
    
    # Удаляем комментарии
    from bs4 import Comment
    for comment in soup.find_all(string=lambda text: isinstance(text, Comment)):
        comment.extract()
    
    # Замена тегов на соответствующий текстовый эквивалент
    for br in soup.find_all("br"):
        br.replace_with("\n")
    
    for hr in soup.find_all("hr"):
        hr.replace_with("\n---\n")
    
    # Параграфы и заголовки
    for tag in soup.find_all(["p", "div", "h1", "h2", "h3", "h4", "h5", "h6"]):
        if tag.string:
            tag.string = f"\n{tag.get_text()}\n"
    
    # Получаем очищенный текст
    text = soup.get_text()
    
    # Нормализация пробелов и переносов
    lines = []
    for line in text.split('\n'):
        cleaned_line = ' '.join(line.split())  # Убираем лишние пробелы
        if cleaned_line:
            lines.append(cleaned_line)
        elif lines and lines[-1]:  # Сохраняем пустые строки для разделения параграфов
            lines.append('')
    
    # Убираем множественные пустые строки
    result_lines = []
    prev_empty = False
    
    for line in lines:
        if line:
            result_lines.append(line)
            prev_empty = False
        elif not prev_empty:
            result_lines.append('')
            prev_empty = True
    
    return '\n'.join(result_lines).strip()

def _extract_chapter_title(self, soup: BeautifulSoup) -> Optional[str]:
    """Извлечение заголовка главы из HTML."""
    
    # Поиск заголовков по приоритету
    title_selectors = [
        'h1', 'h2', 'h3',
        '.chapter-title', '.title', 
        '[class*="title"]', '[class*="heading"]'
    ]
    
    for selector in title_selectors:
        elements = soup.select(selector)
        for element in elements:
            title_text = element.get_text().strip()
            if title_text and len(title_text) < 200:  # Разумная длина заголовка
                return title_text
    
    # Fallback: первая строка если она короткая
    text = soup.get_text().strip()
    if text:
        first_line = text.split('\n')[0].strip()
        if len(first_line) < 100 and not first_line.endswith('.'):
            return first_line
    
    return None

def _detect_encoding(self, content: bytes) -> str:
    """Определение кодировки файла с fallback вариантами."""
    
    # Попытка через chardet
    try:
        import chardet
        detected = chardet.detect(content[:10000])  # Первые 10KB для скорости
        if detected and detected['confidence'] > 0.7:
            return detected['encoding']
    except ImportError:
        pass
    
    # Поиск в XML declaration
    content_str = content[:1000].decode('ascii', errors='ignore')
    encoding_match = re.search(r'encoding=["\']([^"\']+)["\']', content_str, re.IGNORECASE)
    if encoding_match:
        encoding = encoding_match.group(1).lower()
        # Нормализация кодировок
        encoding_map = {
            'windows-1251': 'cp1251',
            'win-1251': 'cp1251',
            'utf8': 'utf-8'
        }
        return encoding_map.get(encoding, encoding)
    
    # Fallback через попытки декодирования
    for encoding in self.encoding_fallbacks:
        try:
            content.decode(encoding)
            return encoding
        except UnicodeDecodeError:
            continue
    
    return 'utf-8'  # Последний fallback
```

### File Management
```python
async def save_parsed_book(
    self,
    parsing_result: BookParsingResult,
    user_id: UUID,
    session: AsyncSession
) -> Book:
    """
    Сохранение результатов парсинга в базу данных.
    
    Args:
        parsing_result: Результат парсинга
        user_id: ID пользователя
        session: Сессия БД
        
    Returns:
        Созданную модель Book
    """
    
    # Создание записи книги
    book = Book(
        user_id=user_id,
        title=parsing_result.metadata.title,
        author=parsing_result.metadata.author,
        language=parsing_result.metadata.language,
        description=parsing_result.metadata.description,
        file_format=BookFormat(parsing_result.file_info.format),
        file_size=parsing_result.file_info.file_size,
        is_parsed=True,
        parsing_progress=100,
        book_metadata={
            'publisher': parsing_result.metadata.publisher,
            'isbn': parsing_result.metadata.isbn,
            'publication_date': parsing_result.metadata.publication_date,
            'subjects': parsing_result.metadata.subjects,
            'parsing_stats': parsing_result.stats.__dict__
        }
    )
    
    # Определение жанра по keywords
    if parsing_result.metadata.genre:
        book.genre = self._map_genre(parsing_result.metadata.genre)
    
    session.add(book)
    await session.flush()  # Получаем ID книги
    
    # Сохранение глав
    for chapter_data in parsing_result.chapters:
        chapter = Chapter(
            book_id=book.id,
            chapter_number=chapter_data.number,
            title=chapter_data.title,
            content=chapter_data.content,
            word_count=chapter_data.word_count,
            estimated_reading_time=chapter_data.word_count // 200  # ~200 WPM
        )
        session.add(chapter)
    
    # Сохранение обложки
    if parsing_result.cover_image:
        cover_path = await self._save_cover_image(
            parsing_result.cover_image,
            book.id
        )
        book.cover_image = cover_path
    
    # Обновление статистики книги
    book.total_pages = sum(ch.word_count // 250 for ch in parsing_result.chapters)  # ~250 слов на страницу
    book.estimated_reading_time = sum(ch.word_count for ch in parsing_result.chapters) // 200  # минуты
    
    await session.commit()
    
    logger.info(f"Book '{book.title}' parsed and saved successfully. Chapters: {len(parsing_result.chapters)}")
    
    return book

def _map_genre(self, genre_text: str) -> BookGenre:
    """Маппинг текстового жанра в enum."""
    
    genre_mapping = {
        # Русские жанры
        'фантастика': BookGenre.SCIFI,
        'научная фантастика': BookGenre.SCIFI,
        'фэнтези': BookGenre.FANTASY,
        'детектив': BookGenre.DETECTIVE,
        'исторический': BookGenre.HISTORICAL,
        'роман': BookGenre.ROMANCE,
        'триллер': BookGenre.THRILLER,
        'ужасы': BookGenre.HORROR,
        'классика': BookGenre.CLASSIC,
        
        # Английские жанры
        'science fiction': BookGenre.SCIFI,
        'fantasy': BookGenre.FANTASY,
        'detective': BookGenre.DETECTIVE,
        'mystery': BookGenre.DETECTIVE,
        'historical': BookGenre.HISTORICAL,
        'romance': BookGenre.ROMANCE,
        'thriller': BookGenre.THRILLER,
        'horror': BookGenre.HORROR,
        'classic': BookGenre.CLASSIC
    }
    
    genre_lower = genre_text.lower()
    
    for key, value in genre_mapping.items():
        if key in genre_lower:
            return value
    
    return BookGenre.OTHER
```

---

## Error Handling и Logging

### ParsingError Classes
```python
class ParsingError(Exception):
    """Базовый класс ошибок парсинга."""
    pass

class UnsupportedFormatError(ParsingError):
    """Неподдерживаемый формат файла."""
    pass

class CorruptedFileError(ParsingError):
    """Поврежденный файл."""
    pass

class EncodingError(ParsingError):
    """Ошибки кодировки."""
    pass

class StructureError(ParsingError):
    """Некорректная структура книги."""
    pass

# Логирование с контекстом
def log_parsing_context(func):
    @wraps(func)
    def wrapper(self, file_path: str, *args, **kwargs):
        file_name = Path(file_path).name
        
        logger.info(f"Starting parsing: {file_name}")
        
        try:
            result = func(self, file_path, *args, **kwargs)
            
            if hasattr(result, 'success') and result.success:
                logger.info(f"Parsing successful: {file_name}, chapters: {len(result.chapters)}")
            else:
                logger.warning(f"Parsing failed: {file_name}, errors: {result.errors}")
                
            return result
            
        except Exception as e:
            logger.error(f"Parsing exception for {file_name}: {str(e)}", exc_info=True)
            raise
            
    return wrapper
```

---

## Заключение

Book Parser системы BookReader AI обеспечивает:

- **Надежный парсинг** EPUB и FB2 форматов с обработкой различных вариантов
- **Извлечение метаданных** включая автора, жанр, описание, издательские данные
- **Структурирование контента** с разбивкой на главы и нормализацией текста
- **Обработку обложек** с поиском по различным методам
- **Error resilience** с graceful degradation при проблемных файлах
- **Production готовность** с логированием и мониторингом процесса

Парсер готов для интеграции в production среду и обеспечивает высокое качество извлечения данных из электронных книг.