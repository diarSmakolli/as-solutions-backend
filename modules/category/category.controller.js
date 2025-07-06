const categoryService = require("./category.service");
const logger = require("../../logger/logger");

class CategoryController {
  // Create a new category
  async createCategory(req, res, next) {
    try {
      const category = await categoryService.createCategory(req.body, req.file);
      res.status(201).json({
        success: true,
        data: category,
        message: "Category created successfully",
      });
    } catch (err) {
      logger.error("Error in createCategory controller:", err);

      // Handle structured errors from service
      if (err.status && err.statusCode && err.message) {
        return res.status(err.statusCode).json({
          success: false,
          status: err.status,
          message: err.message,
          details: err.details || [],
        });
      }

      // Handle other errors
      next(err);
    }
  }

  // Edit a category
  async editCategory(req, res, next) {
    try {
      const { id } = req.params;
      const category = await categoryService.editCategory(id, req.body);
      res.status(200).json({
        success: true,
        data: category,
        message: "Category updated successfully",
      });
    } catch (err) {
      logger.error("Error in editCategory controller:", err);

      // Handle structured errors from service
      if (err.status && err.statusCode && err.message) {
        return res.status(err.statusCode).json({
          success: false,
          status: err.status,
          message: err.message,
          details: err.details || [],
        });
      }

      // Handle other errors
      next(err);
    }
  }

  // Get all categories
  async getAllCategories(req, res, next) {
    try {
      const includeInactive = req.query.includeInactive === "true";
      const categories = await categoryService.getAllCategories(
        includeInactive
      );
      res.status(200).json({
        success: true,
        data: categories,
        message: "Categories fetched successfully",
      });
    } catch (err) {
      logger.error("Error in getAllCategories controller:", err);

      // Handle structured errors from service
      if (err.status && err.statusCode && err.message) {
        return res.status(err.statusCode).json({
          success: false,
          status: err.status,
          message: err.message,
          details: err.details || [],
        });
      }

      // Handle other errors
      next(err);
    }
  }

  // Get category by slug with children
  async getCategoryBySlug(req, res, next) {
    try {
      const { slug } = req.params;
      const categoryData = await categoryService.getCategoryBySlug(slug);
      res.status(200).json({
        success: true,
        data: categoryData,
        message: "Category fetched successfully",
      });
    } catch (err) {
      logger.error("Error in getCategoryBySlug controller:", err);

      // Handle structured errors from service
      if (err.status && err.statusCode && err.message) {
        return res.status(err.statusCode).json({
          success: false,
          status: err.status,
          message: err.message,
          details: err.details || [],
        });
      }

      // Handle other errors
      next(err);
    }
  }

  // Delete a category (soft delete)
  async deleteCategory(req, res, next) {
    try {
      const { id } = req.params;
      const result = await categoryService.deleteCategory(id);
      res.status(200).json({
        success: true,
        data: result,
        message: "Category deleted successfully",
      });
    } catch (err) {
      logger.error("Error in deleteCategory controller:", err);

      // Handle structured errors from service
      if (err.status && err.statusCode && err.message) {
        return res.status(err.statusCode).json({
          success: false,
          status: err.status,
          message: err.message,
          details: err.details || [],
        });
      }

      // Handle other errors
      next(err);
    }
  }

  // Get category info with nested relationships
  async getCategoryInfo(req, res, next) {
    try {
      const { id } = req.params;
      const categoryInfo = await categoryService.getCategoryInfo(id);
      res.status(200).json({
        success: true,
        data: categoryInfo,
        message: "Category info fetched successfully",
      });
    } catch (err) {
      logger.error("Error in getCategoryInfo controller:", err);

      // Handle structured errors from service
      if (err.status && err.statusCode && err.message) {
        return res.status(err.statusCode).json({
          success: false,
          status: err.status,
          message: err.message,
          details: err.details || [],
        });
      }

      // Handle other errors
      next(err);
    }
  }

  // Change category image
  async changeCategoryImage(req, res, next) {
    try {
      const { id } = req.params;

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Image file is required",
        });
      }

      const category = await categoryService.changeCategoryImage(id, req.file);
      res.status(200).json({
        success: true,
        data: category,
        message: "Category image updated successfully",
      });
    } catch (err) {
      logger.error("Error in changeCategoryImage controller:", err);

      // Handle structured errors from service
      if (err.status && err.statusCode && err.message) {
        return res.status(err.statusCode).json({
          success: false,
          status: err.status,
          message: err.message,
          details: err.details || [],
        });
      }

      // Handle other errors
      next(err);
    }
  }

  // Remove category image
  async removeCategoryImage(req, res, next) {
    try {
      const { id } = req.params;
      const category = await categoryService.removeCategoryImage(id);
      res.status(200).json({
        success: true,
        data: category,
        message: "Category image removed successfully",
      });
    } catch (err) {
      logger.error("Error in removeCategoryImage controller:", err);

      // Handle structured errors from service
      if (err.status && err.statusCode && err.message) {
        return res.status(err.statusCode).json({
          success: false,
          status: err.status,
          message: err.message,
          details: err.details || [],
        });
      }

      // Handle other errors
      next(err);
    }
  }

  // Get categories by level
  async getCategoriesByLevel(req, res, next) {
    try {
      const { level } = req.params;
      const categories = await categoryService.getCategoriesByLevel(
        parseInt(level)
      );
      res.status(200).json({
        success: true,
        data: categories,
        message: "Categories by level fetched successfully",
      });
    } catch (err) {
      logger.error("Error in getCategoriesByLevel controller:", err);

      // Handle structured errors from service
      if (err.status && err.statusCode && err.message) {
        return res.status(err.statusCode).json({
          success: false,
          status: err.status,
          message: err.message,
          details: err.details || [],
        });
      }

      // Handle other errors
      next(err);
    }
  }
}

module.exports = new CategoryController();
