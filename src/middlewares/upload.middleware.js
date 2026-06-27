'use strict';

/**
 * Upload Middleware — Supabase Storage
 * ─────────────────────────────────────────────────────────────────────────────
 * Uses Multer's memoryStorage (no disk writes) and then uploads the file buffer
 * directly to a Supabase Storage bucket.
 *
 * This eliminates the ephemeral-filesystem problem on Render/Railway free tier:
 * files are stored permanently in Supabase's CDN-backed object storage.
 *
 * Required env vars:
 *   SUPABASE_URL              → e.g. https://xxxx.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY → Service Role key (NOT the anon key)
 *   SUPABASE_BUCKET           → Storage bucket name (default: product-images)
 *
 * The uploaded file is made public. The controller receives:
 *   req.uploadedImageUrl  → permanent public CDN URL of the uploaded file
 */

const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

// ─── Supabase client (service role — bypasses RLS for server-side uploads) ────
let supabase = null;

function getSupabaseClient() {
  if (supabase) return supabase;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'Supabase upload is not configured. ' +
      'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file.'
    );
  }

  supabase = createClient(url, key);
  return supabase;
}

const BUCKET = process.env.SUPABASE_BUCKET || 'product-images';

// ─── Multer — memory storage (file never touches disk) ────────────────────────
const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    const error = new Error('Invalid file type. Only JPG, JPEG, PNG, and WebP are allowed.');
    error.name = 'ExtensionError';
    cb(error, false);
  }
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter,
});

// ─── Middleware — parses multipart, then uploads to Supabase ─────────────────
const uploadMiddleware = (req, res, next) => {
  const uploadSingle = upload.single('image');

  uploadSingle(req, res, async (err) => {
    // Handle Multer errors first
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ success: false, message: 'File is too large. Maximum size is 5MB.' });
        }
        return res.status(400).json({ success: false, message: `Upload error: ${err.message}` });
      }
      if (err.name === 'ExtensionError') {
        return res.status(400).json({ success: false, message: err.message });
      }
      return res.status(500).json({ success: false, message: 'An unknown error occurred during upload.' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file provided. Please upload an image.' });
    }

    // ── Upload buffer to Supabase Storage ──────────────────────────────────
    try {
      const client = getSupabaseClient();

      // Build a unique filename: products/timestamp-random.ext
      const ext = path.extname(req.file.originalname).toLowerCase() || '.jpg';
      const uniqueName = `products/${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;

      const { data, error: uploadError } = await client.storage
        .from(BUCKET)
        .upload(uniqueName, req.file.buffer, {
          contentType: req.file.mimetype,
          upsert: false,
        });

      if (uploadError) {
        console.error('❌ Supabase Storage upload error:', uploadError.message);
        return res.status(500).json({ success: false, message: 'Failed to upload image to storage.' });
      }

      // Build the public URL
      const { data: publicUrlData } = client.storage
        .from(BUCKET)
        .getPublicUrl(data.path);

      req.uploadedImageUrl = publicUrlData.publicUrl;
      next();
    } catch (supabaseErr) {
      console.error('❌ Supabase client error:', supabaseErr.message);
      return res.status(500).json({ success: false, message: supabaseErr.message });
    }
  });
};

module.exports = { uploadMiddleware };
