require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// Supabase configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', database: 'supabase' });
});

// Get all books
app.get('/api/books', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('books')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Transform to match frontend expectations
        const books = data.map(book => ({
            id: book.id.toString(),
            title: book.title,
            author: book.author || '',
            isbn: '', // Not in Supabase schema
            coverUrl: book.cover_url || '',
            hasCover: book.has_physical_cover,
            addedDate: book.created_at
        }));

        res.json(books);
    } catch (error) {
        console.error('Error fetching books:', error);
        res.status(500).json({ error: 'Failed to fetch books' });
    }
});

// Add a book
app.post('/api/books', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('books')
            .insert([{
                user_id: '00000000-0000-0000-0000-000000000000', // Dummy user_id since we disabled RLS
                title: req.body.title,
                author: req.body.author || null,
                cover_url: req.body.coverUrl || null,
                has_physical_cover: req.body.hasCover || false
            }])
            .select()
            .single();

        if (error) throw error;

        // Transform response
        const book = {
            id: data.id.toString(),
            title: data.title,
            author: data.author || '',
            isbn: '',
            coverUrl: data.cover_url || '',
            hasCover: data.has_physical_cover,
            addedDate: data.created_at
        };

        res.json(book);
    } catch (error) {
        console.error('Error adding book:', error);
        res.status(500).json({ error: 'Failed to add book' });
    }
});

// Update a book
app.put('/api/books/:id', async (req, res) => {
    try {
        const updates = {};
        
        if (req.body.title !== undefined) updates.title = req.body.title;
        if (req.body.author !== undefined) updates.author = req.body.author;
        if (req.body.coverUrl !== undefined) updates.cover_url = req.body.coverUrl;
        if (req.body.hasCover !== undefined) updates.has_physical_cover = req.body.hasCover;

        const { data, error } = await supabase
            .from('books')
            .update(updates)
            .eq('id', parseInt(req.params.id))
            .select()
            .single();

        if (error) throw error;

        // Transform response
        const book = {
            id: data.id.toString(),
            title: data.title,
            author: data.author || '',
            isbn: '',
            coverUrl: data.cover_url || '',
            hasCover: data.has_physical_cover,
            addedDate: data.created_at
        };

        res.json(book);
    } catch (error) {
        console.error('Error updating book:', error);
        res.status(500).json({ error: 'Failed to update book' });
    }
});

// Delete a book
app.delete('/api/books/:id', async (req, res) => {
    try {
        const { error } = await supabase
            .from('books')
            .delete()
            .eq('id', parseInt(req.params.id));

        if (error) throw error;

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting book:', error);
        res.status(500).json({ error: 'Failed to delete book' });
    }
});

// Search books from Open Library API
app.get('/api/search', async (req, res) => {
    try {
        const query = req.query.q;
        if (!query) {
            return res.json([]);
        }

        const response = await fetch(
            `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=10`
        );
        const data = await response.json();

        const results = data.docs.slice(0, 10).map(book => ({
            title: book.title,
            author: book.author_name ? book.author_name.join(', ') : 'Unknown Author',
            isbn: book.isbn ? book.isbn[0] : '',
            coverUrl: book.cover_i 
                ? `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg`
                : '',
            firstPublishYear: book.first_publish_year
        }));

        res.json(results);
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: 'Search failed' });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`🎄 Tahli's Library running on http://localhost:${PORT}`);
    console.log(`📊 Database: Supabase (PostgreSQL)`);
    
    if (SUPABASE_URL === 'YOUR_SUPABASE_URL') {
        console.warn('⚠️  WARNING: Supabase credentials not configured!');
        console.warn('   Set SUPABASE_URL and SUPABASE_ANON_KEY environment variables');
    }
});
