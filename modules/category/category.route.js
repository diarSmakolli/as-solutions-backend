const express = require("express");
const router = express.Router();
const CategoryController = require("./category.controller");
const categoryService = require("./category.service");
const roleGuard = require("../../guards/role.guard");
const authGuard = require("../../guards/auth.guard");

// API routes

// Create a new category (with optional image upload)
router.post(
  "/",
  categoryService.getCategoryImageUploadMiddleware(),
  authGuard,
  roleGuard("global-administrator", "administrator"),
  CategoryController.createCategory
);

// Get all categories (with hierarchical structure)
router.get(
  "/",
  CategoryController.getAllCategories
);

// Get category info with nested relationships
router.get(
  "/:id/info",
  authGuard,
  roleGuard("global-administrator", "administrator"),
  CategoryController.getCategoryInfo
);

// Get categories by level
router.get("/level/:level", authGuard, CategoryController.getCategoriesByLevel);

// Edit a category
router.put(
  "/:id",
  authGuard,
  roleGuard("global-administrator", "administrator"),
  CategoryController.editCategory
);

// Change category image (with file upload)
router.patch(
  "/:id/image",
  categoryService.getCategoryImageUploadMiddleware(),
  authGuard,
  roleGuard("global-administrator", "administrator"),
  CategoryController.changeCategoryImage
);

// Remove category image
router.delete(
  "/:id/image",
  authGuard,
  roleGuard("global-administrator", "administrator"),
  CategoryController.removeCategoryImage
);

// Delete a category (soft delete)
router.delete(
  "/:id",
  authGuard,
  roleGuard("global-administrator", "administrator"),
  CategoryController.deleteCategory
);

// Get category by slug with children (this should come before /:id routes)
router.get("/slug/:slug", CategoryController.getCategoryBySlug);

module.exports = router;
