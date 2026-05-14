'use strict';

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure the uploads/products folder exists on server startup
const uploadDir = path.join(__dirname, '../../uploads/products');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 1. Disk Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Defines where to store the uploaded files
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename: timestamp-randomnumber-originalname.ext
    // Example: 1715481234-3921-vase.jpg
    const timestamp = Date.now();
    const randomNumber = Math.round(Math.random() * 10000);
    
    // Safely parse the original filename to remove spaces and special characters
    const ext = path.extname(file.originalname).toLowerCase();
    const originalNameWithoutExt = path.parse(file.originalname).name.replace(/[^a-zA-Z0-9]/g, '');
    
    const uniqueFilename = `${timestamp}-${randomNumber}-${originalNameWithoutExt}${ext}`;
    cb(null, uniqueFilename);
  }
});

// 2. File Filter Configuration
const fileFilter = (req, file, cb) => {
  // Allow ONLY specific image types
  const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  
  if (allowedMimeTypes.includes(file.mimetype)) {
    // Accept the file
    cb(null, true);
  } else {
    // Reject the file with a custom error message
    cb(new Error('Invalid file type. Only JPG, JPEG, PNG, and WebP images are allowed.'), false);
  }
};

// 3. Export Multer Configuration
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB maximum file size limit
  }
});

// Wrapper to provide beginner-friendly error handling for Express
const uploadProductImage = (req, res, next) => {
  const uploadSingle = upload.single('image');

  uploadSingle(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        // Handle Multer-specific errors
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ 
            success: false, 
            message: 'File is too large. The maximum allowed size is 5MB.' 
          });
        }
        return res.status(400).json({ 
          success: false, 
          message: `Upload error: ${err.message}` 
        });
      }
      
      // Handle custom file filter errors
      return res.status(400).json({ 
        success: false, 
        message: err.message 
      });
    }

    // Pass control to the next middleware/route handler if upload was successful
    next();
  });
};

module.exports = {
  upload,
  uploadProductImage
};
