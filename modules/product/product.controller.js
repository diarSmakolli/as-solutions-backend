const productService = require('./product.service');
const logger = require('../../logger/logger');
const uploadToSpaces = require('../../commons/uploadToSpaces');

class ProductController {
  async createProduct(req, res, next) {
    try {
      const productData = req.body;

      // Handle file uploads if present
      if (req.files && req.files.length > 0) {
        productData.images = req.files.map((file) => ({
          buffer: file.buffer,
          originalName: file.originalname,
          altText: file.fieldname,
        }));
      }

      // Parse JSON fields from FormData
      if (productData.services && typeof productData.services === "string") {
        try {
          productData.services = JSON.parse(productData.services);
        } catch (parseError) {
          logger.error(`Error parsing services JSON: ${parseError.message}`);
          return res.status(400).json({
            status: "error",
            message: "Invalid services format",
          });
        }
      }

      if (
        productData.categories &&
        typeof productData.categories === "string"
      ) {
        try {
          productData.categories = JSON.parse(productData.categories);
        } catch (parseError) {
          logger.error(`Error parsing categories JSON: ${parseError.message}`);
          return res.status(400).json({
            status: "error",
            message: "Invalid categories format",
          });
        }
      }

      if (
        productData.custom_details &&
        typeof productData.custom_details === "string"
      ) {
        try {
          productData.custom_details = JSON.parse(productData.custom_details);
        } catch (parseError) {
          logger.error(
            `Error parsing custom_details JSON: ${parseError.message}`
          );
          return res.status(400).json({
            status: "error",
            message: "Invalid custom_details format",
          });
        }
      }

      // Parse custom options - THIS IS THE KEY FIX
      let customOptions = [];
      if (req.body.custom_options) {
        try {
          customOptions =
            typeof req.body.custom_options === "string"
              ? JSON.parse(req.body.custom_options)
              : req.body.custom_options;

          logger.info(
            `Parsed custom options: ${JSON.stringify(customOptions)}`
          );
        } catch (parseError) {
          logger.error(
            `Error parsing custom options JSON: ${parseError.message}`
          );
          return res.status(400).json({
            status: "error",
            message: "Invalid custom options format",
          });
        }
      }

      const result = await productService.createProduct(
        productData,
        customOptions // Pass custom options to service
      );

      res.status(result.statusCode).json(result);
    } catch (err) {
      logger.error(`Error in createProduct controller: ${err.message}`);
      next(err);
    }
  }

