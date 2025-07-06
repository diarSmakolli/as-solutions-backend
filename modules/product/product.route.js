const express = require('express');
const router = express.Router();
const ProductController = require('./product.controller');
const authGuard = require('../../guards/auth.guard');
const roleGuard = require('../../guards/role.guard');
const multer = require('multer');

// Check if multer is properly installed
try {
  require('multer');
} catch (error) {
  console.error('Multer is not installed. Run: npm install multer');
  process.exit(1);
}

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 10 // Maximum 10 files
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// API Endpoints for Product Services
router.post('/create', authGuard, roleGuard("global-administrator", "administrator"), upload.array('images', 10), (req, res, next) => {
  ProductController.createProduct(req, res, next);
});

// Edit/Update product by ID
router.put('/:id/edit', authGuard, roleGuard("global-administrator", "administrator"), upload.array('images', 10), (req, res, next) => {
  ProductController.editProduct(req, res, next);
});

// Get products by category with filters and facets
router.get('/category/:categoryId', (req, res, next) => {
  ProductController.getProductsByCategory(req, res, next);
});

// Get all products with pagination and filters
router.get('/list', authGuard, (req, res, next) => {
  ProductController.getAllProducts(req, res, next);
});

// CUSTOMER ROUTES
router.get('/new-arrivals', (req, res, next) => {
  ProductController.getTopNewProducts(req, res, next);
});

// Flash deals routes
router.get('/flash-deals', (req, res, next) => {
  ProductController.getTopFlashDeals(req, res, next);
});

// Add the new advanced flash deals route
router.get('/flash-deals/advanced', (req, res, next) => {
  ProductController.getFlashDeals(req, res, next);
});

// Explore all products with infinite scroll
router.get('/explore-all', (req, res, next) => {
  ProductController.getExploreAllProducts(req, res, next);
});

router.get('/search', (req, res, next) => {
  ProductController.searchProducts(req, res, next);
});

// Get product details by ID
router.get('/:id', authGuard, (req, res, next) => {
  ProductController.getProductById(req, res, next);
});

router.get('/details/:slug', ProductController.getProductDetails);
router.get('/details/:slug/recommendations', (req, res, next) => {
  ProductController.getRecommendedProducts(req, res, next);
});

router.post('/:productId/duplicate', authGuard, roleGuard("global-administrator", "administrator"), ProductController.duplicateProduct);
router.post('/:productId/publish', authGuard, roleGuard("global-administrator", "administrator"), ProductController.publishProduct);
router.post('/:productId/archive', authGuard, roleGuard("global-administrator", "administrator"), ProductController.archiveProduct);
router.post('/:productId/unarchive', authGuard, roleGuard("global-administrator", "administrator"), ProductController.unarchiveProduct);
router.post('/:productId/unpublish', authGuard, roleGuard("global-administrator", "administrator"), ProductController.unpublishProduct);

// Custom Options Routes
router.post('/:productId/custom-options', authGuard, roleGuard("global-administrator", "administrator"), ProductController.createCustomOption);
router.get('/:productId/custom-options', authGuard, ProductController.getProductCustomOptions);
router.put('/custom-options/:optionId', authGuard, roleGuard("global-administrator", "administrator"), upload.array('images', 10), ProductController.updateCustomOption);
router.delete('/custom-options/:optionId', authGuard, roleGuard("global-administrator", "administrator"), ProductController.deleteCustomOption);
router.put(
  '/custom-options/:optionId/values/:valueId/image',
  authGuard,
  roleGuard("global-administrator", "administrator"),
  upload.single('image'),
  ProductController.updateCustomOptionValueImage
);



// Error handling middleware for multer errors
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        status: 'error',
        statusCode: 400,
        message: 'File too large. Maximum size is 10MB.'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        status: 'error',
        statusCode: 400,
        message: 'Too many files. Maximum is 10 files.'
      });
    }
  }
  if (error.message === 'Only image files are allowed') {
    return res.status(400).json({
      status: 'error',
      statusCode: 400,
      message: 'Only image files are allowed.'
    });
  }
  next(error);
});

module.exports = router;