require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fs = require("fs").promises;
const path = require("path");
const fetch = require("node-fetch");
const multer = require("multer");

const app = express();
const PORT = process.env.PORT || 3000;

// Simple password protection
const APP_PASSWORD = process.env.APP_PASSWORD || "tahli2024";

// Check if using Supabase or JSON
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const USE_SUPABASE =
  SUPABASE_URL && SUPABASE_URL !== "YOUR_SUPABASE_URL" && SUPABASE_ANON_KEY;

// Initialize Supabase if configured
let supabase = null;
if (USE_SUPABASE) {
  const { createClient } = require("@supabase/supabase-js");
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// Configure multer for file uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept images only
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed!"), false);
    }
  },
});

// JSON database file
const DB_FILE = path.join(__dirname, "library.json");
const UPLOADS_DIR = path.join(__dirname, "uploads");

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static("public"));
app.use("/uploads", express.static(UPLOADS_DIR));

// Initialize JSON database and uploads folder
async function initDB() {
  if (USE_SUPABASE) return;

  try {
    await fs.access(DB_FILE);
  } catch {
    await fs.writeFile(
      DB_FILE,
      JSON.stringify({ books: [], covers: [] }, null, 2)
    );
  }

  try {
    await fs.access(UPLOADS_DIR);
  } catch {
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
  }
}

// Read JSON database
async function readDB() {
  const data = await fs.readFile(DB_FILE, "utf8");
  return JSON.parse(data);
}

// Write JSON database
async function writeDB(data) {
  await fs.writeFile(DB_FILE, JSON.stringify(data, null, 2));
}

// Simple password check middleware
function checkPassword(req, res, next) {
  const password = req.headers["x-app-password"] || req.query.password;

  if (password === APP_PASSWORD) {
    next();
  } else {
    res.status(401).json({ error: "Invalid password" });
  }
}

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    database: USE_SUPABASE ? "supabase" : "json",
    passwordProtection: true,
    photoUploads: true,
  });
});

// Verify password endpoint
app.post("/api/verify-password", (req, res) => {
  const { password } = req.body;

  if (password === APP_PASSWORD) {
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, error: "Invalid password" });
  }
});

// Get all books with their covers
app.get("/api/books", checkPassword, async (req, res) => {
  try {
    if (USE_SUPABASE) {
      // Get books
      const { data: books, error: booksError } = await supabase
        .from("books")
        .select("*")
        .order("created_at", { ascending: false });

      if (booksError) throw booksError;

      // Get covers for all books
      const { data: covers, error: coversError } = await supabase
        .from("book_covers")
        .select("*")
        .order("uploaded_at", { ascending: false });

      if (coversError) throw coversError;

      // Combine books with their covers
      const booksWithCovers = books.map((book) => ({
        id: book.id.toString(),
        title: book.title,
        author: book.author || "",
        apiCoverUrl: book.api_cover_url || "",
        covers: covers
          .filter((c) => c.book_id === book.id)
          .map((c) => ({
            id: c.id,
            url: c.image_url,
            uploadedAt: c.uploaded_at,
          })),
        addedDate: book.created_at,
      }));

      res.json(booksWithCovers);
    } else {
      // JSON version
      const db = await readDB();
      const booksWithCovers = db.books.map((book) => ({
        ...book,
        covers: db.covers.filter((c) => c.bookId === book.id),
      }));
      res.json(booksWithCovers);
    }
  } catch (error) {
    console.error("Error fetching books:", error);
    res.status(500).json({ error: "Failed to fetch books" });
  }
});