  async getAllProducts(req, res, next) {
    try {
      const params = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 10,
        search: req.query.search || "",
        status: req.query.status || "",
        is_published: req.query.is_published || "",
        is_active: req.query.is_active || "",
        company_id: req.query.company_id || "",
        category_id: req.query.category_id || "",
        sortBy: req.query.sortBy || "created_at",
        sortOrder: req.query.sortOrder || "DESC",
      };

      const result = await productService.getAllProducts(params);
      res.status(result.statusCode).json(result);
    } catch (err) {
      logger.error(`Error in getAllProducts controller: ${err.message}`);
      next(err);
    }
  }

  async getProductById(req, res, next) {
    try {
      const productId = req.params.id;
      const result = await productService.getProductById(productId);
      res.status(result.statusCode).json(result);
    } catch (error) {
      logger.error(`Error in getProductById controller: ${error.message}`);
      next(error);
    }
  }

  async editProduct(req, res, next) {
    try {
      const productId = req.params.id;
      const productData = req.body;

      // Handle file uploads if present
      if (req.files && req.files.length > 0) {
        productData.new_images = req.files.map((file) => ({
          buffer: file.buffer,
          originalName: file.originalname,
          altText: file.fieldname,
        }));
      }

      // Parse JSON fields from FormData
      if (productData.services && typeof productData.services === "string") {
        try {
          productData.services = JSON.parse(productData.services);
        } catch (parseError) {
          logger.error(`Error parsing services JSON: ${parseError.message}`);
          productData.services = [];
        }
      }

      if (
        productData.categories &&
        typeof productData.categories === "string"
      ) {
        try {
          productData.categories = JSON.parse(productData.categories);
        } catch (parseError) {
          logger.error(`Error parsing categories JSON: ${parseError.message}`);
          productData.categories = [];
        }
      }

      if (
        productData.custom_details &&
        typeof productData.custom_details === "string"
      ) {
        try {
          productData.custom_details = JSON.parse(productData.custom_details);
        } catch (parseError) {
          logger.error(
            `Error parsing custom_details JSON: ${parseError.message}`
          );
          productData.custom_details = [];
        }
      }

      // Parse existing_images if present (for image management)
      if (
        productData.existing_images &&
        typeof productData.existing_images === "string"
      ) {
        try {
          productData.existing_images = JSON.parse(productData.existing_images);
        } catch (parseError) {
          logger.error(
            `Error parsing existing_images JSON: ${parseError.message}`
          );
          productData.existing_images = [];
        }
      }

      // Parse custom options for editing - THIS IS THE KEY FIX
      let customOptions;
      if (req.body.custom_options !== undefined) {
        try {
          customOptions =
            typeof req.body.custom_options === "string"
              ? JSON.parse(req.body.custom_options)
              : req.body.custom_options;

          // Attach images to custom option values if present in req.files
          if (
            Array.isArray(customOptions) &&
            req.files &&
            req.files.length > 0
          ) {
            // Map files by fieldname or index
            const filesByIndex = {};
            req.files.forEach((file) => {
              // Accept fieldname patterns like: custom_options[0][option_values][1][image]
              let match = file.fieldname.match(
                /custom_options\[(\d+)\]\[option_values\]\[(\d+)\]\[image\]/
              );
              if (match) {
                const optionIdx = parseInt(match[1], 10);
                const valueIdx = parseInt(match[2], 10);
                if (!filesByIndex[optionIdx]) filesByIndex[optionIdx] = {};
                filesByIndex[optionIdx][valueIdx] = {
                  buffer: file.buffer,
                  originalName: file.originalname,
                  mimetype: file.mimetype,
                  size: file.size,
                };
              }
            });
            // Attach images to customOptions
            customOptions.forEach((option, optionIdx) => {
              if (option.option_values && Array.isArray(option.option_values)) {
                option.option_values.forEach((value, valueIdx) => {
                  if (
                    filesByIndex[optionIdx] &&
                    filesByIndex[optionIdx][valueIdx]
                  ) {
                    value.image = filesByIndex[optionIdx][valueIdx];
                  }
                });
              }
            });
          }

          logger.info(
            `Parsed custom options for update: ${JSON.stringify(customOptions)}`
          );
        } catch (parseError) {
          logger.error(
            `Error parsing custom options JSON: ${parseError.message}`
          );
          return res.status(400).json({
            status: "error",
            message: "Invalid custom options format",
          });
        }
      }

      const result = await productService.editProduct(
        productId,
        productData,
        customOptions // Pass custom options
      );

      res.status(result.statusCode).json(result);
    } catch (err) {
      logger.error(`Error in editProduct controller: ${err.message}`);
      next(err);
    }
  }

  async createCustomOption(req, res) {
    try {
      const { productId } = req.params;
      const customOptionData = req.body;

      if (!productId) {
        return res.status(400).json({
          status: "error",
          message: "Product ID is required",
        });
      }

      // Validate required fields
      if (!customOptionData.option_name) {
        return res.status(400).json({
          status: "error",
          message: "Option name is required",
        });
      }

      const customOption = await productService.createCustomOptions(productId, [
        customOptionData,
      ]);

      res.status(201).json({
        status: "success",
        message: "Custom option created successfully",
        data: {
          custom_option: customOption[0],
        },
      });
    } catch (error) {
      logger.error("Error in createCustomOption controller:", error);
      res.status(500).json({
        status: "error",
        message: "Failed to create custom option",
        details: error.message,
      });
    }
  }

  async getProductCustomOptions(req, res) {
    try {
      const { productId } = req.params;

      if (!productId) {
        return res.status(400).json({
          status: "error",
          message: "Product ID is required",
        });
      }

      const customOptions = await productService.getProductCustomOptions(
        productId
      );

      res.status(200).json({
        status: "success",
        message: "Custom options retrieved successfully",
        data: {
          custom_options: customOptions,
        },
      });
    } catch (error) {
      logger.error("Error in getProductCustomOptions controller:", error);
      res.status(500).json({
        status: "error",
        message: "Failed to retrieve custom options",
        details: error.message,
      });
    }
  }

  // update a custom option
  async updateCustomOption(req, res) {
    try {
      const { optionId } = req.params;
      const updateData = req.body;

      if (!optionId) {
        return res.status(400).json({
          status: "error",
          message: "Option ID is required",
        });
      }

      // Handle file uploads if present
      if (req.files && req.files.length > 0) {
        // Map uploaded files to option values by field name pattern
        const filesByFieldName = {};
        req.files.forEach((file) => {
          const fieldName = file.fieldname;
          logger.info(`Processing uploaded file: ${fieldName}`);

          // Extract the index from fieldname patterns like:
          // "option_values[0][image]" or "image_0" or similar patterns
          let match = fieldName.match(/option_values\[(\d+)\]\[image\]/);
          if (!match) {
            match = fieldName.match(/image_(\d+)/);
          }
          if (!match) {
            match = fieldName.match(/(\d+)_image/);
          }

          if (match) {
            const index = match[1];
            filesByFieldName[index] = {
              buffer: file.buffer,
              originalName: file.originalname,
              mimetype: file.mimetype,
              size: file.size,
            };
            logger.info(
              `Mapped file for option value index ${index}: ${file.originalname}`
            );
          } else {
            logger.warn(
              `Could not extract index from field name: ${fieldName}`
            );
          }
        });

        // Parse option_values if it's a string
        let optionValues = [];
        if (updateData.option_values) {
          try {
            optionValues =
              typeof updateData.option_values === "string"
                ? JSON.parse(updateData.option_values)
                : updateData.option_values;

            logger.info(`Parsed ${optionValues.length} option values`);
          } catch (parseError) {
            logger.error(`Error parsing option_values: ${parseError.message}`);
            return res.status(400).json({
              status: "error",
              message: "Invalid option_values format",
            });
          }
        }

        // Attach file data to corresponding option values
        optionValues.forEach((value, index) => {
          if (filesByFieldName[index.toString()]) {
            value.image = filesByFieldName[index.toString()];
            logger.info(
              `Attached image to option value ${index}: ${value.option_value}`
            );
          }
        });

        updateData.option_values = optionValues;
      } else {
        // Parse option_values even if no new files are uploaded
        if (
          updateData.option_values &&
          typeof updateData.option_values === "string"
        ) {
          try {
            updateData.option_values = JSON.parse(updateData.option_values);
          } catch (parseError) {
            logger.error(`Error parsing option_values: ${parseError.message}`);
            return res.status(400).json({
              status: "error",
              message: "Invalid option_values format",
            });
          }
        }
      }

      // Parse other JSON fields if they're strings
      Object.keys(updateData).forEach((key) => {
        if (
          typeof updateData[key] === "string" &&
          key !== "option_name" &&
          key !== "option_type" &&
          key !== "placeholder_text" &&
          key !== "help_text"
        ) {
          try {
            updateData[key] = JSON.parse(updateData[key]);
          } catch (parseError) {
            // If parsing fails, keep the original string value
            logger.warn(`Could not parse field ${key}: ${parseError.message}`);
          }
        }
      });

      const result = await productService.updateCustomOption(
        optionId,
        updateData
      );

      if (!result) {
        return res.status(404).json({
          status: "error",
          message: "Custom option not found",
        });
      }

      res.status(200).json({
        status: "success",
        message: "Custom option updated successfully",
        data: {
          custom_option: result,
        },
      });
    } catch (error) {
      logger.error("Error in updateCustomOption controller:", error);
      res.status(500).json({
        status: "error",
        message: "Failed to update custom option",
        details: error.message,
      });
    }
  }

  async deleteCustomOption(req, res) {
    try {
      const { optionId } = req.params;

      if (!optionId) {
        return res.status(400).json({
          status: "error",
          message: "Option ID is required",
        });
      }

      const deleted = await productService.deleteCustomOption(optionId);

      if (!deleted) {
        return res.status(404).json({
          status: "error",
          message: "Custom option not found",
        });
      }

      res.status(200).json({
        status: "success",
        message: "Custom option deleted successfully",
      });
    } catch (error) {
      logger.error("Error in deleteCustomOption controller:", error);
      res.status(500).json({
        status: "error",
        message: "Failed to delete custom option",
        details: error.message,
      });
    }
  }

  async updateCustomOptionValueImage(req, res) {
    try {
      const { optionId, valueId } = req.params;
      const file = req.file;

      if (!file) {
        return res
          .status(400)
          .json({ status: "error", message: "No image uploaded." });
      }

      const result = await productService.uploadCustomOptionValueImage(
        optionId,
        valueId,
        file
      );

      if (!result) {
        return res
          .status(404)
          .json({ status: "error", message: "Custom option value not found." });
      }

      res.status(200).json({
        status: "success",
        message: "Image uploaded successfully.",
        data: result,
      });
    } catch (error) {
      logger.error("Error in updateCustomOptionValueImage:", error);
      res.status(500).json({
        status: "error",
        message: "Failed to upload image.",
        details: error.message,
      });
    }
  }

  async duplicateProduct(req, res, next) {
    const { productId } = req.params;
    try {
      const result = await productService.duplicateProduct(productId);

      return res.status(result.statusCode).json(result);
    } catch (err) {
      logger.error(`duplicateProduct: error: ${err}, err msg: ${err.message}`);
      next(err);
    }
  }

  async publishProduct(req, res, next) {
    const { productId } = req.params;
    try {
      const result = await productService.publishProduct(productId);

      return res.status(200).json(result);
    } catch (err) {
      logger.error(`publishProduct: error: ${err}, err msg: ${err.message}`);
      next(err);
    }
  }

  async archiveProduct(req, res, next) {
    const { productId } = req.params;
    try {
      const result = await productService.archiveProduct(productId);

      return res.status(result.statusCode).json(result);
    } catch (err) {
      logger.error(`archiveProduct: error: ${err}, err msg: ${err.message}`);
      next(err);
    }
  }

  async unpublishProduct(req, res, next) {
    const { productId } = req.params;
    try {
      const result = await productService.unpublishProduct(productId);

      return res.status(result.statusCode).json(result);
    } catch (err) {
      logger.error(`unpublishProduct: error: ${err}, err msg: ${err.message}`);
      next(err);
    }
  }

  async unarchiveProduct(req, res, next) {
    const { productId } = req.params;
    try {
      const result = await productService.unarchiveProduct(productId);

      return res.status(result.statusCode).json(result);
    } catch (err) {
      logger.error(`unarchiveProduct: error: ${err}, err msg: ${err.message}`);
      next(err);
    }
  }

  // Get top new products
  async getTopNewProducts(req, res, next) {
    try {
      const params = {
        category_id: req.query.category_id || "",
        company_id: req.query.company_id || "",
        limit: parseInt(req.query.limit) || 20,
      };

      // Validate limit parameter
      if (params.limit > 50) {
        return res.status(400).json({
          status: "error",
          statusCode: 400,
          message: "Limit cannot exceed 50 products",
        });
      }

      if (params.limit < 1) {
        return res.status(400).json({
          status: "error",
          statusCode: 400,
          message: "Limit must be at least 1",
        });
      }

      const result = await productService.getTopNewProducts(params);

      return res.status(result.statusCode).json(result);
    } catch (err) {
      logger.error(`getTopNewProducts: error: ${err}, err msg: ${err.message}`);
      next(err);
    }
  }

  // Get top flash deals
  async getTopFlashDeals(req, res, next) {
    try {
      const params = {
        limit: parseInt(req.query.limit) || 15,
        min_discount: parseFloat(req.query.min_discount) || 10,
        include_expired: req.query.include_expired === "true" || false,
        category_id: req.query.category_id || "",
        company_id: req.query.company_id || "",
      };

      // Validate limit parameter
      if (params.limit > 50) {
        return res.status(400).json({
          status: "error",
          statusCode: 400,
          message: "Limit cannot exceed 50 products",
        });
      }

      if (params.limit < 1) {
        return res.status(400).json({
          status: "error",
          statusCode: 400,
          message: "Limit must be at least 1",
        });
      }

      // Validate min_discount parameter
      if (params.min_discount < 0 || params.min_discount > 100) {
        return res.status(400).json({
          status: "error",
          statusCode: 400,
          message: "Minimum discount must be between 0 and 100",
        });
      }

      const result = await productService.getTopFlashDeals(params);

      return res.status(result.statusCode).json(result);
    } catch (err) {
      logger.error(`getTopFlashDeals: error: ${err}, err msg: ${err.message}`);
      next(err);
    }
  }

  // get explore all products with filters
  async getExploreAllProducts(req, res, next) {
    try {
      const params = {
        limit: parseInt(req.query.limit) || 40,
        offset: parseInt(req.query.offset) || 0,
        search: req.query.search || "",
        category_id: req.query.category_id || "",
        company_id: req.query.company_id || "",
        min_price: req.query.min_price || "",
        max_price: req.query.max_price || "",
        sort_by: req.query.sort_by || "created_at",
        sort_order: req.query.sort_order || "DESC",
        is_on_sale: req.query.is_on_sale || "",
        free_shipping: req.query.free_shipping || "",
        is_featured: req.query.is_featured || "",
        is_new: req.query.is_new || "",
      };

      // Validate limit parameter
      if (params.limit > 100) {
        return res.status(400).json({
          status: "error",
          statusCode: 400,
          message: "Limit cannot exceed 100 products per request",
        });
      }

      if (params.limit < 1) {
        return res.status(400).json({
          status: "error",
          statusCode: 400,
          message: "Limit must be at least 1",
        });
      }

      // Validate offset parameter
      if (params.offset < 0) {
        return res.status(400).json({
          status: "error",
          statusCode: 400,
          message: "Offset cannot be negative",
        });
      }

      // Validate price range
      if (params.min_price && params.max_price) {
        const minPrice = parseFloat(params.min_price);
        const maxPrice = parseFloat(params.max_price);

        if (minPrice > maxPrice) {
          return res.status(400).json({
            status: "error",
            statusCode: 400,
            message: "Minimum price cannot be greater than maximum price",
          });
        }
      }

      const result = await productService.getExploreAllProducts(params);

      return res.status(result.statusCode).json(result);
    } catch (err) {
      logger.error(
        `getExploreAllProducts: error: ${err}, err msg: ${err.message}`
      );
      next(err);
    }
  }

  // Get product details for customers (public endpoint)
  async getProductDetails(req, res, next) {
    try {
      const { slug } = req.params;

      if (!slug) {
        return res.status(400).json({
          status: "error",
          message: "Product slug is required",
        });
      }

      const result = await productService.getProductDetails(slug);
      res.status(200).json(result);
    } catch (error) {
      logger.error(`Error in getProductDetails: ${error.message}`);
      res.status(error.statusCode || 500).json({
        status: "error",
        message: error.message || "Failed to retrieve product details",
        error: error.error || error.message,
      });
    }
  }

  // Get recommended products for a specific product
  async getRecommendedProducts(req, res, next) {
    try {
      const { slug } = req.params;
      const params = {
        limit: parseInt(req.query.limit) || 8,
        exclude_out_of_stock: req.query.exclude_out_of_stock !== "false", // Default to true
      };

      if (!slug) {
        return res.status(400).json({
          status: "error",
          message: "Product slug is required",
        });
      }

      // Validate limit parameter
      if (params.limit > 20) {
        return res.status(400).json({
          status: "error",
          statusCode: 400,
          message: "Limit cannot exceed 20 products",
        });
      }

      if (params.limit < 1) {
        return res.status(400).json({
          status: "error",
          statusCode: 400,
          message: "Limit must be at least 1",
        });
      }

      const result = await productService.getRecommendedProducts(slug, params);

      return res.status(result.statusCode).json(result);
    } catch (err) {
      logger.error(
        `getRecommendedProducts: error: ${err}, err msg: ${err.message}`
      );
      next(err);
    }
  }

  async searchProducts(req, res, next) {
    try {
      const params = {
        query: req.query.q || req.query.query || "",
        limit: parseInt(req.query.limit) || 25,
        offset: parseInt(req.query.offset) || 0,
        sort_by: req.query.sort_by || "relevance",
        sort_order: req.query.sort_order || "DESC",
        min_price: req.query.min_price || "",
        max_price: req.query.max_price || "",
        include_out_of_stock: req.query.include_out_of_stock === "true",
        filters: req.query.filters || "{}", // Parse JSON filters
      };

      // Validate limit
      if (params.limit > 100) {
        return res.status(400).json({
          status: "error",
          statusCode: 400,
          message: "Limit cannot exceed 100 products per request",
        });
      }

      if (params.limit < 1) {
        return res.status(400).json({
          status: "error",
          statusCode: 400,
          message: "Limit must be at least 1",
        });
      }

      // Validate offset
      if (params.offset < 0) {
        return res.status(400).json({
          status: "error",
          statusCode: 400,
          message: "Offset cannot be negative",
        });
      }

      const result = await productService.searchProducts(params);

      return res.status(result.statusCode).json(result);
    } catch (err) {
      logger.error(`searchProducts: error: ${err}, err msg: ${err.message}`);
      next(err);
    }
  }

  // Get products by category with filters and facets
  async getProductsByCategory(req, res, next) {
    try {
      const { categoryId } = req.params;
      const params = {
        limit: parseInt(req.query.limit) || 25,
        offset: parseInt(req.query.offset) || 0,
        sort_by: req.query.sort_by || "relevance",
        sort_order: req.query.sort_order || "DESC",
        min_price: req.query.min_price || "",
        max_price: req.query.max_price || "",
        include_out_of_stock: req.query.include_out_of_stock === "true",
        filters: req.query.filters || "{}", // Parse JSON filters
      };

      // Validate category ID
      if (!categoryId) {
        return res.status(400).json({
          status: "error",
          statusCode: 400,
          message: "Category ID is required",
        });
      }

      // Validate limit
      if (params.limit > 100) {
        return res.status(400).json({
          status: "error",
          statusCode: 400,
          message: "Limit cannot exceed 100 products per request",
        });
      }

      if (params.limit < 1) {
        return res.status(400).json({
          status: "error",
          statusCode: 400,
          message: "Limit must be at least 1",
        });
      }

      // Validate offset
      if (params.offset < 0) {
        return res.status(400).json({
          status: "error",
          statusCode: 400,
          message: "Offset cannot be negative",
        });
      }

      // Validate price range
      if (params.min_price && params.max_price) {
        const minPrice = parseFloat(params.min_price);
        const maxPrice = parseFloat(params.max_price);

        if (!isNaN(minPrice) && !isNaN(maxPrice) && minPrice > maxPrice) {
          return res.status(400).json({
            status: "error",
            statusCode: 400,
            message: "Minimum price cannot be greater than maximum price",
          });
        }
      }

      // Validate sort_by parameter
      const validSortOptions = [
        "relevance",
        "price_low_high",
        "price_high_low",
        "name_a_z",
        "name_z_a",
        "newest",
      ];
      if (!validSortOptions.includes(params.sort_by)) {
        return res.status(400).json({
          status: "error",
          statusCode: 400,
          message: `Invalid sort_by parameter. Valid options: ${validSortOptions.join(
            ", "
          )}`,
        });
      }

      const result = await productService.getProductsByCategory(
        categoryId,
        params
      );

      return res.status(result.statusCode).json(result);
    } catch (err) {
      logger.error(
        `getProductsByCategory: error: ${err}, err msg: ${err.message}`
      );
      next(err);
    }
  }

  // Get flash deals with advanced filters
  async getFlashDeals(req, res, next) {
    try {
      const params = {
        limit: parseInt(req.query.limit) || 25,
        offset: parseInt(req.query.offset) || 0,
        sort_by: req.query.sort_by || "discount_percentage",
        sort_order: req.query.sort_order || "DESC",
        min_price: req.query.min_price || "",
        max_price: req.query.max_price || "",
        min_discount: parseFloat(req.query.min_discount) || 10,
        max_discount: req.query.max_discount || "",
        include_out_of_stock: req.query.include_out_of_stock === "true",
        category_id: req.query.category_id || "",
        filters: req.query.filters || "{}", // Parse JSON filters
      };

      // Validate limit
      if (params.limit > 100) {
        return res.status(400).json({
          status: "error",
          statusCode: 400,
          message: "Limit cannot exceed 100 products per request",
        });
      }

      if (params.limit < 1) {
        return res.status(400).json({
          status: "error",
          statusCode: 400,
          message: "Limit must be at least 1",
        });
      }

      // Validate offset
      if (params.offset < 0) {
        return res.status(400).json({
          status: "error",
          statusCode: 400,
          message: "Offset cannot be negative",
        });
      }

      // Validate discount parameters
      if (params.min_discount < 0 || params.min_discount > 100) {
        return res.status(400).json({
          status: "error",
          statusCode: 400,
          message: "Minimum discount must be between 0 and 100",
        });
      }

      if (
        params.max_discount &&
        (parseFloat(params.max_discount) < 0 ||
          parseFloat(params.max_discount) > 100)
      ) {
        return res.status(400).json({
          status: "error",
          statusCode: 400,
          message: "Maximum discount must be between 0 and 100",
        });
      }

      if (
        params.max_discount &&
        parseFloat(params.max_discount) < params.min_discount
      ) {
        return res.status(400).json({
          status: "error",
          statusCode: 400,
          message: "Maximum discount cannot be less than minimum discount",
        });
      }

      // Validate price range
      if (params.min_price && params.max_price) {
        const minPrice = parseFloat(params.min_price);
        const maxPrice = parseFloat(params.max_price);

        if (!isNaN(minPrice) && !isNaN(maxPrice) && minPrice > maxPrice) {
          return res.status(400).json({
            status: "error",
            statusCode: 400,
            message: "Minimum price cannot be greater than maximum price",
          });
        }
      }

      // Validate sort_by parameter
      const validSortOptions = [
        "discount_percentage",
        "discount_high_low",
        "discount_low_high",
        "savings_high_low",
        "savings_low_high",
        "price_low_high",
        "price_high_low",
        "name_a_z",
        "name_z_a",
        "newest",
        "urgency",
        "popularity",
      ];

      if (!validSortOptions.includes(params.sort_by)) {
        return res.status(400).json({
          status: "error",
          statusCode: 400,
          message: `Invalid sort_by parameter. Valid options: ${validSortOptions.join(
            ", "
          )}`,
        });
      }

      const result = await productService.getFlashDeals(params);

      return res.status(result.statusCode).json(result);
    } catch (err) {
      logger.error(`getFlashDeals: error: ${err}, err msg: ${err.message}`);
      next(err);
    }
  }

  
};

module.exports = new ProductController();