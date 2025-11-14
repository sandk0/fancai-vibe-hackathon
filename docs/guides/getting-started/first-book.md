# Your First Book - Complete Walkthrough

This guide walks you through uploading and reading your first book with AI-generated illustrations in BookReader AI.

## Prerequisites

- BookReader AI installed and running ([Quick Start](quick-start.md))
- An EPUB or FB2 book file ready to upload
- User account created (admin or regular user)

## Step-by-Step Guide

### Step 1: Login to Application

1. **Open Application**
   ```
   http://localhost:5173
   ```

2. **Enter Credentials**
   - Email: Your registered email
   - Password: Your password

3. **Click "Login"**

**Troubleshooting:**
- Forgot password? Use "Reset Password" link
- Account not created? See [Quick Start](quick-start.md#step-5-create-admin-account)

### Step 2: Navigate to Library

After login, you'll see:
- **Dashboard** - Your reading statistics
- **Library** - Your book collection (currently empty)
- **Settings** - User preferences

Click **"Library"** in the navigation menu.

### Step 3: Upload a Book

#### Option A: Drag and Drop (Recommended)

1. **Prepare Your File**
   - Supported formats: EPUB, FB2
   - Recommended: EPUB for best compatibility
   - File size limit: 50MB

2. **Drag Book File**
   - Drag EPUB/FB2 file into the upload area
   - You'll see a highlight when hovering

3. **Drop to Upload**
   - Release mouse to start upload
   - Progress bar will appear

#### Option B: Browse and Select

1. **Click "Upload Book" Button**
   - Located in library page
   - Opens file picker dialog

2. **Select File**
   - Navigate to your book
   - Select EPUB or FB2 file
   - Click "Open"

3. **Confirm Upload**
   - Upload starts automatically
   - Progress bar shows upload progress

### Step 4: Wait for Processing

After upload completes, automatic processing starts:

**Phase 1: Book Parsing (5-10 seconds)**
- Extracting metadata (title, author, cover)
- Parsing chapters and content
- Analyzing book structure

**Progress Indicator:**
```
📖 Parsing book...
└─ Extracting chapters: 15/25
└─ Parsing content: 60%
```

**Phase 2: NLP Analysis (10-30 seconds)**
- Advanced Multi-NLP system analyzes text
- Extracting location descriptions
- Extracting character descriptions
- Extracting atmosphere descriptions

**Progress Indicator:**
```
🤖 Analyzing descriptions...
└─ NLP Mode: ENSEMBLE
└─ Descriptions found: 127
└─ Progress: 18/25 chapters
```

**Phase 3: Image Generation (background)**
- AI generates images for descriptions
- Runs in background (Celery workers)
- You can start reading immediately!

**What to Expect:**
- Total parsing time: 15-40 seconds
- Descriptions extracted: 50-200+ (depends on book length)
- Images generate over next 5-15 minutes

### Step 5: View Book Information

After parsing completes, book appears in library:

**Book Card Shows:**
- Cover image (extracted from EPUB)
- Title and author
- Total chapters
- Total descriptions found
- Processing status
- "Open Book" button

**Click on Book Card** to see details:
- Full metadata
- List of chapters
- Description statistics by type:
  - 🏛️ Locations: 45
  - 👤 Characters: 32
  - 🌅 Atmosphere: 50
- Reading progress: 0%

### Step 6: Start Reading

**Click "Open Book" Button**

The reader interface opens with:

**Left Sidebar:**
- Table of contents
- Chapter navigation
- Bookmark list
- Search function

**Main Reading Area:**
- Book content with professional typography
- Smart description highlighting:
  - 🏛️ Blue highlight = Location descriptions
  - 👤 Green highlight = Character descriptions
  - 🌅 Orange highlight = Atmosphere descriptions
- Click highlighted text to see generated image

**Right Toolbar:**
- Font size controls (+/-)
- Theme toggle (light/dark)
- Settings (font family, line spacing)
- Progress indicator

### Step 7: Interact with Descriptions

**Click on Highlighted Text:**

1. **Modal Opens** showing:
   - Generated AI image
   - Original text description
   - Description type
   - Generation parameters
   - "Download" button

2. **Navigation:**
   - Previous/Next arrows to browse images
   - Close button (or press ESC)

3. **Actions:**
   - Download image
   - Copy description
   - Report issue (if image doesn't match)

**Keyboard Shortcuts:**
- `ESC` - Close modal
- `←` / `→` - Previous/Next image
- `S` - Save/Download image

### Step 8: Reading Features

#### Reading Progress

Your progress is automatically saved:
- **CFI Position** - Exact scroll position
- **Percentage** - Overall book progress (0-100%)
- **Last Chapter** - Chapter you're reading
- **Last Read** - Timestamp

**Progress indicator shows:**
```
Chapter 5 of 25 (20%) - Last read: 2 minutes ago
```

#### Bookmarks

**Create Bookmark:**
1. Click bookmark icon in toolbar
2. Add optional note
3. Click "Save"

**View Bookmarks:**
- Open left sidebar
- Click "Bookmarks" tab
- Click bookmark to jump to location

#### Highlights

**Create Highlight:**
1. Select text with mouse
2. Click highlight color (yellow/green/blue/pink)
3. Add optional note
4. Click "Save"

**View Highlights:**
- Open left sidebar
- Click "Highlights" tab
- Click highlight to jump to location

#### Search

**Search in Book:**
1. Click search icon (🔍)
2. Enter search term
3. View results with context
4. Click result to jump to location

### Step 9: Customize Reading Experience

**Font Settings:**
- Font family: Serif, Sans-serif, Monospace
- Font size: 12px - 24px (click +/-)
- Line height: 1.5 - 2.0
- Text align: Left, Justify

**Theme Settings:**
- Light theme (default)
- Dark theme (AMOLED-friendly)
- Sepia theme (reduced eye strain)
- Custom colors (advanced)

**Layout Settings:**
- Single page (default)
- Scroll view (continuous)
- Two-page spread (desktop only)
- Margins: Narrow, Normal, Wide

**Save Settings:**
- Settings auto-save per user
- Sync across devices (if logged in)

### Step 10: Advanced Features

#### NLP Mode Selection (Admin Only)

If you're an admin, you can adjust NLP processing:

**Access Admin Panel:**
```
http://localhost:8000/admin
```

**Multi-NLP Settings:**
1. Navigate to "NLP Settings"
2. Choose processing mode:
   - **ENSEMBLE** (recommended) - Best quality
   - **ADAPTIVE** - Automatic mode selection
   - **PARALLEL** - Maximum coverage
   - **SEQUENTIAL** - Sequential processing
   - **SINGLE** - Fast (single processor)

3. Adjust processor weights:
   - **SpaCy**: 1.0 (default)
   - **Natasha**: 1.2 (best for Russian)
   - **Stanza**: 0.8

4. Set thresholds:
   - Lower = more descriptions (less precise)
   - Higher = fewer descriptions (more precise)

**Re-process Book:**
- After changing settings
- Click "Re-process" on book card
- New descriptions will be extracted

#### Image Generation Settings

**Configure AI Service:**

In `.env` file:
```bash
# Use pollinations.ai (free, default)
POLLINATIONS_ENABLED=true

# Or use DALL-E (requires API key)
OPENAI_API_KEY=sk-...
IMAGE_SERVICE=openai

# Or use Midjourney (requires subscription)
MIDJOURNEY_API_KEY=...
IMAGE_SERVICE=midjourney
```

**Generation Parameters:**
- Quality: Standard, HD (DALL-E only)
- Steps: 30-50 (Stable Diffusion)
- Style: Realistic, Artistic, Cinematic
- Negative prompt: What to avoid

#### Export and Sharing

**Export Options:**

1. **Export Annotations**
   - Bookmarks, highlights, notes
   - Format: JSON, PDF, DOCX
   - Click "Export" in settings

2. **Export Images**
   - Download all generated images
   - Format: ZIP archive
   - Click "Export Images" on book page

3. **Share Reading List**
   - Share your library with friends
   - Generate shareable link
   - Privacy settings apply

## Common Workflows

### Quick Reading Session

1. Login → Library
2. Click book → Open
3. Read highlighted text
4. Click highlights for images
5. Progress auto-saves

**Time:** 2-3 minutes to start reading

### Deep Analysis Session

1. Upload book → Wait for parsing
2. Review description statistics
3. Adjust NLP settings (if admin)
4. Re-process for better results
5. Read with enhanced descriptions
6. Export annotations

**Time:** 30-60 minutes initial setup, then normal reading

### Batch Upload Session

1. Prepare multiple books (5-10)
2. Drag-drop all at once
3. Processing happens in parallel
4. Come back later (15-30 minutes)
5. All books ready to read

**Time:** 1 minute upload, 15-30 minutes processing

## Tips and Best Practices

### For Best Results

1. **Use EPUB Format**
   - Best compatibility with CFI positioning
   - Professional typography
   - Fastest parsing

2. **Choose ENSEMBLE Mode**
   - Highest quality descriptions
   - 60% consensus threshold
   - Best for Russian literature

3. **Let Images Generate in Background**
   - Start reading immediately
   - Images appear as they're generated
   - Check back after 10-15 minutes for all images

4. **Customize Reader Settings**
   - Adjust font size for comfort
   - Use dark theme in evening
   - Enable auto-scroll for hands-free reading

### Performance Optimization

1. **Upload During Off-Peak**
   - Less server load
   - Faster processing
   - Better image generation

2. **Batch Upload Related Books**
   - Series books together
   - Same genre benefits from cached models
   - Parallel processing is efficient

3. **Clear Browser Cache**
   - If experiencing slowness
   - Refresh page after clearing
   - Settings are preserved (server-side)

## Troubleshooting

### Book Won't Upload

**Check:**
- File format (EPUB, FB2 only)
- File size (<50MB)
- File not corrupted (try opening in another app)

**Solutions:**
- Convert to EPUB using Calibre
- Split large books into volumes
- Check server logs: `docker-compose logs backend`

### Parsing Stuck

**Symptoms:**
- Progress bar not moving
- Stuck at 0%
- Timeout error

**Solutions:**
```bash
# Check Celery worker
docker-compose logs celery-worker

# Restart worker
docker-compose restart celery-worker

# Re-upload book
# Library → Book → Delete → Upload again
```

### No Descriptions Found

**Symptoms:**
- Parsing completes but 0 descriptions
- Empty description statistics

**Solutions:**
1. Check NLP mode (should be ENSEMBLE or ADAPTIVE)
2. Lower threshold (0.2-0.3 recommended)
3. Verify book language is Russian
4. Check NLP models installed:
   ```bash
   docker-compose exec backend python -c "import spacy; spacy.load('ru_core_news_lg')"
   ```

### Images Not Generating

**Symptoms:**
- Descriptions found but no images
- Images stuck at "Generating..."

**Solutions:**
```bash
# Check image service
curl https://image.pollinations.ai/prompt/test

# Check Celery tasks
docker-compose exec redis redis-cli LLEN celery

# Restart Celery
docker-compose restart celery-worker

# Check API key (if using DALL-E)
echo $OPENAI_API_KEY
```

### Reading Position Not Saved

**Symptoms:**
- Progress resets to 0%
- Scroll position lost

**Solutions:**
1. Check browser cookies enabled
2. Check localStorage not full
3. Try different browser
4. Verify login session active

For more help, see [Troubleshooting Guide](../../../TROUBLESHOOTING.md).

## What's Next?

Now that you've uploaded your first book:

1. **Explore Features**
   - Try different themes
   - Create bookmarks and highlights
   - Search within book

2. **Upload More Books**
   - Build your library
   - Try different genres
   - Compare NLP quality

3. **Advanced Usage**
   - Adjust NLP settings (admin)
   - Configure AI services
   - Export annotations

4. **Share Feedback**
   - Report issues on GitHub
   - Suggest improvements
   - Contribute to project

## Resources

- [User Manual](user-manual.md) - Complete feature guide
- [FAQ](../../../FAQ.md) - Common questions
- [Troubleshooting](../../../TROUBLESHOOTING.md) - Problem solving
- [Multi-NLP System](../../reference/nlp/multi-nlp-system.md) - Technical details
- [CFI System](../../explanations/concepts/cfi-system.md) - Reading position

---

**Congratulations!** You've successfully uploaded and are reading your first book with AI-generated illustrations.

For questions, check [FAQ](../../../FAQ.md) or open an issue on GitHub.

**Last Updated:** November 14, 2025