// Add a book with photo upload
app.post(
  "/api/books",
  checkPassword,
  upload.single("photo"),
  async (req, res) => {
    try {
      const { title, author, apiCoverUrl } = req.body;
      const photo = req.file;

      if (!title) {
        return res.status(400).json({ error: "Title is required" });
      }

      if (!photo) {
        return res
          .status(400)
          .json({ error: "Photo is required when adding books manually" });
      }

      if (USE_SUPABASE) {
        // Create book first
        const { data: book, error: bookError } = await supabase
          .from("books")
          .insert([
            {
              title,
              author: author || null,
              api_cover_url: apiCoverUrl || null,
            },
          ])
          .select()
          .single();

        if (bookError) throw bookError;

        // Upload photo to Supabase Storage
        const fileExt = photo.originalname.split(".").pop();
        const fileName = `${book.id}-${Date.now()}.${fileExt}`;
        const filePath = `covers/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("book-covers")
          .upload(filePath, photo.buffer, {
            contentType: photo.mimetype,
            upsert: false,
          });

        if (uploadError) {
          // Delete the book if photo upload fails
          await supabase.from("books").delete().eq("id", book.id);
          throw uploadError;
        }

        // Get public URL for the photo
        const {
          data: { publicUrl },
        } = supabase.storage.from("book-covers").getPublicUrl(filePath);

        // Save cover reference in database
        const { error: coverError } = await supabase
          .from("book_covers")
          .insert([
            {
              book_id: book.id,
              image_url: publicUrl,
              storage_path: filePath,
            },
          ]);

        if (coverError) throw coverError;

        // Return book with cover
        const result = {
          id: book.id.toString(),
          title: book.title,
          author: book.author || "",
          apiCoverUrl: book.api_cover_url || "",
          covers: [
            {
              url: publicUrl,
              uploadedAt: new Date().toISOString(),
            },
          ],
          addedDate: book.created_at,
        };

        res.json(result);
      } else {
        // JSON version - save photo locally
        const db = await readDB();
        const bookId = Date.now().toString();

        // Save photo file
        const fileExt = photo.originalname.split(".").pop();
        const fileName = `${bookId}-${Date.now()}.${fileExt}`;
        const filePath = path.join(UPLOADS_DIR, fileName);
        await fs.writeFile(filePath, photo.buffer);

        // Create book
        const newBook = {
          id: bookId,
          title,
          author: author || "",
          apiCoverUrl: apiCoverUrl || "",
          addedDate: new Date().toISOString(),
        };

        // Create cover reference
        const coverId = Date.now() + 1;
        const newCover = {
          id: coverId,
          bookId,
          url: `/uploads/${fileName}`,
          uploadedAt: new Date().toISOString(),
        };

        db.books.push(newBook);
        db.covers.push(newCover);
        await writeDB(db);

        res.json({
          ...newBook,
          covers: [newCover],
        });
      }
    } catch (error) {
      console.error("Error adding book:", error);
      res.status(500).json({ error: error.message || "Failed to add book" });
    }
  }
);

// Add book from search (no photo required initially)
app.post("/api/books/from-search", checkPassword, async (req, res) => {
  try {
    const { title, author, apiCoverUrl } = req.body;

    if (!title) {
      return res.status(400).json({ error: "Title is required" });
    }

    if (USE_SUPABASE) {
      // Create book without photo
      const { data: book, error: bookError } = await supabase
        .from("books")
        .insert([
          {
            title,
            author: author || null,
            api_cover_url: apiCoverUrl || null,
          },
        ])
        .select()
        .single();

      if (bookError) throw bookError;

      // Return book with empty covers array
      const result = {
        id: book.id.toString(),
        title: book.title,
        author: book.author || "",
        apiCoverUrl: book.api_cover_url || "",
        covers: [],
        addedDate: book.created_at,
      };

      res.json(result);
    } else {
      // JSON version
      const db = await readDB();
      const bookId = Date.now().toString();

      const newBook = {
        id: bookId,
        title,
        author: author || "",
        apiCoverUrl: apiCoverUrl || "",
        addedDate: new Date().toISOString(),
      };

      db.books.push(newBook);
      await writeDB(db);

      res.json({
        ...newBook,
        covers: [],
      });
    }
  } catch (error) {
    console.error("Error adding book from search:", error);
    res.status(500).json({ error: error.message || "Failed to add book" });
  }
});

// Add additional cover photo to existing book
app.post(
  "/api/books/:id/covers",
  checkPassword,
  upload.single("photo"),
  async (req, res) => {
    try {
      const bookId = req.params.id;
      const photo = req.file;

      if (!photo) {
        return res.status(400).json({ error: "Photo is required" });
      }

      if (USE_SUPABASE) {
        // Upload photo to Supabase Storage
        const fileExt = photo.originalname.split(".").pop();
        const fileName = `${bookId}-${Date.now()}.${fileExt}`;
        const filePath = `covers/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("book-covers")
          .upload(filePath, photo.buffer, {
            contentType: photo.mimetype,
            upsert: false,
          });

        if (uploadError) throw uploadError;

        // Get public URL
        const {
          data: { publicUrl },
        } = supabase.storage.from("book-covers").getPublicUrl(filePath);

        // Save cover reference
        const { data, error: coverError } = await supabase
          .from("book_covers")
          .insert([
            {
              book_id: parseInt(bookId),
              image_url: publicUrl,
              storage_path: filePath,
            },
          ])
          .select()
          .single();

        if (coverError) throw coverError;

        res.json({
          id: data.id,
          url: publicUrl,
          uploadedAt: data.uploaded_at,
        });
      } else {
        // JSON version
        const db = await readDB();

        // Save photo file
        const fileExt = photo.originalname.split(".").pop();
        const fileName = `${bookId}-${Date.now()}.${fileExt}`;
        const filePath = path.join(UPLOADS_DIR, fileName);
        await fs.writeFile(filePath, photo.buffer);

        const newCover = {
          id: Date.now(),
          bookId,
          url: `/uploads/${fileName}`,
          uploadedAt: new Date().toISOString(),
        };

        db.covers.push(newCover);
        await writeDB(db);

        res.json(newCover);
      }
    } catch (error) {
      console.error("Error adding cover:", error);
      res.status(500).json({ error: "Failed to add cover photo" });
    }
  }
);

// Delete a cover photo
app.delete("/api/covers/:id", checkPassword, async (req, res) => {
  try {
    const coverId = req.params.id;

    if (USE_SUPABASE) {
      // Get cover info first
      const { data: cover, error: fetchError } = await supabase
        .from("book_covers")
        .select("storage_path")
        .eq("id", parseInt(coverId))
        .single();

      if (fetchError) throw fetchError;

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from("book-covers")
        .remove([cover.storage_path]);

      if (storageError) console.error("Storage delete error:", storageError);

      // Delete from database
      const { error: dbError } = await supabase
        .from("book_covers")
        .delete()
        .eq("id", parseInt(coverId));

      if (dbError) throw dbError;

      res.json({ success: true });
    } else {
      // JSON version
      const db = await readDB();
      const cover = db.covers.find((c) => c.id.toString() === coverId);

      if (cover) {
        // Delete file
        const filePath = path.join(__dirname, "public", cover.url);
        try {
          await fs.unlink(filePath);
        } catch (err) {
          console.error("File delete error:", err);
        }

        // Remove from database
        db.covers = db.covers.filter((c) => c.id.toString() !== coverId);
        await writeDB(db);
      }

      res.json({ success: true });
    }
  } catch (error) {
    console.error("Error deleting cover:", error);
    res.status(500).json({ error: "Failed to delete cover" });
  }
});

// Delete a book (and all its covers)
app.delete("/api/books/:id", checkPassword, async (req, res) => {
  try {
    const bookId = req.params.id;

    if (USE_SUPABASE) {
      // Get all covers for this book
      const { data: covers } = await supabase
        .from("book_covers")
        .select("storage_path")
        .eq("book_id", parseInt(bookId));

      // Delete all cover files from storage
      if (covers && covers.length > 0) {
        const paths = covers.map((c) => c.storage_path);
        await supabase.storage.from("book-covers").remove(paths);
      }

      // Delete book (covers will cascade delete)
      const { error } = await supabase
        .from("books")
        .delete()
        .eq("id", parseInt(bookId));

      if (error) throw error;

      res.json({ success: true });
    } else {
      // JSON version
      const db = await readDB();

      // Delete all cover files
      const bookCovers = db.covers.filter((c) => c.bookId === bookId);
      for (const cover of bookCovers) {
        const filePath = path.join(__dirname, "public", cover.url);
        try {
          await fs.unlink(filePath);
        } catch (err) {
          console.error("File delete error:", err);
        }
      }

      // Remove from database
      db.books = db.books.filter((b) => b.id !== bookId);
      db.covers = db.covers.filter((c) => c.bookId !== bookId);
      await writeDB(db);

      res.json({ success: true });
    }
  } catch (error) {
    console.error("Error deleting book:", error);
    res.status(500).json({ error: "Failed to delete book" });
  }
});

// Search books from Open Library API
app.get("/api/search", async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) {
      return res.json([]);
    }

    const response = await fetch(
      `https://openlibrary.org/search.json?q=${encodeURIComponent(
        query
      )}&limit=10`
    );
    const data = await response.json();

    const results = data.docs.slice(0, 10).map((book) => ({
      title: book.title,
      author: book.author_name ? book.author_name.join(", ") : "Unknown Author",
      coverUrl: book.cover_i
        ? `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg`
        : "",
      firstPublishYear: book.first_publish_year,
    }));

    res.json(results);
  } catch (error) {
    console.error("Search error:", error);
    res.status(500).json({ error: "Search failed" });
  }
});

// Start server
async function start() {
  await initDB();
  app.listen(PORT, () => {
    console.log(`🎄 Tahli's Library running on http://localhost:${PORT}`);
    console.log(
      `📊 Database: ${USE_SUPABASE ? "Supabase (PostgreSQL)" : "JSON File"}`
    );
    console.log(
      `🔐 Password: ${
        APP_PASSWORD === "tahli2024"
          ? "Using default (change in .env!)"
          : "Custom password set"
      }`
    );
    console.log(`📸 Photo uploads: Enabled`);

    if (!USE_SUPABASE) {
      console.log(`📝 Using local storage for photos`);
    }
  });
}

start();
