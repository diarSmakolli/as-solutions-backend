const {
  Product,
  ProductCategory,
  Category,
  Administration,
  Company,
  Warehouse,
  Tax,
  ProductService,
  Activity,
  ProductCustomOption,
  ProductCustomOptionValue,
  sequelize,
} = require("../../configurations/associations");
const logger = require("../../logger/logger");
const { Op } = require("sequelize");
const uploadToSpaces = require("../../commons/uploadToSpaces");
const { v4: uuidv4 } = require("uuid");

class ProductServiceLayer {
  constructor() {
    this.logger = logger;
  }

  // ************ VALIDATION METHODS ************

  // request failed
  _requestFailure() {
    throw {
      status: "error",
      statusCode: 400,
      message: "Invalid request.",
    };
  }

  // is valid uuid
  _isValidUUID(uuid) {
    const regex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return regex.test(uuid);
  }

  // validate required field
  _validateRequiredField(field, fieldName) {
    if (
      !field ||
      field === null ||
      field === undefined ||
      (typeof field === "string" && field.trim() === "")
    ) {
      throw {
        status: "error",
        statusCode: 400,
        message: `${fieldName} is required.`,
      };
    }
  }

  // validate numeric fieldss
  _validateNumericField(value, fieldName, minValue = null) {
    if (value === undefined || value === null) {
      throw {
        status: "error",
        statusCode: 400,
        message: `${fieldName} is required.`,
      };
    }

    if (isNaN(value)) {
      throw {
        status: "error",
        statusCode: 400,
        message: `${fieldName} must be a valid number.`,
      };
    }

    if (minValue != null && value < minValue) {
      throw {
        status: "error",
        statusCode: 400,
        message: `${fieldName} must be greater than or equal to ${minValue}.`,
      };
    }
  }

  // generate slug
  async _generateSlug(text, excludeId = null, checkTable = "products") {
    if (!text || typeof text !== "string" || text.trim() === "") {
      throw {
        status: "error",
        statusCode: 400,
        message: "Invalid text for slug generation.",
      };
    }

    let baseSlug = text
      .toLowerCase()
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s.-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/\.+/g, ".")
      .replace(/-+/g, "-")
      .replace(/^[-.]|[-.]$/g, "");

    if (!baseSlug || baseSlug.length === 0) {
      throw {
        status: "error",
        statusCode: 400,
        message: "Generated slug is empty.",
      };
    }

    let finalSlug = baseSlug;
    let counter = 1;

    while (counter <= 100) {
      const whereCondition = { slug: finalSlug };

      if (excludeId) {
        whereCondition.id = { [Op.ne]: excludeId };
      }

      let existingRecord;

      // Check the appropriate table based on context
      if (checkTable === "services") {
        existingRecord = await ProductService.findOne({
          where: whereCondition,
          attributes: ["id"],
        });
      } else {
        // Default to products table
        existingRecord = await Product.findOne({
          where: whereCondition,
          attributes: ["id"],
        });
      }

      if (!existingRecord) {
        return finalSlug;
      }

      finalSlug = `${baseSlug}-${counter}`;
      counter++;
    }

    return `${baseSlug}-${Date.now()}`;
  }

  // generate standar EAN code of product
  _generateEAN13() {
    // Generate a proper EAN-13 code
    const countryCode = "370"; // France, for example
    const companyCode = Math.floor(Math.random() * 100000)
      .toString()
      .padStart(5, "0");
    const productCode = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, "0");

    // Calculate check digit for EAN-13
    const digits = `${countryCode}${companyCode}${productCode}`;
    let sum = 0;
    for (let i = 0; i < digits.length; i++) {
      const digit = parseInt(digits[i]);
      sum += i % 2 === 0 ? digit : digit * 3;
    }
    const checkDigit = (10 - (sum % 10)) % 10;

    return `${digits}${checkDigit}`;
  }

  // generate SKU unique code of our system
  _generatedSKU() {
    const min = 10000000;
    const max = 99999999;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  // generate unique SKU
  async _generateUniqueSKU(excludeId = null) {
    let attempts = 0;
    const maxAttempts = 50;

    while (attempts < maxAttempts) {
      const generatedSKU = this._generatedSKU().toString();

      const whereCondition = { sku: generatedSKU };

      if (excludeId) {
        whereCondition.id = { [Op.ne]: excludeId };
      }

      const existingProduct = await Product.findOne({
        where: whereCondition,
        attributes: ["id"],
      });

      if (!existingProduct) {
        return generatedSKU;
      }

      attempts++;
    }

    const timestamp = Date.now().toString().slice(-8);
    return timestamp;
  }

  // generate custom details ( key automatically)
  _processCustomDetails(customDetails = []) {
    if (!Array.isArray(customDetails)) {
      return [];
    }

    return customDetails.map((detail, index) => {
      // If detail already has a key, keep it
      if (detail.key && detail.key.trim()) {
        return {
          key: detail.key.trim(),
          label: detail.label || detail.key.trim(),
          value: detail.value || "",
        };
      }

      // Auto-generate key from label or value
      let autoKey = "";

      // Try to generate from label first
      if (detail.label && typeof detail.label === "string") {
        autoKey = detail.label
          .toLowerCase()
          .trim()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9\s]/g, "")
          .replace(/\s+/g, "_")
          .substring(0, 50);
      }

      // If no label, try to generate from value
      if (!autoKey && detail.value && typeof detail.value === "string") {
        autoKey = detail.value
          .toLowerCase()
          .trim()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9\s]/g, "")
          .replace(/\s+/g, "_")
          .substring(0, 50);
      }

      // Fallback to generic key if auto-generation fails
      if (!autoKey || autoKey.length < 2) {
        autoKey = `custom_field_${index + 1}`;
      }

      return {
        key: autoKey,
        label:
          detail.label ||
          autoKey.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
        value: detail.value || "",
      };
    });
  }

  // ************************************************************************************************************************

  // Services of Product module

  // ************************************************************************************************************************

  // Create a product service - REFACTORED
  async createProduct(productData, customOptions = []) {
    try {
      // Validate Required Fields
      this._validateRequiredField(productData.title, "Title");
      this._validateRequiredField(productData.description, "Description");
      this._validateRequiredField(productData.weight, "Weight");
      this._validateRequiredField(productData.weight_unit, "Weight Unit");
      this._validateRequiredField(productData.measures_unit, "Measures Unit");
      this._validateRequiredField(productData.unit_type, "Unit Type");
      this._validateRequiredField(
        productData.purchase_price_nett,
        "Purchase Price Nett"
      );
      this._validateRequiredField(
        productData.regular_price_nett,
        "Regular Price Nett"
      );
      this._validateRequiredField(productData.tax_id, "Tax");

      // Validate Numeric fields
      this._validateNumericField(productData.weight, "Weight", 0);
      this._validateNumericField(
        productData.purchase_price_nett,
        "Purchase Price Nett",
        0
      );
      this._validateNumericField(
        productData.regular_price_nett,
        "Regular Price Nett",
        0
      );

      // Generate Slug
      const slugSource = productData.slug || productData.title;
      const generatedSlug = await this._generateSlug(slugSource);

      if (!this._isValidUUID(productData.tax_id)) {
        this._requestFailure();
      }

      if (!this._isValidUUID(productData.company_id)) {
        productData.company_id = null;
      }

      if (!this._isValidUUID(productData.supplier_id)) {
        productData.supplier_id = null;
      }

      // Validate Optional Numeric Fields
      if (productData.width !== undefined && productData.width !== null) {
        this._validateNumericField(productData.width, "Width", 0);
      }

      if (productData.height !== undefined && productData.height !== null) {
        this._validateNumericField(productData.height, "Height", 0);
      }

      if (
        productData.thickness !== undefined &&
        productData.thickness !== null
      ) {
        this._validateNumericField(productData.thickness, "Thickness", 0);
      }

      if (productData.depth !== undefined && productData.depth !== null) {
        this._validateNumericField(productData.depth, "Depth", 0);
      }

      if (
        productData.lead_time !== undefined &&
        productData.lead_time !== null
      ) {
        this._validateNumericField(productData.lead_time, "Lead Time", 0);
      }

      // Generate unique values
      let generatedEAN = productData.ean || this._generateEAN13();
      let generatedSKU = productData.sku || (await this._generateUniqueSKU());
      let generatedBarcode = productData.barcode || generatedSKU;

      // Validate Unique Fields
      const existingProduct = await Product.findOne({
        where: {
          [Op.or]: [
            { sku: generatedSKU },
            { slug: generatedSlug },
            { barcode: generatedBarcode },
            { title: productData.title },
            { ean: generatedEAN },
          ],
        },
      });

      if (existingProduct) {
        throw {
          status: "error",
          statusCode: 400,
          message:
            "Product with the same SKU, Slug, Barcode, Title or EAN already exists.",
        };
      }

      // Validate company
      let company;
      if (
        productData.company_id !== null &&
        this._isValidUUID(productData.company_id)
      ) {
        company = await Company.findOne({
          where: {
            id: productData.company_id,
            is_inactive: false,
          },
        });

        if (!company) {
          throw {
            status: "error",
            statusCode: 404,
            message:
              "Company not found in our records or is not active company anymore.",
          };
        }
      }

      // Validate supplier
      let supplier;
      if (
        productData.supplier_id !== null &&
        this._isValidUUID(productData.supplier_id)
      ) {
        supplier = await Company.findOne({
          where: {
            id: productData.supplier_id,
            is_inactive: false,
          },
        });

        if (!supplier) {
          throw {
            status: "error",
            statusCode: 404,
            message:
              "Supplier not found in our records or is not active company anymore.",
          };
        }
      }

      // Validate tax
      const tax = await Tax.findOne({
        where: {
          id: productData.tax_id,
          is_inactive: false,
        },
      });

      if (!tax) {
        throw {
          status: "error",
          statusCode: 404,
          message: "Tax not found in our records or is inactive tax.",
        };
      }

      // Calculate gross prices
      let taxRate = parseFloat(tax.rate) || 0.0;
      let taxMultiplier = 1 + taxRate / 100;

      let calculatedPurchasePriceGross = parseFloat(
        (productData.purchase_price_nett * taxMultiplier).toFixed(2)
      );

      let calculatedRegularPriceGross = parseFloat(
        (productData.regular_price_nett * taxMultiplier).toFixed(2)
      );

      // Handle image uploads
      let uploadedImages = [];
      let mainImageUrl = "";

      if (
        productData.images &&
        Array.isArray(productData.images) &&
        productData.images.length > 0
      ) {
        for (let i = 0; i < productData.images.length; i++) {
          const imageData = productData.images[i];

          if (imageData.buffer && imageData.originalName) {
            try {
              const imageUrl = await uploadToSpaces(
                imageData.buffer,
                imageData.originalName,
                "products",
                "public-read"
              );

              const imageInfo = {
                id: uuidv4(),
                url: imageUrl,
                alt_text: imageData.altText || productData.title,
                order: i + 1,
                is_main: i === 0,
                width: imageData.width || null,
                height: imageData.height || null,
                size_bytes: imageData.buffer.length,
                file_name: imageData.originalName,
                created_at: new Date(),
              };

              uploadedImages.push(imageInfo);

              if (i === 0) {
                mainImageUrl = imageUrl;
              }
            } catch (uploadError) {
              this.logger.error(
                `Error uploading image ${i}: ${uploadError.message}`
              );
              throw {
                status: "error",
                statusCode: 500,
                message: `Failed to upload image: ${imageData.originalName}`,
              };
            }
          }
        }
      }

      if (!mainImageUrl && productData.main_image_url) {
        mainImageUrl = productData.main_image_url;
      }

      if (!mainImageUrl) {
        throw {
          status: "error",
          statusCode: 400,
          message: "At least one image is required.",
        };
      }

      // Calculate final prices (considering discounts)
      let finalPriceNett = productData.regular_price_nett;
      let finalPriceGross = calculatedRegularPriceGross;
      let isDiscounted = false;

      if (
        productData.discount_percentage_nett &&
        productData.discount_percentage_nett > 0
      ) {
        isDiscounted = true;
        finalPriceNett =
          productData.regular_price_nett *
          (1 - productData.discount_percentage_nett / 100);
        finalPriceGross = finalPriceNett * taxMultiplier;
      }

      // Create the product
      const newProduct = await Product.create({
        sku: generatedSKU,
        slug: generatedSlug,
        title: productData.title,
        description: productData.description,
        short_description: productData.short_description || null,
        barcode: generatedBarcode,
        ean: generatedEAN,
        status: productData.status || "active",
        is_active:
          productData.is_active !== undefined ? productData.is_active : true,
        is_available_on_stock:
          productData.is_available_on_stock !== undefined
            ? productData.is_available_on_stock
            : true,
        shipping_free: productData.shipping_free || false,
        mark_as_top_seller: productData.mark_as_top_seller || false,
        mark_as_new: productData.mark_as_new || false,
        mark_as_featured: productData.mark_as_featured || false,
        is_published: productData.is_published || false,
        is_digital: productData.is_digital || false,
        is_physical:
          productData.is_physical !== undefined
            ? productData.is_physical
            : true,
        is_on_sale: productData.is_on_sale || false,
        is_delivery_only:
          productData.is_delivery_only !== undefined
            ? productData.is_delivery_only
            : true,
        is_special_offer: productData.is_special_offer || false,
        weight: productData.weight,
        weight_unit: productData.weight_unit,
        measures_unit: productData.measures_unit,
        unit_type: productData.unit_type,
        width: productData.width || null,
        height: productData.height || null,
        length: productData.length || null,
        thickness: productData.thickness || null,
        depth: productData.depth || null,
        lead_time: productData.lead_time || 5,
        meta_title: productData.meta_title || null,
        meta_description: productData.meta_description || null,
        meta_keywords: productData.meta_keywords || null,
        purchase_price_nett: productData.purchase_price_nett,
        purchase_price_gross: calculatedPurchasePriceGross,
        regular_price_nett: productData.regular_price_nett,
        regular_price_gross: calculatedRegularPriceGross,
        is_discounted: isDiscounted,
        discount_percentage_nett: productData.discount_percentage_nett || 0,
        discount_percentage_gross: productData.discount_percentage_gross || 0,
        final_price_nett: parseFloat(finalPriceNett),
        final_price_gross: parseFloat(finalPriceGross),
        // custom_details: productData.custom_details || [],
        custom_details: this._processCustomDetails(productData.custom_details),
        images: uploadedImages,
        main_image_url: mainImageUrl,
        supplier_id: productData.supplier_id,
        tax_id: productData.tax_id,
        company_id: productData.company_id,
        created_at: new Date(),
        updated_at: new Date(),
      });

      // Handle product services
      if (
        productData.services &&
        Array.isArray(productData.services) &&
        productData.services.length > 0
      ) {
        this.logger.info(
          `Creating ${productData.services.length} services for product ${newProduct.id}`
        );

        for (const serviceData of productData.services) {
          try {
            await this._createProductService(newProduct.id, serviceData);
            this.logger.info(
              `Service "${serviceData.title}" created successfully`
            );
          } catch (serviceError) {
            this.logger.error(
              `Error creating service "${serviceData.title}": ${serviceError.message}`
            );
            throw serviceError;
          }
        }

        await newProduct.update({ has_services: true });
        this.logger.info(`Product ${newProduct.id} marked as having services`);
      } else {
        this.logger.info(`No services provided for product ${newProduct.id}`);
      }

      // Handle category assignments
      if (
        productData.categories &&
        Array.isArray(productData.categories) &&
        productData.categories.length > 0
      ) {
        await this._assignCategoriesToProduct(
          newProduct.id,
          productData.categories
        );
      }

      // Create custom options if provided
      if (
        customOptions &&
        Array.isArray(customOptions) &&
        customOptions.length > 0
      ) {
        this.logger.info(
          `Creating ${customOptions.length} custom options for product ${newProduct.id}`
        );
        await this.createCustomOptions(newProduct.id, customOptions);
      }

      this.logger.info(
        `Product created successfully with ID: ${newProduct.id}`
      );

      // Return lightweight response without heavy associations
      return {
        status: "success",
        statusCode: 201,
        message: "Product created successfully.",
        data: {
          id: newProduct.id,
          sku: newProduct.sku,
          slug: newProduct.slug,
          title: newProduct.title,
          description: newProduct.description,
          barcode: newProduct.barcode,
          ean: newProduct.ean,
          main_image_url: newProduct.main_image_url,
          images: newProduct.images,
          final_price_nett: newProduct.final_price_nett,
          final_price_gross: newProduct.final_price_gross,
          is_discounted: newProduct.is_discounted,
          discount_percentage_nett: newProduct.discount_percentage_nett,
          has_services: newProduct.has_services,
          is_published: newProduct.is_published,
          is_active: newProduct.is_active,
          created_at: newProduct.created_at,
          services_count: productData.services
            ? productData.services.length
            : 0,
          categories_count: productData.categories
            ? productData.categories.length
            : 0,
          custom_options_count: customOptions ? customOptions.length : 0,
        },
      };
    } catch (err) {
      this.logger.error(`Error creating product: ${err.message}`);
      this.logger.error(`Stack trace: ${err.stack}`);
      throw err;
    }
  }

  // edit product method.
  async editProduct(productId, productData, customOptions) {
    try {
      this._validateRequiredField(productId, "Product ID");

      if (!this._isValidUUID(productId)) {
        throw {
          status: "error",
          statusCode: 400,
          message: "Invalid product ID format.",
        };
      }

      // Check if product exists
      const existingProduct = await Product.findByPk(productId);

      if (!existingProduct) {
        return {
          status: "error",
          statusCode: 404,
          message: "Product not found in our records.",
        };
      }

      // Validate basic fields if provided
      if (productData.title && !productData.title.trim()) {
        throw {
          status: "error",
          statusCode: 400,
          message: "Product title cannot be empty.",
        };
      }

      if (productData.weight !== undefined && productData.weight !== null) {
        this._validateNumericField(productData.weight, "Weight", 0);
      }

      if (
        productData.purchase_price_nett !== undefined &&
        productData.purchase_price_nett !== null
      ) {
        this._validateNumericField(
          productData.purchase_price_nett,
          "Purchase Price Nett",
          0
        );
      }

      if (
        productData.regular_price_nett !== undefined &&
        productData.regular_price_nett !== null
      ) {
        this._validateNumericField(
          productData.regular_price_nett,
          "Regular Price Nett",
          0
        );
      }

      // Validate and handle tax if provided
      let tax = null;
      if (productData.tax_id && this._isValidUUID(productData.tax_id)) {
        tax = await Tax.findOne({
          where: {
            id: productData.tax_id,
            is_inactive: false,
          },
        });

        if (!tax) {
          throw {
            status: "error",
            statusCode: 404,
            message: "Tax not found in our records or is inactive.",
          };
        }
      }

      // Validate company and supplier if provided
      if (productData.company_id && this._isValidUUID(productData.company_id)) {
        const company = await Company.findOne({
          where: {
            id: productData.company_id,
            is_inactive: false,
          },
        });

        if (!company) {
          throw {
            status: "error",
            statusCode: 404,
            message: "Company not found in our records or is inactive.",
          };
        }
      }

      if (
        productData.supplier_id &&
        this._isValidUUID(productData.supplier_id)
      ) {
        const supplier = await Company.findOne({
          where: {
            id: productData.supplier_id,
            is_inactive: false,
          },
        });

        if (!supplier) {
          throw {
            status: "error",
            statusCode: 404,
            message: "Supplier not found or is inactive.",
          };
        }
      }

      // Handle unique field validation if they're being updated
      if (
        productData.title ||
        productData.sku ||
        productData.slug ||
        productData.barcode ||
        productData.ean
      ) {
        const whereConditions = [];

        if (productData.title)
          whereConditions.push({ title: productData.title });
        if (productData.sku) whereConditions.push({ sku: productData.sku });
        if (productData.slug) whereConditions.push({ slug: productData.slug });
        if (productData.barcode)
          whereConditions.push({ barcode: productData.barcode });
        if (productData.ean) whereConditions.push({ ean: productData.ean });

        if (whereConditions.length > 0) {
          const conflictingProduct = await Product.findOne({
            where: {
              [Op.and]: [
                { id: { [Op.ne]: productId } },
                { [Op.or]: whereConditions },
              ],
            },
          });

          if (conflictingProduct) {
            throw {
              status: "error",
              statusCode: 400,
              message:
                "Another product with the same title, SKU, slug, barcode, or EAN already exists.",
            };
          }
        }
      }

      // Generate slug if title is being updated
      let generatedSlug = null;

      if (productData.title && productData.title !== existingProduct.title) {
        generatedSlug = await this._generateSlug(productData.title, productId);
      }

      // Handle image updates
      let updatedImages = [...(existingProduct.images || [])];
      let mainImageUrl = existingProduct.main_image_url;

      // Process existing images (handle deletions and reordering)
      if (
        productData.existing_images &&
        Array.isArray(productData.existing_images)
      ) {
        updatedImages = productData.existing_images;
        if (updatedImages.length > 0) {
          mainImageUrl = updatedImages[0].url;
        }
      }

      // Add new images if provided
      if (
        productData.newImages &&
        Array.isArray(productData.newImages) &&
        productData.newImages.length > 0
      ) {
        for (let i = 0; i < productData.newImages.length; i++) {
          const imageData = productData.newImages[i];

          if (imageData.buffer && imageData.originalName) {
            try {
              const imageUrl = await uploadToSpaces(
                imageData.buffer,
                imageData.originalName,
                "products",
                "public-read"
              );

              const imageInfo = {
                id: uuidv4(),
                url: imageUrl,
                alt_text: imageData.altText || existingProduct.title,
                order: updatedImages.length + i + 1,
                is_main: updatedImages.length === 0 && i === 0,
                width: imageData.width || null,
                height: imageData.height || null,
                size_bytes: imageData.buffer.length,
                file_name: imageData.originalName,
                created_at: new Date(),
              };

              updatedImages.push(imageInfo);

              if (updatedImages.length === 1) {
                mainImageUrl = imageUrl;
              }
            } catch (uploadError) {
              this.logger.error(
                `Error uploading image ${i}: ${uploadError.message}`
              );
              throw {
                status: "error",
                statusCode: 500,
                message: `Failed to upload image: ${imageData.originalName}`,
              };
            }
          }
        }
      }

      // Calculate prices if relevant fields are being updated
      let calculatedPurchasePriceGross = existingProduct.purchase_price_gross;
      let calculatedRegularPriceGross = existingProduct.regular_price_gross;
      let finalPriceNett = existingProduct.final_price_nett;
      let finalPriceGross = existingProduct.final_price_gross;
      let isDiscounted = existingProduct.is_discounted;

      const taxToUse = tax || (await Tax.findByPk(existingProduct.tax_id));
      const taxRate = parseFloat(taxToUse?.rate || 0);
      const taxMultiplier = 1 + taxRate / 100;

      if (productData.purchase_price_nett !== undefined) {
        calculatedPurchasePriceGross = parseFloat(
          (productData.purchase_price_nett * taxMultiplier).toFixed(2)
        );
      }

      if (productData.regular_price_nett !== undefined) {
        calculatedRegularPriceGross = parseFloat(
          (productData.regular_price_nett * taxMultiplier).toFixed(2)
        );
        finalPriceNett = productData.regular_price_nett;
        finalPriceGross = calculatedRegularPriceGross;
      }

      // Handle discount
      const discountPercentage =
        productData.discount_percentage_nett !== undefined
          ? productData.discount_percentage_nett
          : existingProduct.discount_percentage_nett;

      if (discountPercentage && discountPercentage > 0) {
        isDiscounted = true;
        const basePrice =
          productData.regular_price_nett !== undefined
            ? productData.regular_price_nett
            : existingProduct.regular_price_nett;
        finalPriceNett = basePrice * (1 - discountPercentage / 100);
        finalPriceGross = finalPriceNett * taxMultiplier;
      } else {
        isDiscounted = false;
      }

      // Prepare update data
      const updateData = {
        ...productData,
        slug: generatedSlug || existingProduct.slug,
        purchase_price_gross: calculatedPurchasePriceGross,
        regular_price_gross: calculatedRegularPriceGross,
        final_price_nett: parseFloat(finalPriceNett),
        final_price_gross: parseFloat(finalPriceGross),
        is_discounted: isDiscounted,
        custom_details:
          productData.custom_details !== undefined
            ? this._processCustomDetails(productData.custom_details)
            : existingProduct.custom_details,
        images: updatedImages,
        main_image_url: mainImageUrl,
        updated_at: new Date(),
      };

      // Remove fields that shouldn't be directly updated
      delete updateData.newImages;
      delete updateData.existing_images;
      delete updateData.services;
      delete updateData.categories;

      // Update the product
      await existingProduct.update(updateData);

      // Handle product services
      if (productData.services !== undefined) {
        // Remove existing services
        await ProductService.destroy({
          where: { product_id: productId },
        });

        // Add new services
        if (
          Array.isArray(productData.services) &&
          productData.services.length > 0
        ) {
          for (const serviceData of productData.services) {
            try {
              await this._createProductService(productId, serviceData);
            } catch (serviceError) {
              this.logger.error(
                `Error creating service "${serviceData.title}": ${serviceError.message}`
              );
              throw serviceError;
            }
          }

          await existingProduct.update({ has_services: true });
        } else {
          await existingProduct.update({ has_services: false });
        }
      }

      // Handle categories
      if (productData.categories !== undefined) {
        // Remove existing category associations
        await ProductCategory.destroy({
          where: { product_id: productId },
        });

        // Add new category associations
        if (
          Array.isArray(productData.categories) &&
          productData.categories.length > 0
        ) {
          await this._assignCategoriesToProduct(
            productId,
            productData.categories
          );
        }
      }

      // Handle custom options update - THIS IS CRUCIAL
      // if (customOptions !== undefined) {
      //   this.logger.info(`Updating custom options for product ${productId}`);
      //   await this.updateCustomOptions(productId, customOptions);
      // }

      if (customOptions !== undefined) {
        this.logger.info(`Updating custom options for product ${productId}`);

        // Process custom options to handle image uploads properly
        if (Array.isArray(customOptions)) {
          for (
            let optionIndex = 0;
            optionIndex < customOptions.length;
            optionIndex++
          ) {
            const option = customOptions[optionIndex];

            if (option.option_values && Array.isArray(option.option_values)) {
              for (
                let valueIndex = 0;
                valueIndex < option.option_values.length;
                valueIndex++
              ) {
                const value = option.option_values[valueIndex];

                // Handle image data from the request
                // The image might come from the files array processed in the controller
                if (
                  value.image &&
                  typeof value.image === "object" &&
                  value.image.buffer
                ) {
                  // Image is properly structured with buffer - keep as is
                  this.logger.info(
                    `Found image buffer for option ${optionIndex}, value ${valueIndex}`
                  );
                } else if (
                  value.image_url &&
                  value.image_url.startsWith("http")
                ) {
                  // Existing image URL - preserve it
                  this.logger.info(
                    `Preserving existing image URL for option ${optionIndex}, value ${valueIndex}`
                  );
                }
              }
            }
          }
        }

        await this.updateCustomOptions(productId, customOptions);
      }

      this.logger.info(`Product ${productId} updated successfully`);

      return {
        status: "success",
        statusCode: 200,
        message: "Product updated successfully",
        data: { product_id: productId },
      };
    } catch (err) {
      this.logger.error(`Error updating product: ${err.message}`);
      throw err;
    }
  }

  // Create a product service
  async _createProductService(productId, serviceData) {
    this.logger.info(`Creating service: ${JSON.stringify(serviceData)}`);

    this._validateRequiredField(serviceData.title, "Service Title");
    this._validateRequiredField(serviceData.price, "Service Price");
    this._validateRequiredField(serviceData.company_id, "Service Company ID");
    this._validateNumericField(serviceData.price, "Service Price", 0);

    if (!this._isValidUUID(serviceData.company_id)) {
      this._requestFailure();
    }

    // Validate service company exists and is active
    const serviceCompany = await Company.findOne({
      where: {
        id: serviceData.company_id,
        is_inactive: false,
      },
    });

    if (!serviceCompany) {
      throw {
        status: "error",
        statusCode: 404,
        message: "Service company not found or is inactive.",
      };
    }

    // Generate slug for service
    const serviceSlug = await this._generateSlug(serviceData.title);

    const createdService = await ProductService.create({
      title: serviceData.title,
      description: serviceData.description || null,
      full_description: serviceData.full_description || null,
      slug: serviceSlug,
      price: parseFloat(serviceData.price),
      thumbnail: serviceData.thumbnail || null,
      is_required: serviceData.is_required || false,
      is_active:
        serviceData.is_active !== undefined ? serviceData.is_active : true,
      standalone: serviceData.standalone || false,
      service_type: serviceData.service_type || "service",
      company_id: serviceData.company_id,
      product_id: productId,
      created_at: new Date(),
      updated_at: new Date(),
    });

    this.logger.info(`ProductService created with ID: ${createdService.id}`);
    return createdService;
  }

  // Assign Categories to a Product
  async _createProductService(productId, serviceData) {
    try {
      this.logger.info(`Creating service: ${JSON.stringify(serviceData)}`);

      this._validateRequiredField(serviceData.title, "Service Title");
      this._validateRequiredField(serviceData.price, "Service Price");
      this._validateRequiredField(serviceData.company_id, "Service Company ID");
      this._validateNumericField(serviceData.price, "Service Price", 0);

      if (!this._isValidUUID(serviceData.company_id)) {
        this._requestFailure();
      }

      // Validate service company exists and is active
      const serviceCompany = await Company.findOne({
        where: {
          id: serviceData.company_id,
          is_inactive: false,
        },
      });

      if (!serviceCompany) {
        throw {
          status: "error",
          statusCode: 404,
          message: "Service company not found or is inactive.",
        };
      }

      // Generate slug for service - CHECK SERVICES TABLE, NOT PRODUCTS
      const serviceSlug = await this._generateSlug(
        serviceData.title,
        null,
        "services"
      );

      const createdService = await ProductService.create({
        title: serviceData.title,
        description: serviceData.description || null,
        full_description: serviceData.full_description || null,
        slug: serviceSlug,
        price: parseFloat(serviceData.price),
        thumbnail: serviceData.thumbnail || null,
        is_required: Boolean(serviceData.is_required),
        is_active:
          serviceData.is_active !== undefined
            ? Boolean(serviceData.is_active)
            : true,
        standalone: Boolean(serviceData.standalone),
        service_type: serviceData.service_type || "service",
        company_id: serviceData.company_id,
        product_id: productId,
        created_at: new Date(),
        updated_at: new Date(),
      });

      this.logger.info(`ProductService created with ID: ${createdService.id}`);
      return createdService;
    } catch (error) {
      this.logger.error(
        `Error creating service "${serviceData.title}": ${error.message}`
      );

      // Log detailed validation errors
      if (error.errors && Array.isArray(error.errors)) {
        error.errors.forEach((validationError) => {
          this.logger.error(
            `Validation error on field "${validationError.path}": ${validationError.message}`
          );
        });
      }

      throw error;
    }
  }

  // Assigns categories to a product by its ID.
  async _assignCategoriesToProduct(productId, categories) {
    for (let i = 0; i < categories.length; i++) {
      const categoryId = categories[i];

      if (!this._isValidUUID(categoryId)) {
        this._requestFailure();
      }

      const category = await Category.findOne({
        where: {
          id: categoryId,
          is_active: true,
        },
      });

      if (!category) {
        throw {
          status: "error",
          statusCode: 404,
          message: `Category not found in our records or inactive.`,
        };
      }

      await ProductCategory.create({
        product_id: productId,
        category_id: categoryId,
        is_primary: i === 0, // First category is primary
        created_at: new Date(),
        updated_at: new Date(),
      });
    }
  }

  // Get all products with pagination and filtering
  async getAllProducts(params) {
    try {
      const {
        page = 1,
        limit = 10,
        search = "",
        status = "",
        is_published = "",
        is_active = "",
        company_id = "",
        category_id = "",
        sortBy = "created_at",
        sortOrder = "DESC",
      } = params;

      const offset = (page - 1) * limit;
      const whereConditions = {};
      const includeConditions = [];

      // Build where conditions
      if (search) {
        whereConditions[Op.or] = [
          { title: { [Op.iLike]: `%${search}%` } },
          { description: { [Op.iLike]: `%${search}%` } },
          { sku: { [Op.iLike]: `%${search}%` } },
          { barcode: { [Op.iLike]: `%${search}%` } },
        ];
      }

      if (status) {
        whereConditions.status = status;
      }

      if (is_published !== "") {
        whereConditions.is_published = is_published === "true";
      }

      if (is_active !== "") {
        whereConditions.is_active = is_active === "true";
      }

      if (company_id && this._isValidUUID(company_id)) {
        whereConditions.company_id = company_id;
      }

      // Include associations
      includeConditions.push(
        {
          model: Tax,
          as: "tax",
          attributes: ["id", "name", "rate"],
        },
        {
          model: Company,
          as: "company",
          attributes: ["id", "business_name", "market_name"],
          required: false,
        },
        {
          model: Company,
          as: "supplier",
          attributes: ["id", "business_name", "market_name"],
          required: false,
        },
        {
          model: ProductService,
          as: "product_services",
          attributes: [
            "id",
            "title",
            "price",
            "service_type",
            "is_required",
            "is_active",
          ],
          required: false,
          include: [
            {
              model: Company,
              as: "company",
              attributes: ["id", "business_name", "market_name"],
            },
          ],
        },
        {
          model: Category,
          as: "categories",
          attributes: ["id", "name", "description"],
          through: { attributes: ["is_primary"] },
          required: false,
        },
        {
          model: ProductCustomOption,
          as: "custom_options",
          include: [
            {
              model: ProductCustomOptionValue,
              as: "option_values",
              where: { is_active: true },
              required: false,
              order: [["sort_order", "ASC"]],
            },
          ],
          where: { is_active: true },
          required: false,
          order: [["sort_order", "ASC"]],
        }
      );

      // Category filter
      if (category_id && this._isValidUUID(category_id)) {
        includeConditions.push({
          model: ProductCategory,
          as: "product_categories",
          where: { category_id },
          required: true,
          attributes: [],
        });
      }

      // Get products with count
      const { rows: products, count: totalItems } =
        await Product.findAndCountAll({
          where: whereConditions,
          include: includeConditions,
          limit: parseInt(limit),
          offset: parseInt(offset),
          order: [[sortBy, sortOrder.toUpperCase()]],
          distinct: true,
        });

      const totalPages = Math.ceil(totalItems / limit);

      return {
        status: "success",
        statusCode: 200,
        message: "Products retrieved successfully.",
        data: {
          products,
          pagination: {
            current_page: parseInt(page),
            total_pages: totalPages,
            total_items: totalItems,
            items_per_page: parseInt(limit),
            has_next: page < totalPages,
            has_prev: page > 1,
          },
        },
      };
    } catch (err) {
      this.logger.error(`Error getting products: ${err.message}`);
      throw err;
    }
  }

  // get product by id
  async getProductById(productId) {
    try {
      if (!productId || !this._isValidUUID(productId)) {
        this._requestFailure();
      }

      const product = await Product.findByPk(productId, {
        include: [
          {
            model: Company,
            as: "company",
            attributes: [
              "id",
              "business_name",
              "market_name",
              "logo_url",
              "website_url",
            ],
          },
          {
            model: Company,
            as: "supplier",
            attributes: [
              "id",
              "business_name",
              "market_name",
              "logo_url",
              "website_url",
            ],
          },
          {
            model: Tax,
            as: "tax",
            attributes: ["id", "name", "rate"],
          },
          {
            model: Category,
            as: "categories",
            through: {
              model: ProductCategory,
              as: "product_category_info",
              attributes: ["is_primary"],
            },
            attributes: ["id", "name", "description", "image_url"],
          },
          {
            model: ProductService,
            as: "product_services",
            include: [
              {
                model: Company,
                as: "company",
                attributes: ["id", "business_name", "market_name", "logo_url"],
              },
            ],
          },
          // Include custom options with their values
          {
            model: ProductCustomOption,
            as: "custom_options",
            include: [
              {
                model: ProductCustomOptionValue,
                as: "option_values",
                order: [["sort_order", "ASC"]],
              },
            ],
            order: [["sort_order", "ASC"]],
          },
        ],
      });

      if (!product) {
        return {
          status: "error",
          statusCode: 404,
          message: "Product not found",
        };
      }

      // Calculate pricing information
      let calculatedPrices = {
        purchase_price_nett: parseFloat(product.purchase_price_nett),
        purchase_price_gross: parseFloat(product.purchase_price_gross),
        regular_price_nett: parseFloat(product.regular_price_nett),
        regular_price_gross: parseFloat(product.regular_price_gross),
        final_price_nett: parseFloat(product.final_price_nett),
        final_price_gross: parseFloat(product.final_price_gross),
        is_discounted: product.is_discounted,
        discount_percentage_nett: parseFloat(
          product.discount_percentage_nett || 0
        ),
        discount_percentage_gross: parseFloat(
          product.discount_percentage_gross || 0
        ),
        savings_nett: product.is_discounted
          ? parseFloat(product.regular_price_nett) -
            parseFloat(product.final_price_nett)
          : 0,
        savings_gross: product.is_discounted
          ? parseFloat(product.regular_price_gross) -
            parseFloat(product.final_price_gross)
          : 0,
      };

      // Categories summary
      let categoriesSummary = {
        total_categories: product.categories ? product.categories.length : 0,
        primary_category: product.categories
          ? product.categories.find(
              (cat) =>
                cat.product_category_info &&
                cat.product_category_info.is_primary
            )
          : null,
        all_categories: product.categories || [],
      };

      // Services summary
      let servicesSummary = {
        total_services: product.product_services
          ? product.product_services.length
          : 0,
        active_services: product.product_services
          ? product.product_services.filter((service) => service.is_active)
              .length
          : 0,
        required_services: product.product_services
          ? product.product_services.filter((service) => service.is_required)
              .length
          : 0,
        total_services_value: product.product_services
          ? product.product_services.reduce(
              (sum, service) => sum + parseFloat(service.price || 0),
              0
            )
          : 0,
      };

      return {
        status: "success",
        statusCode: 200,
        message: "Product retrieved successfully",
        data: {
          product: {
            ...product.toJSON(),
            custom_options: product.custom_options || [],
            calculated_prices: calculatedPrices,
            categories_summary: categoriesSummary,
            services_summary: servicesSummary,
          },
        },
      };
    } catch (err) {
      this.logger.error(`Error retrieving product: ${err.message}`);
      throw err;
    }
  }

  // create custom options
  async createCustomOptions(productId, customOptions = []) {
    try {
      const createdOptions = [];

      for (const optionData of customOptions) {
        const { option_values, id, ...optionFields } = optionData;

        this.logger.info(
          `Creating custom option: ${JSON.stringify(optionFields)}`
        );

        // Create the custom option - let database generate UUID, ignore frontend ID
        const customOption = await ProductCustomOption.create({
          ...optionFields,
          product_id: productId,
          created_at: new Date(),
          updated_at: new Date(),
        });

        this.logger.info(`Created custom option with ID: ${customOption.id}`);

        // Create option values if provided
        if (
          option_values &&
          Array.isArray(option_values) &&
          option_values.length > 0
        ) {
          const optionValues = [];

          // for (const valueData of option_values) {
          //   // Remove frontend-specific fields
          //   const { image, image_preview, ...cleanValueData } = valueData;

          //   let imageUrl = null;

          //   // Handle image upload if provided
          //   if (image && image.buffer) {
          //     try {
          //       imageUrl = await uploadToSpaces(
          //         image.buffer,
          //         image.originalName ||
          //           `option_${customOption.id}_${Date.now()}.jpg`,
          //         "product-options",
          //         "public-read"
          //       );
          //       this.logger.info(`Uploaded option value image: ${imageUrl}`);
          //     } catch (uploadError) {
          //       this.logger.error(
          //         `Error uploading option value image: ${uploadError.message}`
          //       );
          //     }
          //   }

          //   const optionValue = await ProductCustomOptionValue.create({
          //     custom_option_id: customOption.id,
          //     option_value: cleanValueData.option_value,
          //     display_name:
          //       cleanValueData.display_name || cleanValueData.option_value,
          //     sort_order: cleanValueData.sort_order || 0,
          //     is_default: cleanValueData.is_default || false,
          //     is_active:
          //       cleanValueData.is_active !== undefined
          //         ? cleanValueData.is_active
          //         : true,
          //     price_modifier: parseFloat(cleanValueData.price_modifier) || 0.0,
          //     price_modifier_type:
          //       cleanValueData.price_modifier_type || "fixed",
          //     image_url: imageUrl,
          //     image_alt_text:
          //       cleanValueData.image_alt_text || cleanValueData.option_value,
          //     stock_quantity: cleanValueData.stock_quantity || null,
          //     is_in_stock:
          //       cleanValueData.is_in_stock !== undefined
          //         ? cleanValueData.is_in_stock
          //         : true,
          //     additional_data: cleanValueData.additional_data || {},
          //     created_at: new Date(),
          //     updated_at: new Date(),
          //   });

          //   this.logger.info(`Created option value with ID: ${optionValue.id}`);
          //   optionValues.push(optionValue);
          // }

          for (const valueData of option_values) {
            // Remove frontend-specific fields
            const { image, image_preview, ...cleanValueData } = valueData;

            // Only preserve image_url if present, do NOT upload or change it here
            const optionValue = await ProductCustomOptionValue.create({
              custom_option_id: customOption.id,
              option_value: cleanValueData.option_value,
              display_name:
                cleanValueData.display_name || cleanValueData.option_value,
              sort_order: cleanValueData.sort_order || 0,
              is_default: cleanValueData.is_default || false,
              is_active:
                cleanValueData.is_active !== undefined
                  ? cleanValueData.is_active
                  : true,
              price_modifier: parseFloat(cleanValueData.price_modifier) || 0.0,
              price_modifier_type:
                cleanValueData.price_modifier_type || "fixed",
              image_alt_text:
                cleanValueData.image_alt_text || cleanValueData.option_value,
              stock_quantity: cleanValueData.stock_quantity || null,
              is_in_stock:
                cleanValueData.is_in_stock !== undefined
                  ? cleanValueData.is_in_stock
                  : true,
              additional_data: cleanValueData.additional_data || {},
              created_at: new Date(),
              updated_at: new Date(),
            });
          }

          customOption.dataValues.option_values = optionValues;
        }

        createdOptions.push(customOption);
      }

      this.logger.info(
        `Successfully created ${createdOptions.length} custom options`
      );
      return createdOptions;
    } catch (error) {
      this.logger.error(`Error creating custom options: ${error.message}`);
      throw error;
    }
  }

  // // update custom options
  // async updateCustomOptions(productId, customOptions = []) {
  //   try {
  //     this.logger.info(`Updating custom options for product ${productId}`);

  //     // Remove existing custom options (cascade will handle option values)
  //     await ProductCustomOption.destroy({
  //       where: { product_id: productId },
  //     });

  //     this.logger.info(
  //       `Removed existing custom options for product ${productId}`
  //     );

  //     // Create new custom options
  //     let updatedOptions = [];
  //     if (customOptions && customOptions.length > 0) {
  //       updatedOptions = await this.createCustomOptions(
  //         productId,
  //         customOptions
  //       );
  //     }

  //     this.logger.info(
  //       `Successfully updated custom options for product ${productId}`
  //     );
  //     return updatedOptions;
  //   } catch (error) {
  //     this.logger.error(`Error updating custom options: ${error.message}`);
  //     throw error;
  //   }
  // }

  // update custom options v2.0 ( fixed image_url not null) - REFACTORED
  async updateCustomOptions(productId, customOptions = []) {
    try {
      this.logger.info(
        `Updating custom options for product ${productId} while preserving images`
      );

      // First, get existing custom options with their values and image URLs
      const existingOptions = await ProductCustomOption.findAll({
        where: { product_id: productId },
        include: [
          {
            model: ProductCustomOptionValue,
            as: "option_values",
            attributes: [
              "id",
              "option_value",
              "image_url",
              "display_name",
              "price_modifier",
              "sort_order",
              "is_default",
              "is_active",
            ],
          },
        ],
      });

      // Create a map of existing image URLs by option_value for quick lookup
      const existingImageMap = new Map();
      existingOptions.forEach((option) => {
        if (option.option_values) {
          option.option_values.forEach((value) => {
            if (value.image_url) {
              // Create multiple keys for flexible matching
              const keys = [
                `${option.option_name}_${value.option_value}`,
                `${option.option_name}_${value.display_name}`,
                value.option_value,
                value.display_name,
              ].filter(Boolean);

              keys.forEach((key) => {
                existingImageMap.set(key.toLowerCase(), value.image_url);
              });
            }
          });
        }
      });

      this.logger.info(
        `Found ${existingImageMap.size} existing images to preserve`
      );

      // Remove existing custom options (cascade will handle option values)
      await ProductCustomOption.destroy({
        where: { product_id: productId },
      });

      this.logger.info(
        `Removed existing custom options for product ${productId}`
      );

      // Create new custom options with preserved image URLs
      const createdOptions = [];

      if (customOptions && customOptions.length > 0) {
        for (const optionData of customOptions) {
          const { option_values, id, ...optionFields } = optionData;

          this.logger.info(
            `Creating custom option: ${JSON.stringify(optionFields)}`
          );

          // Create the custom option
          const customOption = await ProductCustomOption.create({
            ...optionFields,
            product_id: productId,
            created_at: new Date(),
            updated_at: new Date(),
          });

          this.logger.info(`Created custom option with ID: ${customOption.id}`);

          // Create option values with preserved image URLs
          if (
            option_values &&
            Array.isArray(option_values) &&
            option_values.length > 0
          ) {
            for (const valueData of option_values) {
              // Remove frontend-specific fields
              const { image, image_preview, ...cleanValueData } = valueData;

              // Try to preserve existing image_url
              let preservedImageUrl = cleanValueData.image_url; // Use provided image_url if exists

              // If no image_url provided or it's null/empty, try to find it from existing data
              if (
                !preservedImageUrl ||
                preservedImageUrl === null ||
                preservedImageUrl === ""
              ) {
                const lookupKeys = [
                  `${optionFields.option_name}_${cleanValueData.option_value}`,
                  `${optionFields.option_name}_${cleanValueData.display_name}`,
                  cleanValueData.option_value,
                  cleanValueData.display_name,
                ]
                  .filter(Boolean)
                  .map((key) => key.toLowerCase());

                for (const key of lookupKeys) {
                  if (existingImageMap.has(key)) {
                    preservedImageUrl = existingImageMap.get(key);
                    this.logger.info(
                      `Preserved image URL for ${key}: ${preservedImageUrl}`
                    );
                    break;
                  }
                }
              }

              // Handle new image upload if provided
              if (image && image.buffer && image.originalName) {
                try {
                  const uploadedImageUrl = await uploadToSpaces(
                    image.buffer,
                    image.originalName,
                    "product-options",
                    "public-read"
                  );
                  preservedImageUrl = uploadedImageUrl;
                  this.logger.info(`Uploaded new image: ${uploadedImageUrl}`);
                } catch (uploadError) {
                  this.logger.error(
                    `Error uploading new image: ${uploadError.message}`
                  );
                  // Keep the preserved URL if upload fails
                }
              }

              // Create the option value with preserved or new image URL
              const optionValue = await ProductCustomOptionValue.create({
                custom_option_id: customOption.id,
                option_value: cleanValueData.option_value,
                display_name:
                  cleanValueData.display_name || cleanValueData.option_value,
                sort_order: cleanValueData.sort_order || 0,
                is_default: cleanValueData.is_default || false,
                is_active:
                  cleanValueData.is_active !== undefined
                    ? cleanValueData.is_active
                    : true,
                price_modifier:
                  parseFloat(cleanValueData.price_modifier) || 0.0,
                price_modifier_type:
                  cleanValueData.price_modifier_type || "fixed",
                image_url: preservedImageUrl,
                image_alt_text:
                  cleanValueData.image_alt_text || cleanValueData.option_value,
                stock_quantity: cleanValueData.stock_quantity || null,
                is_in_stock:
                  cleanValueData.is_in_stock !== undefined
                    ? cleanValueData.is_in_stock
                    : true,
                additional_data: cleanValueData.additional_data || {},
                created_at: new Date(),
                updated_at: new Date(),
              });

              this.logger.info(
                `Created option value with image_url: ${
                  preservedImageUrl || "null"
                }`
              );
            }
          }

          createdOptions.push(customOption);
        }
      }

      this.logger.info(
        `Successfully updated custom options for product ${productId} with preserved images`
      );
      return createdOptions;
    } catch (error) {
      this.logger.error(`Error updating custom options: ${error.message}`);
      throw error;
    }
  }

  // update a custom option
  async updateCustomOption(optionId, updateData) {
    try {
      const { option_values, ...optionFields } = updateData;

      // Update the custom option
      await ProductCustomOption.update(optionFields, {
        where: { id: optionId },
      });

      // Update option values if provided
      if (option_values && Array.isArray(option_values)) {
        // Remove existing option values
        await ProductCustomOptionValue.destroy({
          where: { custom_option_id: optionId },
        });

        // Create new option values
        if (option_values.length > 0) {
          for (const valueData of option_values) {
            let imageUrl = valueData.image_url; // Keep existing image URL if no new image

            // Handle new image upload if provided
            if (valueData.image && valueData.image.buffer) {
              try {
                imageUrl = await uploadToSpaces(
                  valueData.image.buffer,
                  valueData.image.originalName ||
                    `option_${optionId}_${Date.now()}.jpg`,
                  "product-options",
                  "public-read"
                );
              } catch (uploadError) {
                this.logger.error(
                  `Error uploading option value image: ${uploadError.message}`
                );
              }
            }

            await ProductCustomOptionValue.create({
              custom_option_id: optionId,
              option_value: valueData.option_value,
              display_name: valueData.display_name || valueData.option_value,
              sort_order: valueData.sort_order || 0,
              is_default: valueData.is_default || false,
              is_active:
                valueData.is_active !== undefined ? valueData.is_active : true,
              price_modifier: parseFloat(valueData.price_modifier) || 0.0,
              price_modifier_type: valueData.price_modifier_type || "fixed",
              image_url: imageUrl,
              image_alt_text: valueData.option_value,
              stock_quantity: valueData.stock_quantity || null,
              is_in_stock:
                valueData.is_in_stock !== undefined
                  ? valueData.is_in_stock
                  : true,
              additional_data: valueData.additional_data || {},
            });
          }
        }
      }

      // Return updated option with values
      return await ProductCustomOption.findByPk(optionId, {
        include: [
          {
            model: ProductCustomOptionValue,
            as: "option_values",
            order: [["sort_order", "ASC"]],
          },
        ],
      });
    } catch (error) {
      this.logger.error(`Error updating custom option: ${error.message}`);
      throw error;
    }
  }

  // get product custom options
  async getProductCustomOptions(productId) {
    try {
      const customOptions = await ProductCustomOption.findAll({
        where: {
          product_id: productId,
          is_active: true,
        },
        include: [
          {
            model: ProductCustomOptionValue,
            as: "option_values",
            where: { is_active: true },
            required: false,
            order: [["sort_order", "ASC"]],
          },
        ],
        order: [["sort_order", "ASC"]],
      });

      return customOptions;
    } catch (error) {
      throw error;
    }
  }

  // delete a custom option
  async deleteCustomOption(optionId) {
    try {
      const result = await ProductCustomOption.destroy({
        where: { id: optionId },
      });

      return result > 0;
    } catch (error) {
      throw error;
    }
  }

  // upload a custom option Image
  async uploadCustomOptionValueImage(optionId, valueId, file) {
    // Validate IDs
    this._validateRequiredField(optionId, "Option ID");
    this._validateRequiredField(valueId, "Value ID");

    // Find the option value
    const optionValue = await ProductCustomOptionValue.findOne({
      where: { id: valueId, custom_option_id: optionId },
    });

    if (!optionValue) return null;

    // Upload image to Spaces
    const imageUrl = await uploadToSpaces(
      file.buffer,
      file.originalname,
      `custom-options/${optionId}/values`
    );

    // Update DB
    await optionValue.update({
      image_url: imageUrl,
      image_alt_text: optionValue.display_name || optionValue.option_value,
      updated_at: new Date(),
    });

    return optionValue;
  }

  // archive product
  async archiveProduct(productId) {
    if (!this._isValidUUID(productId) || !productId) {
      this._requestFailure();
    }

    try {
      const product = await Product.findByPk(productId);

      if (!product) {
        throw {
          status: "error",
          statusCode: 404,
          message: "Product not found in our records.",
        };
      }

      // Archive the product
      await product.update({
        is_active: false,
        status: "archived",
        updated_at: new Date(),
      });

      this.logger.info(`Product ${productId} archived successfully`);

      return {
        status: "success",
        statusCode: 200,
        message: "Product archived successfully",
      };
    } catch (error) {
      this.logger.error(`Error archiving product: ${error.message}`);
      throw error;
    }
  }

  // publish product
  async publishProduct(productId) {
    if (!this._isValidUUID(productId) || !productId) {
      this._requestFailure();
    }

    try {
      const product = await Product.findByPk(productId);

      if (!product) {
        throw {
          status: "error",
          statusCode: 404,
          message: "Product not found in our records.",
        };
      }

      if (!product.is_active) {
        throw {
          status: "error",
          statusCode: 400,
          message:
            "Cannot publish an inactive product. Please activate it first.",
        };
      }

      if (product.is_published) {
        throw {
          status: "error",
          statusCode: 400,
          message: "Product is already published.",
        };
      }

      // Publish the product
      await product.update({
        is_published: true,
        updated_at: new Date(),
      });

      this.logger.info(`Product ${productId} published successfully`);

      return {
        status: "success",
        statusCode: 200,
        message: "Product published successfully",
      };
    } catch (error) {
      this.logger.error(`Error publishing product: ${error.message}`);
      throw error;
    }
  }

  // duplicate product
  // async duplicateProduct(productId, duplicateData = {}) {
  //   try {
  //     this._validateRequiredField(productId, "Product ID");

  //     if (!this._isValidUUID(productId)) {
  //       throw {
  //         status: "error",
  //         statusCode: 400,
  //         message: "Invalid product ID format.",
  //       };
  //     }

  //     // Get the original product with all its relations
  //     const originalProduct = await Product.findByPk(productId, {
  //       include: [
  //         {
  //           model: ProductService,
  //           as: "product_services",
  //           include: [
  //             {
  //               model: Company,
  //               as: "company",
  //             },
  //           ],
  //         },
  //         {
  //           model: Category,
  //           as: "categories",
  //           through: {
  //             model: ProductCategory,
  //             as: "product_category_info",
  //           },
  //         },
  //         {
  //           model: ProductCustomOption,
  //           as: "custom_options",
  //           include: [
  //             {
  //               model: ProductCustomOptionValue,
  //               as: "option_values",
  //               order: [["sort_order", "ASC"]],
  //             },
  //           ],
  //           order: [["sort_order", "ASC"]],
  //         },
  //         {
  //           model: Tax,
  //           as: "tax",
  //         },
  //         {
  //           model: Company,
  //           as: "company",
  //         },
  //         {
  //           model: Company,
  //           as: "supplier",
  //         },
  //       ],
  //     });

  //     if (!originalProduct) {
  //       throw {
  //         status: "error",
  //         statusCode: 404,
  //         message: "Original product not found in our records.",
  //       };
  //     }

  //     this.logger.info(
  //       `Starting duplication of product: ${originalProduct.title}`
  //     );

  //     // Generate new unique identifiers
  //     const newSKU = await this._generateUniqueSKU();
  //     const newEAN = await this._generateEAN13();
  //     const newBarcode = newEAN;

  //     // Create new title with "Copy" prefix or custom title
  //     const newTitle =
  //       duplicateData.title || `Copy of ${originalProduct.title}-${newSKU}`;

  //     const newSlug = await this._generateSlug(newTitle);

  //     // Duplicate images - keep original URLs but create new metadata
  //     let duplicatedImages = [];
  //     if (originalProduct.images && originalProduct.images.length > 0) {
  //       duplicatedImages = originalProduct.images.map((img, index) => ({
  //         id: uuidv4(),
  //         url: img.url,
  //         alt_text: img.alt_text,
  //         order: img.order,
  //         is_main: index === 0,
  //         width: img.width,
  //         height: img.height,
  //         size_bytes: img.size_bytes,
  //         file_name: `${newSKU}-${img.file_name}`,
  //         created_at: new Date(),
  //       }));
  //     }

  //     // Calculate pricing with tax
  //     const tax = originalProduct.tax;
  //     const taxRate = parseFloat(tax?.rate || 0);
  //     const taxMultiplier = 1 + taxRate / 100;

  //     const purchasePriceNett = parseFloat(originalProduct.purchase_price_nett);
  //     const regularPriceNett = parseFloat(originalProduct.regular_price_nett);

  //     const calculatedPurchasePriceGross = parseFloat(
  //       (purchasePriceNett * taxMultiplier).toFixed(2)
  //     );
  //     const calculatedRegularPriceGross = parseFloat(
  //       (regularPriceNett * taxMultiplier).toFixed(2)
  //     );

  //     // Handle discount calculation
  //     let finalPriceNett = regularPriceNett;
  //     let finalPriceGross = calculatedRegularPriceGross;
  //     let isDiscounted = false;

  //     const discountPercentage = parseFloat(
  //       originalProduct.discount_percentage_nett || 0
  //     );
  //     if (discountPercentage && discountPercentage > 0) {
  //       isDiscounted = true;
  //       finalPriceNett = regularPriceNett * (1 - discountPercentage / 100);
  //       finalPriceGross = finalPriceNett * taxMultiplier;
  //     }

  //     const newProductData = {
  //       sku: newSKU,
  //       slug: newSlug,
  //       title: newTitle,
  //       barcode: newBarcode,
  //       ean: newEAN,

  //       description: originalProduct.description,
  //       short_description: originalProduct.short_description,

  //       status: duplicateData.status || "active",
  //       is_active:
  //         duplicateData.is_active !== undefined
  //           ? duplicateData.is_active
  //           : true,
  //       is_available_on_stock:
  //         duplicateData.is_available_on_stock !== undefined
  //           ? duplicateData.is_available_on_stock
  //           : originalProduct.is_available_on_stock,
  //       shipping_free: originalProduct.shipping_free,
  //       mark_as_top_seller: duplicateData.mark_as_top_seller || false,
  //       mark_as_new: duplicateData.mark_as_new || false,
  //       mark_as_featured: duplicateData.mark_as_featured || false,
  //       is_published:
  //         duplicateData.is_published !== undefined
  //           ? duplicateData.is_published
  //           : false,
  //       is_digital: originalProduct.is_digital,
  //       is_physical: originalProduct.is_physical,
  //       is_on_sale: duplicateData.is_on_sale || false,
  //       is_delivery_only: originalProduct.is_delivery_only,
  //       is_special_offer: duplicateData.is_special_offer || false,
  //       has_services: originalProduct.has_services,
  //       has_custom_fields: originalProduct.has_custom_fields,

  //       // Physical properties
  //       weight: originalProduct.weight,
  //       weight_unit: originalProduct.weight_unit,
  //       measures_unit: originalProduct.measures_unit,
  //       unit_type: originalProduct.unit_type,
  //       width: originalProduct.width,
  //       height: originalProduct.height,
  //       length: originalProduct.length,
  //       thickness: originalProduct.thickness,
  //       depth: originalProduct.depth,
  //       lead_time: originalProduct.lead_time,

  //       // Meta fields
  //       meta_title:
  //         duplicateData.meta_title ||
  //         `${originalProduct.meta_title || originalProduct.title} - Copy`,
  //       meta_description:
  //         duplicateData.meta_description || originalProduct.meta_description,
  //       meta_keywords: originalProduct.meta_keywords,

  //       // Pricing - can be overridden
  //       purchase_price_nett:
  //         duplicateData.purchase_price_nett || purchasePriceNett,
  //       purchase_price_gross:
  //         duplicateData.purchase_price_gross || calculatedPurchasePriceGross,
  //       regular_price_nett:
  //         duplicateData.regular_price_nett || regularPriceNett,
  //       regular_price_gross:
  //         duplicateData.regular_price_gross || calculatedRegularPriceGross,
  //       final_price_nett: parseFloat(finalPriceNett),
  //       final_price_gross: parseFloat(finalPriceGross),
  //       is_discounted:
  //         duplicateData.is_discounted !== undefined
  //           ? duplicateData.is_discounted
  //           : isDiscounted,
  //       discount_percentage_nett:
  //         duplicateData.discount_percentage_nett ||
  //         originalProduct.discount_percentage_nett ||
  //         0,
  //       discount_percentage_gross:
  //         duplicateData.discount_percentage_gross ||
  //         originalProduct.discount_percentage_gross ||
  //         0,

  //       // Custom fields and images
  //       custom_details: [...(originalProduct.custom_details || [])],
  //       images: duplicatedImages,
  //       main_image_url:
  //         duplicatedImages.length > 0
  //           ? duplicatedImages[0].url
  //           : originalProduct.main_image_url,

  //       // Foreign keys
  //       tax_id: originalProduct.tax_id,
  //       company_id: originalProduct.company_id,
  //       supplier_id: originalProduct.supplier_id,

  //       // Timestamps
  //       created_at: new Date(),
  //       updated_at: new Date(),
  //     };

  //     // Create the new product
  //     const newProduct = await Product.create(newProductData);

  //     this.logger.info(`Duplicated product created with ID: ${newProduct.id}`);

  //     // Duplicate product services
  //     // let duplicatedServicesCount = 0;
  //     // if (
  //     //   originalProduct.product_services &&
  //     //   originalProduct.product_services.length > 0
  //     // ) {
  //     //   this.logger.info(
  //     //     `Duplicating ${originalProduct.product_services.length} services`
  //     //   );

  //     //   for (const originalService of originalProduct.product_services) {
  //     //     try {
  //     //       const serviceSlug = await this._generateSlug(originalService.title);

  //     //       await ProductService.create(
  //     //         {
  //     //           title: originalService.title,
  //     //           description: originalService.description,
  //     //           full_description: originalService.full_description,
  //     //           slug: serviceSlug,
  //     //           price: originalService.price,
  //     //           thumbnail: originalService.thumbnail,
  //     //           is_required: originalService.is_required,
  //     //           is_active: originalService.is_active,
  //     //           standalone: originalService.standalone,
  //     //           service_type: originalService.service_type,
  //     //           company_id: originalService.company_id,
  //     //           product_id: newProduct.id,
  //     //           created_at: new Date(),
  //     //           updated_at: new Date(),
  //     //         },
  //     //       );

  //     //       duplicatedServicesCount++;
  //     //       this.logger.info(
  //     //         `Service "${originalService.title}" duplicated successfully`
  //     //       );
  //     //     } catch (serviceError) {
  //     //       this.logger.error(
  //     //         `Error duplicating service "${originalService.title}": ${serviceError.message}`
  //     //       );
  //     //       // Continue with other services even if one fails
  //     //     }
  //     //   }
  //     // }

  //     // Duplicate category assignments
  //     // let duplicatedCategoriesCount = 0;
  //     // if (originalProduct.categories && originalProduct.categories.length > 0) {
  //     //   this.logger.info(
  //     //     `Duplicating ${originalProduct.categories.length} category assignments`
  //     //   );

  //     //   for (let i = 0; i < originalProduct.categories.length; i++) {
  //     //     const originalCategory = originalProduct.categories[i];

  //     //     try {
  //     //       await ProductCategory.create(
  //     //         {
  //     //           product_id: newProduct.id,
  //     //           category_id: originalCategory.id,
  //     //           is_primary:
  //     //             originalCategory.product_category_info?.is_primary || false,
  //     //           created_at: new Date(),
  //     //           updated_at: new Date(),
  //     //         },
  //     //       );

  //     //       duplicatedCategoriesCount++;
  //     //       this.logger.info(
  //     //         `Category "${originalCategory.name}" assigned successfully`
  //     //       );
  //     //     } catch (categoryError) {
  //     //       this.logger.error(
  //     //         `Error duplicating category "${originalCategory.name}": ${categoryError.message}`
  //     //       );
  //     //       // Continue with other categories even if one fails
  //     //     }
  //     //   }
  //     // }

  //     // // Duplicate custom options with their values
  //     // let duplicatedCustomOptionsCount = 0;
  //     // if (
  //     //   originalProduct.custom_options &&
  //     //   originalProduct.custom_options.length > 0
  //     // ) {
  //     //   this.logger.info(
  //     //     `Duplicating ${originalProduct.custom_options.length} custom options`
  //     //   );

  //     //   for (const originalOption of originalProduct.custom_options) {
  //     //     try {
  //     //       // Create the custom option
  //     //       const duplicatedOption = await ProductCustomOption.create(
  //     //         {
  //     //           product_id: newProduct.id,
  //     //           option_name: originalOption.option_name,
  //     //           option_type: originalOption.option_type,
  //     //           is_required: originalOption.is_required,
  //     //           sort_order: originalOption.sort_order,
  //     //           placeholder_text: originalOption.placeholder_text,
  //     //           help_text: originalOption.help_text,
  //     //           validation_rules: originalOption.validation_rules,
  //     //           is_active: originalOption.is_active,
  //     //           affects_price: originalOption.affects_price,
  //     //           price_modifier_type: originalOption.price_modifier_type,
  //     //           base_price_modifier: originalOption.base_price_modifier,
  //     //           created_at: new Date(),
  //     //           updated_at: new Date(),
  //     //         },
  //     //       );

  //     //       // Duplicate option values if they exist
  //     //       if (
  //     //         originalOption.option_values &&
  //     //         originalOption.option_values.length > 0
  //     //       ) {
  //     //         for (const originalValue of originalOption.option_values) {
  //     //           try {
  //     //             await ProductCustomOptionValue.create(
  //     //               {
  //     //                 custom_option_id: duplicatedOption.id,
  //     //                 option_value: originalValue.option_value,
  //     //                 display_name: originalValue.display_name,
  //     //                 sort_order: originalValue.sort_order,
  //     //                 is_default: originalValue.is_default,
  //     //                 is_active: originalValue.is_active,
  //     //                 price_modifier: originalValue.price_modifier,
  //     //                 price_modifier_type: originalValue.price_modifier_type,
  //     //                 image_url: originalValue.image_url, // Keep same image URL
  //     //                 image_alt_text: originalValue.image_alt_text,
  //     //                 additional_data: originalValue.additional_data,
  //     //                 stock_quantity: originalValue.stock_quantity,
  //     //                 is_in_stock: originalValue.is_in_stock,
  //     //                 created_at: new Date(),
  //     //                 updated_at: new Date(),
  //     //               },
  //     //             );
  //     //           } catch (valueError) {
  //     //             this.logger.error(
  //     //               `Error duplicating option value "${originalValue.option_value}": ${valueError.message}`
  //     //             );
  //     //           }
  //     //         }
  //     //       }

  //     //       duplicatedCustomOptionsCount++;
  //     //       this.logger.info(
  //     //         `Custom option "${originalOption.option_name}" duplicated successfully`
  //     //       );
  //     //     } catch (optionError) {
  //     //       this.logger.error(
  //     //         `Error duplicating custom option "${originalOption.option_name}": ${optionError.message}`
  //     //       );
  //     //     }
  //     //   }
  //     // }

  //     this.logger.info(
  //       `Product duplication completed successfully. New product ID: ${newProduct.id}`
  //     );

  //     return {
  //       status: "success",
  //       statusCode: 201,
  //       message: "Product duplicated successfully.",
  //       // data: {
  //       //   original_product: {
  //       //     id: originalProduct.id,
  //       //     sku: originalProduct.sku,
  //       //     title: originalProduct.title,
  //       //   },
  //       //   duplicated_product: {
  //       //     id: newProduct.id,
  //       //     sku: newProduct.sku,
  //       //     slug: newProduct.slug,
  //       //     title: newProduct.title,
  //       //     barcode: newProduct.barcode,
  //       //     ean: newProduct.ean,
  //       //     main_image_url: newProduct.main_image_url,
  //       //     is_active: newProduct.is_active,
  //       //     is_published: newProduct.is_published,
  //       //     final_price_nett: newProduct.final_price_nett,
  //       //     final_price_gross: newProduct.final_price_gross,
  //       //     created_at: newProduct.created_at,
  //       //   },
  //       //   duplication_summary: {
  //       //     images_duplicated: duplicatedImages.length,
  //       //     services_duplicated: duplicatedServicesCount,
  //       //     categories_duplicated: duplicatedCategoriesCount,
  //       //     custom_options_duplicated: duplicatedCustomOptionsCount,
  //       //     total_components_duplicated:
  //       //       duplicatedImages.length +
  //       //       duplicatedServicesCount +
  //       //       duplicatedCategoriesCount +
  //       //       duplicatedCustomOptionsCount,
  //       //   },
  //       // },
  //       data: {
  //         newProduct: newProduct,
  //       },
  //     };
  //   } catch (err) {
  //     this.logger.error(`Error duplicating product: ${err.message}`);
  //     throw err;
  //   }
  // }

  // v2.0
  async duplicateProduct(productId, duplicateData = {}) {
    try {
      this._validateRequiredField(productId, "Product ID");

      if (!this._isValidUUID(productId)) {
        throw {
          status: "error",
          statusCode: 400,
          message: "Invalid product ID format.",
        };
      }

      // Get the original product with all its relations
      const originalProduct = await Product.findByPk(productId, {
        include: [
          {
            model: ProductService,
            as: "product_services",
            include: [
              {
                model: Company,
                as: "company",
              },
            ],
          },
          {
            model: Category,
            as: "categories",
            through: {
              model: ProductCategory,
              as: "product_category_info",
            },
          },
          {
            model: ProductCustomOption,
            as: "custom_options",
            include: [
              {
                model: ProductCustomOptionValue,
                as: "option_values",
                order: [["sort_order", "ASC"]],
              },
            ],
            order: [["sort_order", "ASC"]],
          },
          {
            model: Tax,
            as: "tax",
          },
          {
            model: Company,
            as: "company",
          },
          {
            model: Company,
            as: "supplier",
          },
        ],
      });

      if (!originalProduct) {
        throw {
          status: "error",
          statusCode: 404,
          message: "Original product not found in our records.",
        };
      }

      this.logger.info(
        `Starting duplication of product: ${originalProduct.title}`
      );

      // Generate new unique identifiers
      const newSKU = await this._generateUniqueSKU();
      const newEAN = await this._generateEAN13();
      const newBarcode = newEAN;

      // Create new title with "Copy" prefix or custom title
      const newTitle =
        duplicateData.title || `Copy of ${originalProduct.title}-${newSKU}`;

      const newSlug = await this._generateSlug(newTitle);

      // Duplicate images - keep original URLs but create new metadata
      let duplicatedImages = [];
      if (originalProduct.images && originalProduct.images.length > 0) {
        duplicatedImages = originalProduct.images.map((img, index) => ({
          id: uuidv4(),
          url: img.url,
          alt_text: img.alt_text,
          order: img.order,
          is_main: index === 0,
          width: img.width,
          height: img.height,
          size_bytes: img.size_bytes,
          file_name: `${newSKU}-${img.file_name}`,
          created_at: new Date(),
        }));
      }

      // Calculate pricing with tax
      const tax = originalProduct.tax;
      const taxRate = parseFloat(tax?.rate || 0);
      const taxMultiplier = 1 + taxRate / 100;

      const purchasePriceNett = parseFloat(originalProduct.purchase_price_nett);
      const regularPriceNett = parseFloat(originalProduct.regular_price_nett);

      const calculatedPurchasePriceGross = parseFloat(
        (purchasePriceNett * taxMultiplier).toFixed(2)
      );
      const calculatedRegularPriceGross = parseFloat(
        (regularPriceNett * taxMultiplier).toFixed(2)
      );

      // Handle discount calculation
      let finalPriceNett = regularPriceNett;
      let finalPriceGross = calculatedRegularPriceGross;
      let isDiscounted = false;

      const discountPercentage = parseFloat(
        originalProduct.discount_percentage_nett || 0
      );
      if (discountPercentage && discountPercentage > 0) {
        isDiscounted = true;
        finalPriceNett = regularPriceNett * (1 - discountPercentage / 100);
        finalPriceGross = finalPriceNett * taxMultiplier;
      }

      const newProductData = {
        sku: newSKU,
        slug: newSlug,
        title: newTitle,
        barcode: newBarcode,
        ean: newEAN,

        description: originalProduct.description,
        short_description: originalProduct.short_description,

        status: duplicateData.status || "active",
        is_active:
          duplicateData.is_active !== undefined
            ? duplicateData.is_active
            : true,
        is_available_on_stock:
          duplicateData.is_available_on_stock !== undefined
            ? duplicateData.is_available_on_stock
            : originalProduct.is_available_on_stock,
        shipping_free: originalProduct.shipping_free,
        mark_as_top_seller: duplicateData.mark_as_top_seller || false,
        mark_as_new: duplicateData.mark_as_new || false,
        mark_as_featured: duplicateData.mark_as_featured || false,
        is_published:
          duplicateData.is_published !== undefined
            ? duplicateData.is_published
            : false,
        is_digital: originalProduct.is_digital,
        is_physical: originalProduct.is_physical,
        is_on_sale: duplicateData.is_on_sale || false,
        is_delivery_only: originalProduct.is_delivery_only,
        is_special_offer: duplicateData.is_special_offer || false,
        has_services: originalProduct.has_services,
        has_custom_fields: originalProduct.has_custom_fields,

        // Physical properties
        weight: originalProduct.weight,
        weight_unit: originalProduct.weight_unit,
        measures_unit: originalProduct.measures_unit,
        unit_type: originalProduct.unit_type,
        width: originalProduct.width,
        height: originalProduct.height,
        length: originalProduct.length,
        thickness: originalProduct.thickness,
        depth: originalProduct.depth,
        lead_time: originalProduct.lead_time,

        // Meta fields
        meta_title:
          duplicateData.meta_title ||
          `${originalProduct.meta_title || originalProduct.title} - Copy`,
        meta_description:
          duplicateData.meta_description || originalProduct.meta_description,
        meta_keywords: originalProduct.meta_keywords,

        // Pricing - can be overridden
        purchase_price_nett:
          duplicateData.purchase_price_nett || purchasePriceNett,
        purchase_price_gross:
          duplicateData.purchase_price_gross || calculatedPurchasePriceGross,
        regular_price_nett:
          duplicateData.regular_price_nett || regularPriceNett,
        regular_price_gross:
          duplicateData.regular_price_gross || calculatedRegularPriceGross,
        final_price_nett: parseFloat(finalPriceNett),
        final_price_gross: parseFloat(finalPriceGross),
        is_discounted:
          duplicateData.is_discounted !== undefined
            ? duplicateData.is_discounted
            : isDiscounted,
        discount_percentage_nett:
          duplicateData.discount_percentage_nett ||
          originalProduct.discount_percentage_nett ||
          0,
        discount_percentage_gross:
          duplicateData.discount_percentage_gross ||
          originalProduct.discount_percentage_gross ||
          0,

        // Custom fields and images
        custom_details: [...(originalProduct.custom_details || [])],
        images: duplicatedImages,
        main_image_url:
          duplicatedImages.length > 0
            ? duplicatedImages[0].url
            : originalProduct.main_image_url,

        // Foreign keys
        tax_id: originalProduct.tax_id,
        company_id: originalProduct.company_id,
        supplier_id: originalProduct.supplier_id,

        // Timestamps
        created_at: new Date(),
        updated_at: new Date(),
      };

      // Create the new product
      const newProduct = await Product.create(newProductData);

      this.logger.info(`Duplicated product created with ID: ${newProduct.id}`);

      // Duplicate product services
      let duplicatedServicesCount = 0;
      if (
        originalProduct.product_services &&
        originalProduct.product_services.length > 0
      ) {
        this.logger.info(
          `Duplicating ${originalProduct.product_services.length} services`
        );

        for (const originalService of originalProduct.product_services) {
          try {
            const serviceSlug = await this._generateSlug(originalService.title);

            await ProductService.create(
              {
                title: originalService.title,
                description: originalService.description,
                full_description: originalService.full_description,
                slug: serviceSlug,
                price: originalService.price,
                thumbnail: originalService.thumbnail,
                is_required: originalService.is_required,
                is_active: originalService.is_active,
                standalone: originalService.standalone,
                service_type: originalService.service_type,
                company_id: originalService.company_id,
                product_id: newProduct.id,
                created_at: new Date(),
                updated_at: new Date(),
              },
            );

            duplicatedServicesCount++;
            this.logger.info(
              `Service "${originalService.title}" duplicated successfully`
            );
          } catch (serviceError) {
            this.logger.error(
              `Error duplicating service "${originalService.title}": ${serviceError.message}`
            );
            // Continue with other services even if one fails
          }
        }
      }

      // Duplicate category assignments
      let duplicatedCategoriesCount = 0;
      if (originalProduct.categories && originalProduct.categories.length > 0) {
        this.logger.info(
          `Duplicating ${originalProduct.categories.length} category assignments`
        );

        for (let i = 0; i < originalProduct.categories.length; i++) {
          const originalCategory = originalProduct.categories[i];

          try {
            await ProductCategory.create(
              {
                product_id: newProduct.id,
                category_id: originalCategory.id,
                is_primary:
                  originalCategory.product_category_info?.is_primary || false,
                created_at: new Date(),
                updated_at: new Date(),
              },
            );

            duplicatedCategoriesCount++;
            this.logger.info(
              `Category "${originalCategory.name}" assigned successfully`
            );
          } catch (categoryError) {
            this.logger.error(
              `Error duplicating category "${originalCategory.name}": ${categoryError.message}`
            );
            // Continue with other categories even if one fails
          }
        }
      }

      // // Duplicate custom options with their values
      let duplicatedCustomOptionsCount = 0;
      if (
        originalProduct.custom_options &&
        originalProduct.custom_options.length > 0
      ) {
        this.logger.info(
          `Duplicating ${originalProduct.custom_options.length} custom options`
        );

        for (const originalOption of originalProduct.custom_options) {
          try {
            // Create the custom option
            const duplicatedOption = await ProductCustomOption.create(
              {
                product_id: newProduct.id,
                option_name: originalOption.option_name,
                option_type: originalOption.option_type,
                is_required: originalOption.is_required,
                sort_order: originalOption.sort_order,
                placeholder_text: originalOption.placeholder_text,
                help_text: originalOption.help_text,
                validation_rules: originalOption.validation_rules,
                is_active: originalOption.is_active,
                affects_price: originalOption.affects_price,
                price_modifier_type: originalOption.price_modifier_type,
                base_price_modifier: originalOption.base_price_modifier,
                created_at: new Date(),
                updated_at: new Date(),
              },
            );

      //       // Duplicate option values if they exist
            if (
              originalOption.option_values &&
              originalOption.option_values.length > 0
            ) {
              for (const originalValue of originalOption.option_values) {
                try {
                  await ProductCustomOptionValue.create(
                    {
                      custom_option_id: duplicatedOption.id,
                      option_value: originalValue.option_value,
                      display_name: originalValue.display_name,
                      sort_order: originalValue.sort_order,
                      is_default: originalValue.is_default,
                      is_active: originalValue.is_active,
                      price_modifier: originalValue.price_modifier,
                      price_modifier_type: originalValue.price_modifier_type,
                      image_url: originalValue.image_url, // Keep same image URL
                      image_alt_text: originalValue.image_alt_text,
                      additional_data: originalValue.additional_data,
                      stock_quantity: originalValue.stock_quantity,
                      is_in_stock: originalValue.is_in_stock,
                      created_at: new Date(),
                      updated_at: new Date(),
                    },
                  );
                } catch (valueError) {
                  this.logger.error(
                    `Error duplicating option value "${originalValue.option_value}": ${valueError.message}`
                  );
                }
              }
            }

            duplicatedCustomOptionsCount++;
            this.logger.info(
              `Custom option "${originalOption.option_name}" duplicated successfully`
            );
          } catch (optionError) {
            this.logger.error(
              `Error duplicating custom option "${originalOption.option_name}": ${optionError.message}`
            );
          }
        }
      }

      this.logger.info(
        `Product duplication completed successfully. New product ID: ${newProduct.id}`
      );

      return {
        status: "success",
        statusCode: 201,
        message: "Product duplicated successfully.",
        data: {
          original_product: {
            id: originalProduct.id,
            sku: originalProduct.sku,
            title: originalProduct.title,
          },
          duplicated_product: {
            id: newProduct.id,
            sku: newProduct.sku,
            slug: newProduct.slug,
            title: newProduct.title,
            barcode: newProduct.barcode,
            ean: newProduct.ean,
            main_image_url: newProduct.main_image_url,
            is_active: newProduct.is_active,
            is_published: newProduct.is_published,
            final_price_nett: newProduct.final_price_nett,
            final_price_gross: newProduct.final_price_gross,
            created_at: newProduct.created_at,
          },
          duplication_summary: {
            images_duplicated: duplicatedImages.length,
            services_duplicated: duplicatedServicesCount,
            categories_duplicated: duplicatedCategoriesCount,
            custom_options_duplicated: duplicatedCustomOptionsCount,
            total_components_duplicated:
              duplicatedImages.length +
              duplicatedServicesCount +
              duplicatedCategoriesCount +
              duplicatedCustomOptionsCount,
          },
        },
        data: {
          newProduct: newProduct,
        },
      };
    } catch (err) {
      this.logger.error(`Error duplicating product: ${err.message}`);
      throw err;
    }
  };

  // unpublish product
  async unpublishProduct(productId) {
    if (!this._isValidUUID(productId) || !productId) {
      this._requestFailure();
    }
    try {
      const product = await Product.findByPk(productId);

      if (!product) {
        throw {
          status: "error",
          statusCode: 404,
          message: "Product not found in our records",
        };
      }

      if (!product.is_published) {
        throw {
          status: "error",
          statusCode: 400,
          message: "Product is already unpublished.",
        };
      }

      // Unpublish the product
      await product.update({
        is_published: false,
        updated_at: new Date(),
      });

      this.logger.info(`Product ${productId} unpublished successfully`);

      return {
        status: "success",
        statusCode: 200,
        message: "Product unpublished successfully",
      };
    } catch (error) {
      this.logger.error(`Error unpublishing product: ${error.message}`);
      throw error;
    }
  }

  // unarchive product
  async unarchiveProduct(productId) {
    if (!this._isValidUUID(productId) || !productId) {
      this._requestFailure();
    }
    try {
      const product = await Product.findByPk(productId);
      if (!product) {
        throw {
          status: "error",
          statusCode: 404,
          message: "Product not found",
        };
      }

      // Unarchive the product
      await product.update({
        is_active: true,
        status: "active",
        updated_at: new Date(),
      });

      this.logger.info(`Product ${productId} unarchived successfully`);

      return {
        status: "success",
        statusCode: 200,
        message: "Product unarchived successfully",
      };
    } catch (error) {
      this.logger.error(`Error unarchiving product: ${error.message}`);
      throw error;
    }
  }

  // ============================================================================================================================================================
  // CUSTOMER ROUTES

  // new arrivals ( need to fixed only for published products on production environment )
  async getTopNewProducts(params = {}) {
    try {
      const { limit = 20 } = params;

      const whereConditions = {
        is_active: true,
        is_published: true,
        status: "active",
      };

      const includeConditions = [];

      // Include basic associations for product display
      includeConditions.push(
        {
          model: Tax,
          as: "tax",
          attributes: ["id", "name", "rate"],
        },
        {
          model: Company,
          as: "company",
          attributes: ["id", "business_name", "market_name", "logo_url"],
          required: false,
        },
        {
          model: Category,
          as: "categories",
          attributes: ["id", "name", "description", "image_url"],
          through: {
            attributes: ["is_primary"],
            where: { is_primary: true },
          },
          required: false,
        }
      );

      // Get the newest products
      const products = await Product.findAll({
        where: whereConditions,
        include: includeConditions,
        limit: parseInt(limit),
        order: [
          ["created_at", "DESC"], // Newest first
          ["updated_at", "DESC"], // Then by last updated
          ["id", "DESC"], // Finally by ID for consistent ordering
        ],
        attributes: [
          "id",
          "sku",
          "slug",
          "title",
          "description",
          "short_description",
          "barcode",
          "ean",
          "main_image_url",
          "images",
          "regular_price_nett",
          "regular_price_gross",
          "final_price_nett",
          "final_price_gross",
          "is_discounted",
          "discount_percentage_nett",
          "discount_percentage_gross",
          "mark_as_new",
          "mark_as_featured",
          "mark_as_top_seller",
          "is_on_sale",
          "shipping_free",
          "weight",
          "weight_unit",
          "created_at",
          "updated_at",
        ],
        distinct: true,
      });

      // Transform products for frontend consumption
      const transformedProducts = products.map((product) => {
        const productData = product.toJSON();

        // Calculate savings if discounted
        const savings = productData.is_discounted
          ? {
              savings_nett:
                parseFloat(productData.regular_price_nett) -
                parseFloat(productData.final_price_nett),
              savings_gross:
                parseFloat(productData.regular_price_gross) -
                parseFloat(productData.final_price_gross),
              savings_percentage: parseFloat(
                productData.discount_percentage_nett || 0
              ),
            }
          : null;

        // Get primary category
        const primaryCategory =
          productData.categories && productData.categories.length > 0
            ? productData.categories[0]
            : null;

        // Format images - ensure we have at least main image
        const formattedImages =
          productData.images && productData.images.length > 0
            ? productData.images
            : productData.main_image_url
            ? [
                {
                  url: productData.main_image_url,
                  alt_text: productData.title,
                  is_main: true,
                },
              ]
            : [];

        return {
          id: productData.id,
          sku: productData.sku,
          slug: productData.slug,
          title: productData.title,
          description: productData.description,
          short_description: productData.short_description,
          main_image_url: productData.main_image_url,
          images: formattedImages,
          pricing: {
            regular_price_nett: parseFloat(productData.regular_price_nett),
            regular_price_gross: parseFloat(productData.regular_price_gross),
            final_price_nett: parseFloat(productData.final_price_nett),
            final_price_gross: parseFloat(productData.final_price_gross),
            is_discounted: productData.is_discounted,
            discount_percentage: parseFloat(
              productData.discount_percentage_nett || 0
            ),
            savings: savings,
          },
          badges: {
            is_new: productData.mark_as_new,
            is_featured: productData.mark_as_featured,
            is_top_seller: productData.mark_as_top_seller,
            is_on_sale: productData.is_on_sale || productData.is_discounted,
            free_shipping: productData.shipping_free,
          },
          physical_info: {
            weight: productData.weight,
            weight_unit: productData.weight_unit,
          },
          primary_category: primaryCategory,
          tax_info: productData.tax,
          created_at: productData.created_at,
          updated_at: productData.updated_at,
          // Add a "new" indicator - products created in last 30 days
          is_recently_added:
            new Date() - new Date(productData.created_at) <=
            30 * 24 * 60 * 60 * 1000,
        };
      });

      this.logger.info(`Retrieved ${transformedProducts.length} new products`);

      return {
        status: "success",
        statusCode: 200,
        message: "New products retrieved successfully.",
        data: {
          products: transformedProducts,
          total_count: transformedProducts.length,
          limit: parseInt(limit),
          metadata: {
            retrieved_at: new Date(),
            is_cached: false, // You can implement caching later
            cache_expires_at: null,
          },
        },
      };
    } catch (err) {
      this.logger.error(`Error getting new products: ${err.message}`);
      throw {
        status: "error",
        statusCode: 500,
        message: "Failed to retrieve new products.",
        error: err.message,
      };
    }
  }

  // flash deals - get top 15 products with highest discount percentage
  async getTopFlashDeals(params = {}) {
    try {
      const {
        limit = 15,
        min_discount = 1,
        include_expired = false,
        category_id = "",
      } = params;

      const whereConditions = {
        is_active: true,
        is_published: true,
        status: "active",
        is_discounted: true,
        discount_percentage_nett: {
          [Op.gte]: min_discount,
        },
      };

      // // For now, we'll use is_on_sale or is_special_offer as flash deal indicators
      // if (!include_expired) {
      //   whereConditions[Op.or] = [
      //     { is_on_sale: true },
      //     { is_special_offer: true }
      //   ];
      // }

      const includeConditions = [];

      // Include basic associations for product display
      includeConditions.push(
        {
          model: Tax,
          as: "tax",
          attributes: ["id", "name", "rate"],
        },
        {
          model: Company,
          as: "company",
          attributes: ["id", "business_name", "market_name", "logo_url"],
          required: false,
        },
        {
          model: Category,
          as: "categories",
          attributes: ["id", "name", "description", "image_url"],
          through: {
            attributes: ["is_primary"],
            where: { is_primary: true },
          },
          required: false,
        }
      );

      // Add category filter if provided - using ProductCategory association
      if (category_id && this._isValidUUID(category_id)) {
        includeConditions.push({
          model: ProductCategory,
          as: "product_categories",
          where: { category_id },
          required: true,
          attributes: ["is_primary"], // Include is_primary to identify primary category
          include: [
            {
              model: Category,
              as: "category",
              attributes: ["id", "name", "description", "image_url"],
            },
          ],
        });
      }

      // Get products with highest discounts
      const products = await Product.findAll({
        where: whereConditions,
        include: includeConditions,
        limit: parseInt(limit),
        order: [
          ["discount_percentage_nett", "DESC"], // Highest discount first
          ["is_special_offer", "DESC"], // Special offers prioritized
          ["is_on_sale", "DESC"], // Sale items next
          ["created_at", "DESC"], // Newest deals first
          ["id", "DESC"], // Consistent ordering
        ],
        attributes: [
          "id",
          "sku",
          "slug",
          "title",
          "description",
          "short_description",
          "barcode",
          "ean",
          "main_image_url",
          "images",
          "regular_price_nett",
          "regular_price_gross",
          "final_price_nett",
          "final_price_gross",
          "is_discounted",
          "discount_percentage_nett",
          "discount_percentage_gross",
          "mark_as_new",
          "mark_as_featured",
          "mark_as_top_seller",
          "is_on_sale",
          "is_special_offer",
          "shipping_free",
          "weight",
          "weight_unit",
          "is_available_on_stock",
          "created_at",
          "updated_at",
        ],
        distinct: true,
      });

      // Transform products for frontend consumption with flash deal specific data
      const transformedProducts = products.map((product) => {
        const productData = product.toJSON();

        // Calculate savings and deal information
        const regularPriceNett = parseFloat(productData.regular_price_nett);
        const finalPriceNett = parseFloat(productData.final_price_nett);
        const regularPriceGross = parseFloat(productData.regular_price_gross);
        const finalPriceGross = parseFloat(productData.final_price_gross);
        const discountPercentage = parseFloat(
          productData.discount_percentage_nett || 0
        );

        const savingsNett = regularPriceNett - finalPriceNett;
        const savingsGross = regularPriceGross - finalPriceGross;

        // Determine flash deal type
        let dealType = "discount";
        if (productData.is_special_offer) {
          dealType = "special_offer";
        } else if (productData.is_on_sale) {
          dealType = "flash_sale";
        }

        // Get primary category
        const primaryCategory =
          productData.categories && productData.categories.length > 0
            ? productData.categories[0]
            : null;

        // Format images - ensure we have at least main image
        const formattedImages =
          productData.images && productData.images.length > 0
            ? productData.images
            : productData.main_image_url
            ? [
                {
                  url: productData.main_image_url,
                  alt_text: productData.title,
                  is_main: true,
                },
              ]
            : [];

        return {
          id: productData.id,
          sku: productData.sku,
          slug: productData.slug,
          title: productData.title,
          description: productData.description,
          short_description: productData.short_description,
          main_image_url: productData.main_image_url,
          images: formattedImages,
          pricing: {
            regular_price_nett: regularPriceNett,
            regular_price_gross: regularPriceGross,
            final_price_nett: finalPriceNett,
            final_price_gross: finalPriceGross,
            is_discounted: productData.is_discounted,
            discount_percentage: discountPercentage,
            savings_nett: savingsNett,
            savings_gross: savingsGross,
            savings_percentage: discountPercentage,
          },
          flash_deal: {
            deal_type: dealType,
            discount_percentage: discountPercentage,
            savings_amount_nett: savingsNett,
            savings_amount_gross: savingsGross,
            is_special_offer: productData.is_special_offer,
            is_flash_sale: productData.is_on_sale,
            // You can add deal expiry time here if you implement it
            // deal_expires_at: productData.deal_expires_at,
            deal_urgency:
              discountPercentage >= 50
                ? "high"
                : discountPercentage >= 30
                ? "medium"
                : "low",
          },
          badges: {
            is_new: productData.mark_as_new,
            is_featured: productData.mark_as_featured,
            is_top_seller: productData.mark_as_top_seller,
            is_on_sale: productData.is_on_sale,
            is_special_offer: productData.is_special_offer,
            free_shipping: productData.shipping_free,
            hot_deal: discountPercentage >= 40,
            mega_deal: discountPercentage >= 60,
          },
          availability: {
            is_available: productData.is_available_on_stock,
            weight: productData.weight,
            weight_unit: productData.weight_unit,
          },
          primary_category: primaryCategory,
          tax_info: productData.tax,
          company_info: productData.company,
          created_at: productData.created_at,
          updated_at: productData.updated_at,
          category_filtered: category_id
            ? {
                filter_category_id: category_id,
                matched_categories: productData.product_categories || [],
              }
            : null,
        };
      });

      // Calculate some statistics for the flash deals
      const dealStats = {
        total_deals: transformedProducts.length,
        average_discount:
          transformedProducts.length > 0
            ? transformedProducts.reduce(
                (sum, product) => sum + product.flash_deal.discount_percentage,
                0
              ) / transformedProducts.length
            : 0,
        highest_discount:
          transformedProducts.length > 0
            ? Math.max(
                ...transformedProducts.map(
                  (p) => p.flash_deal.discount_percentage
                )
              )
            : 0,
        total_savings_available: transformedProducts.reduce(
          (sum, product) => sum + product.pricing.savings_nett,
          0
        ),
        high_urgency_deals: transformedProducts.filter(
          (p) => p.flash_deal.deal_urgency === "high"
        ).length,
        special_offers_count: transformedProducts.filter(
          (p) => p.flash_deal.is_special_offer
        ).length,
        flash_sales_count: transformedProducts.filter(
          (p) => p.flash_deal.is_flash_sale
        ).length,
      };

      this.logger.info(
        `Retrieved ${transformedProducts.length} flash deal products`
      );

      return {
        status: "success",
        statusCode: 200,
        message: "Flash deals retrieved successfully.",
        data: {
          products: transformedProducts,
          statistics: dealStats,
          total_count: transformedProducts.length,
          limit: parseInt(limit),
          filters_applied: {
            min_discount_percentage: min_discount,
            include_expired: include_expired,
            only_published: true,
            only_active: true,
          },
          metadata: {
            retrieved_at: new Date(),
            is_cached: false,
            cache_expires_at: null,
            next_update_in_minutes: 15,
          },
        },
      };
    } catch (err) {
      this.logger.error(`Error getting flash deals: ${err.message}`);
      throw {
        status: "error",
        statusCode: 500,
        message: "Failed to retrieve flash deals.",
        error: err.message,
      };
    }
  }

  // get all products for customer - explore all with infinite scroll
  async getExploreAllProducts(params = {}) {
    try {
      const {
        limit = 40,
        offset = 0,
        search = "",
        category_id = "",
        company_id = "",
        min_price = "",
        max_price = "",
        sort_by = "created_at",
        sort_order = "DESC",
        is_on_sale = "",
        free_shipping = "",
        is_featured = "",
        is_new = "",
      } = params;

      const whereConditions = {
        is_active: true,
        is_published: true, // Only published products for customers
        status: "active",
        is_available_on_stock: true, // Only available products
      };

      const includeConditions = [];

      // Search functionality
      if (search && search.trim()) {
        whereConditions[Op.or] = [
          { title: { [Op.iLike]: `%${search.trim()}%` } },
          { description: { [Op.iLike]: `%${search.trim()}%` } },
          { short_description: { [Op.iLike]: `%${search.trim()}%` } },
        ];
      }

      // Price range filters
      if (min_price && !isNaN(parseFloat(min_price))) {
        whereConditions.final_price_nett = {
          ...whereConditions.final_price_nett,
          [Op.gte]: parseFloat(min_price),
        };
      }

      if (max_price && !isNaN(parseFloat(max_price))) {
        whereConditions.final_price_nett = {
          ...whereConditions.final_price_nett,
          [Op.lte]: parseFloat(max_price),
        };
      }

      // Boolean filters
      if (is_on_sale === "true") {
        whereConditions[Op.or] = [
          { is_on_sale: true },
          { is_discounted: true },
        ];
      }

      if (free_shipping === "true") {
        whereConditions.shipping_free = true;
      }

      if (is_featured === "true") {
        whereConditions.mark_as_featured = true;
      }

      if (is_new === "true") {
        whereConditions.mark_as_new = true;
      }

      // Company filter
      if (company_id && this._isValidUUID(company_id)) {
        whereConditions.company_id = company_id;
      }

      // Include associations for product display
      includeConditions.push(
        {
          model: Tax,
          as: "tax",
          attributes: ["id", "name", "rate"],
        },
        {
          model: Company,
          as: "company",
          attributes: ["id", "business_name", "market_name", "logo_url"],
          required: false,
        },
        {
          model: Category,
          as: "categories",
          attributes: ["id", "name", "description", "image_url"],
          through: {
            attributes: ["is_primary"],
            where: { is_primary: true },
          },
          required: false,
        }
      );

      // Category filter using ProductCategory association
      if (category_id && this._isValidUUID(category_id)) {
        includeConditions.push({
          model: ProductCategory,
          as: "product_categories",
          where: { category_id },
          required: true,
          attributes: ["is_primary"],
          include: [
            {
              model: Category,
              as: "category",
              attributes: ["id", "name", "description", "image_url"],
            },
          ],
        });
      }

      // Define sorting options
      let orderClause;
      switch (sort_by) {
        case "price_low_high":
          orderClause = [["final_price_nett", "ASC"]];
          break;
        case "price_high_low":
          orderClause = [["final_price_nett", "DESC"]];
          break;
        case "name_a_z":
          orderClause = [["title", "ASC"]];
          break;
        case "name_z_a":
          orderClause = [["title", "DESC"]];
          break;
        case "newest":
          orderClause = [["created_at", "DESC"]];
          break;
        case "oldest":
          orderClause = [["created_at", "ASC"]];
          break;
        case "featured":
          orderClause = [
            ["mark_as_featured", "DESC"],
            ["created_at", "DESC"],
          ];
          break;
        case "discount":
          orderClause = [
            ["discount_percentage_nett", "DESC"],
            ["created_at", "DESC"],
          ];
          break;
        case "popular":
          orderClause = [
            ["score", "DESC"],
            ["created_at", "DESC"],
          ];
          break;
        default:
          orderClause = [[sort_by, sort_order.toUpperCase()]];
      }

      // Get products with count for pagination info
      const { rows: products, count: totalCount } =
        await Product.findAndCountAll({
          where: whereConditions,
          include: includeConditions,
          limit: parseInt(limit),
          offset: parseInt(offset),
          order: orderClause,
          attributes: [
            "id",
            "sku",
            "slug",
            "title",
            "description",
            "short_description",
            "main_image_url",
            "images",
            "regular_price_nett",
            "regular_price_gross",
            "final_price_nett",
            "final_price_gross",
            "is_discounted",
            "discount_percentage_nett",
            "mark_as_new",
            "mark_as_featured",
            "mark_as_top_seller",
            "is_on_sale",
            "is_special_offer",
            "shipping_free",
            "weight",
            "weight_unit",
            "created_at",
            "updated_at",
          ],
          distinct: true,
        });

      // Transform products for frontend consumption
      const transformedProducts = products.map((product) => {
        const productData = product.toJSON();

        // Calculate savings if discounted
        const regularPriceNett = parseFloat(productData.regular_price_nett);
        const finalPriceNett = parseFloat(productData.final_price_nett);
        const regularPriceGross = parseFloat(productData.regular_price_gross);
        const finalPriceGross = parseFloat(productData.final_price_gross);
        const discountPercentage = parseFloat(
          productData.discount_percentage_nett || 0
        );

        const savings = productData.is_discounted
          ? {
              savings_nett: regularPriceNett - finalPriceNett,
              savings_gross: regularPriceGross - finalPriceGross,
              savings_percentage: discountPercentage,
            }
          : null;

        // Get primary category
        const primaryCategory =
          productData.categories && productData.categories.length > 0
            ? productData.categories[0]
            : null;

        // Format images - ensure we have at least main image
        const formattedImages =
          productData.images && productData.images.length > 0
            ? productData.images
            : productData.main_image_url
            ? [
                {
                  url: productData.main_image_url,
                  alt_text: productData.title,
                  is_main: true,
                },
              ]
            : [];

        return {
          id: productData.id,
          sku: productData.sku,
          slug: productData.slug,
          title: productData.title,
          description: productData.description,
          short_description: productData.short_description,
          main_image_url: productData.main_image_url,
          images: formattedImages,
          pricing: {
            regular_price_nett: regularPriceNett,
            regular_price_gross: regularPriceGross,
            final_price_nett: finalPriceNett,
            final_price_gross: finalPriceGross,
            is_discounted: productData.is_discounted,
            discount_percentage: discountPercentage,
            savings: savings,
          },
          badges: {
            is_new: productData.mark_as_new,
            is_featured: productData.mark_as_featured,
            is_top_seller: productData.mark_as_top_seller,
            is_on_sale: productData.is_on_sale || productData.is_discounted,
            is_special_offer: productData.is_special_offer,
            free_shipping: productData.shipping_free,
          },
          physical_info: {
            weight: productData.weight,
            weight_unit: productData.weight_unit,
          },
          category: primaryCategory,
          company: productData.company,
          tax_info: productData.tax,
          created_at: productData.created_at,
          updated_at: productData.updated_at,
          is_recently_added:
            new Date() - new Date(productData.created_at) <=
            30 * 24 * 60 * 60 * 1000,
        };
      });

      // Calculate pagination info
      const hasMore = offset + limit < totalCount;
      const nextOffset = hasMore ? offset + limit : null;

      this.logger.info(
        `Retrieved ${transformedProducts.length} products for explore all (offset: ${offset}, total: ${totalCount})`
      );

      return {
        status: "success",
        statusCode: 200,
        message: "Products retrieved successfully.",
        data: {
          products: transformedProducts,
          pagination: {
            total_count: totalCount,
            current_offset: parseInt(offset),
            limit: parseInt(limit),
            has_more: hasMore,
            next_offset: nextOffset,
            current_page: Math.floor(offset / limit) + 1,
            total_pages: Math.ceil(totalCount / limit),
          },
          filters_applied: {
            search: search || null,
            category_id: category_id || null,
            company_id: company_id || null,
            price_range: {
              min_price: min_price ? parseFloat(min_price) : null,
              max_price: max_price ? parseFloat(max_price) : null,
            },
            sort_by,
            sort_order,
            filters: {
              is_on_sale: is_on_sale === "true",
              free_shipping: free_shipping === "true",
              is_featured: is_featured === "true",
              is_new: is_new === "true",
            },
          },
          metadata: {
            retrieved_at: new Date(),
            is_cached: false,
            cache_expires_at: null,
          },
        },
      };
    } catch (err) {
      this.logger.error(`Error getting explore all products: ${err.message}`);
      throw {
        status: "error",
        statusCode: 500,
        message: "Failed to retrieve products.",
        error: err.message,
      };
    }
  }

  // get details of a product for customer (read-only)
  // async getProductDetails(productSlug) {
  //   try {
  //     this._validateRequiredField(productSlug, "Product slug");

  //     // Find product by slug for customer-facing URLs
  //     const product = await Product.findOne({
  //       where: {
  //         slug: productSlug,
  //         is_active: true,
  //         is_published: true, // Only published products for customers
  //         status: "active"
  //       },
  //       include: [
  //         // Company information (seller)
  //         {
  //           model: Company,
  //           as: "company",
  //           required: false,
  //         },
  //         // Supplier information
  //         {
  //           model: Company,
  //           as: "supplier",
  //           required: false,
  //         },
  //         {
  //           model: Tax,
  //           as: "tax",
  //           required: false,
  //         },
  //         {
  //           model: Category,
  //           as: "categories",
  //           through: {
  //             model: ProductCategory,
  //             as: "product_category_info",
  //           },
  //           required: false,
  //         },
  //         // Product services (installation, support, etc.)
  //         {
  //           model: ProductService,
  //           as: "product_services",
  //           where: { is_active: true },
  //           required: false,
  //           include: [
  //             {
  //               model: Company,
  //               as: "company",
  //               required: false,
  //             },
  //           ],
  //         },
  //         // Custom options (size, color, etc.)
  //         {
  //           model: ProductCustomOption,
  //           as: "custom_options",
  //           where: { is_active: true },
  //           required: false,
  //           include: [
  //             {
  //               model: ProductCustomOptionValue,
  //               as: "option_values",
  //               where: {
  //                 is_active: true,
  //                 is_in_stock: true
  //               },
  //               required: false,
  //               order: [["sort_order", "ASC"]],
  //             },
  //           ],
  //           order: [["sort_order", "ASC"]],
  //         },
  //       ],
  //     });

  //     if (!product) {
  //       throw {
  //         status: "error",
  //         statusCode: 404,
  //         message: "Product not found or not available",
  //       };
  //     }

  //     const productData = product.toJSON();

  //     // Enhanced pricing calculations
  //     const regularPriceNett = parseFloat(productData.regular_price_nett);
  //     const regularPriceGross = parseFloat(productData.regular_price_gross);
  //     const finalPriceNett = parseFloat(productData.final_price_nett);
  //     const finalPriceGross = parseFloat(productData.final_price_gross);
  //     const discountPercentageNett = parseFloat(productData.discount_percentage_nett || 0);
  //     const discountPercentageGross = parseFloat(productData.discount_percentage_gross || 0);

  //     // Calculate savings
  //     const savingsNett = productData.is_discounted ? regularPriceNett - finalPriceNett : 0;
  //     const savingsGross = productData.is_discounted ? regularPriceGross - finalPriceGross : 0;

  //     // Enhanced pricing information
  //     const pricingInfo = {
  //       purchase_price: {
  //         nett: parseFloat(productData.purchase_price_nett),
  //         gross: parseFloat(productData.purchase_price_gross),
  //       },
  //       regular_price: {
  //         nett: regularPriceNett,
  //         gross: regularPriceGross,
  //       },
  //       final_price: {
  //         nett: finalPriceNett,
  //         gross: finalPriceGross,
  //       },
  //       discount: {
  //         is_discounted: productData.is_discounted,
  //         percentage_nett: discountPercentageNett,
  //         percentage_gross: discountPercentageGross,
  //         amount_nett: savingsNett,
  //         amount_gross: savingsGross,
  //       },
  //       display_price: finalPriceNett, // Main price to display
  //       currency: "EUR", // You can make this dynamic
  //       tax_info: productData.tax ? {
  //         tax_name: productData.tax.name,
  //         tax_rate: parseFloat(productData.tax.rate),
  //         tax_amount: finalPriceGross - finalPriceNett,
  //         price_includes_tax: true
  //       } : null
  //     };

  //     // Process categories
  //     const categoriesInfo = {
  //       total_categories: productData.categories ? productData.categories.length : 0,
  //       primary_category: productData.categories
  //         ? productData.categories.find(
  //             (cat) => cat.product_category_info?.is_primary
  //           )
  //         : null,
  //       all_categories: productData.categories || [],
  //       breadcrumb: productData.categories
  //         ? productData.categories
  //             .filter((cat) => cat.product_category_info?.is_primary)
  //             .map((cat) => ({
  //               id: cat.id,
  //               name: cat.name,
  //               slug: cat.slug,
  //             }))
  //         : [],
  //     };

  //     // Process services
  //     const servicesInfo = {
  //       total_services: productData.product_services ? productData.product_services.length : 0,
  //       has_services: productData.has_services && productData.product_services?.length > 0,
  //       required_services: productData.product_services
  //         ? productData.product_services.filter((service) => service.is_required)
  //         : [],
  //       optional_services: productData.product_services
  //         ? productData.product_services.filter((service) => !service.is_required)
  //         : [],
  //       services_by_type: productData.product_services
  //         ? productData.product_services.reduce((acc, service) => {
  //             const type = service.service_type;
  //             if (!acc[type]) acc[type] = [];
  //             acc[type].push(service);
  //             return acc;
  //           }, {})
  //         : {},
  //       total_services_value: productData.product_services
  //         ? productData.product_services.reduce(
  //             (sum, service) => sum + parseFloat(service.price || 0),
  //             0
  //           )
  //         : 0,
  //     };

  //     // Process custom options
  //     const customOptionsInfo = {
  //       total_options: productData.custom_options ? productData.custom_options.length : 0,
  //       has_custom_options: productData.has_custom_fields && productData.custom_options?.length > 0,
  //       required_options: productData.custom_options
  //         ? productData.custom_options.filter((opt) => opt.is_required)
  //         : [],
  //       optional_options: productData.custom_options
  //         ? productData.custom_options.filter((opt) => !opt.is_required)
  //         : [],
  //       price_affecting_options: productData.custom_options
  //         ? productData.custom_options.filter((opt) => opt.affects_price)
  //         : [],
  //       options_by_type: productData.custom_options
  //         ? productData.custom_options.reduce((acc, option) => {
  //             const type = option.option_type;
  //             if (!acc[type]) acc[type] = [];
  //             acc[type].push(option);
  //             return acc;
  //           }, {})
  //         : {},
  //     };

  //     // Process images with enhanced information
  //     const imagesInfo = {
  //       main_image: {
  //         url: productData.main_image_url,
  //         alt_text: productData.title,
  //         is_main: true
  //       },
  //       gallery: productData.images && productData.images.length > 0
  //         ? productData.images.map((img, index) => ({
  //             ...img,
  //             position: index + 1,
  //             is_main: index === 0
  //           }))
  //         : [
  //             {
  //               url: productData.main_image_url,
  //               alt_text: productData.title,
  //               is_main: true,
  //               position: 1
  //             }
  //           ],
  //       total_images: productData.images ? productData.images.length : 1
  //     };

  //     // Physical specifications
  //     const physicalSpecs = {
  //       dimensions: {
  //         width: productData.width,
  //         height: productData.height,
  //         length: productData.length,
  //         thickness: productData.thickness,
  //         depth: productData.depth,
  //         unit: productData.measures_unit
  //       },
  //       weight: {
  //         value: productData.weight,
  //         unit: productData.weight_unit
  //       },
  //       packaging: {
  //         unit_type: productData.unit_type,
  //         lead_time: productData.lead_time
  //       }
  //     };

  //     // Product badges and flags
  //     const badges = {
  //       is_new: productData.mark_as_new,
  //       is_featured: productData.mark_as_featured,
  //       is_top_seller: productData.mark_as_top_seller,
  //       is_on_sale: productData.is_on_sale,
  //       is_special_offer: productData.is_special_offer,
  //       free_shipping: productData.shipping_free,
  //       is_digital: productData.is_digital,
  //       is_physical: productData.is_physical,
  //       delivery_only: productData.is_delivery_only,
  //       recently_added: new Date() - new Date(productData.created_at) <= (30 * 24 * 60 * 60 * 1000)
  //     };

  //     // Availability information
  //     const availability = {
  //       is_available: productData.is_available_on_stock,
  //       is_active: productData.is_active,
  //       is_published: productData.is_published,
  //       status: productData.status,
  //       lead_time_days: productData.lead_time,
  //       stock_status: productData.is_available_on_stock ? "in_stock" : "out_of_stock"
  //     };

  //     // SEO and meta information
  //     const seoInfo = {
  //       meta_title: productData.meta_title || productData.title,
  //       meta_description: productData.meta_description || productData.short_description,
  //       meta_keywords: productData.meta_keywords,
  //       canonical_url: `/products/${productData.slug}`,
  //       structured_data: {
  //         "@context": "https://schema.org/",
  //         "@type": "Product",
  //         "name": productData.title,
  //         "description": productData.short_description,
  //         "sku": productData.sku,
  //         "gtin": productData.ean,
  //         "brand": productData.company?.business_name || productData.company?.market_name,
  //         "offers": {
  //           "@type": "Offer",
  //           "price": finalPriceNett,
  //           "priceCurrency": "EUR",
  //           "availability": productData.is_available_on_stock
  //             ? "https://schema.org/InStock"
  //             : "https://schema.org/OutOfStock"
  //         }
  //       }
  //     };

  //     // Company/seller information
  //     const sellerInfo = productData.company ? {
  //       id: productData.company.id,
  //       business_name: productData.company.business_name,
  //       market_name: productData.company.market_name,
  //       display_name: productData.company.market_name || productData.company.business_name,
  //       logo_url: productData.company.logo_url,
  //       website_url: productData.company.website_url,
  //       contact: {
  //         phone: productData.company.phone,
  //         email: productData.company.email,
  //       },
  //       location: {
  //         address: productData.company.address,
  //         city: productData.company.city,
  //         country: productData.company.country,
  //       },
  //       about: productData.company.description,
  //       established_year: productData.company.established_year
  //     } : null;

  //     // Supplier information (if different from seller)
  //     const supplierInfo = productData.supplier ? {
  //       id: productData.supplier.id,
  //       business_name: productData.supplier.business_name,
  //       market_name: productData.supplier.market_name,
  //       display_name: productData.supplier.market_name || productData.supplier.business_name,
  //       logo_url: productData.supplier.logo_url,
  //       website_url: productData.supplier.website_url
  //     } : null;

  //     this.logger.info(`Product details retrieved for: ${productData.title} (${productData.slug})`);

  //     return {
  //       status: "success",
  //       statusCode: 200,
  //       message: "Product details retrieved successfully",
  //       data: {
  //         // Basic product information
  //         id: productData.id,
  //         sku: productData.sku,
  //         slug: productData.slug,
  //         title: productData.title,
  //         description: productData.description,
  //         short_description: productData.short_description,
  //         barcode: productData.barcode,
  //         ean: productData.ean,

  //         // Pricing information
  //         pricing: pricingInfo,

  //         // Product organization
  //         categories: categoriesInfo,

  //         // Services and customization
  //         services: servicesInfo,
  //         custom_options: customOptionsInfo,

  //         // Media and presentation
  //         images: imagesInfo,

  //         // Product specifications
  //         physical_specifications: physicalSpecs,

  //         // Status and badges
  //         badges: badges,
  //         availability: availability,

  //         // SEO and metadata
  //         seo: seoInfo,

  //         // Business information
  //         seller: sellerInfo,
  //         supplier: supplierInfo,

  //         // Additional details
  //         custom_details: productData.custom_details || [],

  //         // Timestamps
  //         created_at: productData.created_at,
  //         updated_at: productData.updated_at,

  //         // Analytics placeholder (can be populated later with event tracking)
  //         analytics: {
  //           view_count: 0, // Will be populated from event tracking
  //           popularity_score: productData.score || 0,
  //           rating: null, // Will be populated when review system is implemented
  //           reviews_count: 0 // Will be populated when review system is implemented
  //         }
  //       },
  //     };
  //   } catch (err) {
  //     this.logger.error(`Error retrieving product details: ${err.message}`);
  //     if (err.statusCode) {
  //       throw err;
  //     }
  //     throw {
  //       status: "error",
  //       statusCode: 500,
  //       message: "Failed to retrieve product details.",
  //       error: err.message,
  //     };
  //   }
  // }

  // Replace the existing getProductDetails method with this enhanced version:

  // get details of a product for customer (read-only)

  // get product details
  async getProductDetails(productSlug) {
    try {
      this._validateRequiredField(productSlug, "Product Slug");

      const product = await Product.findOne({
        where: {
          slug: productSlug,
          is_published: true, // Only show published products to customers
          is_active: true,
          status: "active",
        },
        include: [
          {
            model: Company,
            as: "company",
          },
          {
            model: Company,
            as: "supplier",
          },
          {
            model: Tax,
            as: "tax",
          },
          {
            model: Category,
            as: "categories",
            through: {
              model: ProductCategory,
              as: "product_category_info",
              attributes: ["is_primary"],
            },
            where: { is_active: true },
            required: false,
          },
          {
            model: ProductService,
            as: "product_services",
            where: { is_active: true },
            required: false,
            include: [
              {
                model: Company,
                as: "company",
              },
            ],
          },
          {
            model: ProductCustomOption,
            as: "custom_options",
            where: { is_active: true },
            required: false,
            include: [
              {
                model: ProductCustomOptionValue,
                as: "option_values",
                where: { is_active: true },
                required: false,
                order: [["sort_order", "ASC"]],
              },
            ],
            order: [["sort_order", "ASC"]],
          },
        ],
      });

      if (!product) {
        throw {
          status: "error",
          statusCode: 404,
          message: "Product not found or not available.",
        };
      }

      // Structure the response data for customer frontend
      const structuredProduct = {
        // Basic Info
        id: product.id,
        sku: product.sku,
        slug: product.slug,
        title: product.title,
        description: product.description,
        short_description: product.short_description,
        ean: product.ean,

        // Status & Availability
        availability: {
          is_available: product.is_available_on_stock,
          stock_status: product.is_available_on_stock
            ? "in_stock"
            : "out_of_stock",
          lead_time: product.lead_time || 5,
        },

        // Badges
        badges: {
          is_on_sale: product.is_on_sale,
          is_new: product.mark_as_new,
          free_shipping: product.shipping_free,
          is_featured: product.mark_as_featured,
          is_top_seller: product.mark_as_top_seller,
          is_special_offer: product.is_special_offer,
        },

        // Images
        images: {
          main_image: {
            url: product.main_image_url,
            alt: product.title,
          },
          gallery: product.images || [],
        },

        // Pricing with proper structure
        pricing: {
          regular_price: {
            nett: parseFloat(product.regular_price_nett),
            gross: parseFloat(product.regular_price_gross),
          },
          final_price: {
            nett: parseFloat(product.final_price_nett),
            gross: parseFloat(product.final_price_gross),
          },
          discount: {
            is_discounted: product.is_discounted,
            percentage_nett: parseFloat(product.discount_percentage_nett || 0),
            percentage_gross: parseFloat(
              product.discount_percentage_gross || 0
            ),
            amount_nett: product.is_discounted
              ? parseFloat(product.regular_price_nett) -
                parseFloat(product.final_price_nett)
              : 0,
            amount_gross: product.is_discounted
              ? parseFloat(product.regular_price_gross) -
                parseFloat(product.final_price_gross)
              : 0,
          },
          tax_info: product.tax
            ? {
                tax_name: product.tax.name,
                tax_rate: parseFloat(product.tax.rate),
                tax_type: product.tax.type,
              }
            : null,
        },

        // Physical Specifications
        physical_specifications: {
          dimensions: {
            width: product.width,
            height: product.height,
            depth: product.depth,
            length: product.length,
            thickness: product.thickness,
            unit: product.measures_unit,
          },
          weight: {
            value: product.weight,
            unit: product.weight_unit,
          },
        },

        // Categories
        categories: {
          primary_category: product.categories
            ? product.categories.find(
                (cat) =>
                  cat.product_category_info &&
                  cat.product_category_info.is_primary
              )
            : null,
          all_categories: product.categories || [],
        },

        // Services
        services: {
          has_services: product.has_services,
          optional_services: product.product_services || [],
        },

        // Custom Options (for variants like colors, sizes, etc.)
        custom_options: {
          has_options: product.has_custom_fields,
          optional_options: product.custom_options || [],
        },

        // Seller Information
        seller: product.company
          ? {
              id: product.company.id,
              display_name:
                product.company.market_name || product.company.business_name,
              business_name: product.company.business_name,
              logo_url: product.company.logo_url,
              website_url: product.company.website_url,
            }
          : null,

        // Supplier Information
        supplier: product.supplier
          ? {
              id: product.supplier.id,
              display_name:
                product.supplier.market_name || product.supplier.business_name,
              business_name: product.supplier.business_name,
            }
          : null,

        // Analytics (mock data for now - you can implement real analytics later)
        analytics: {
          rating: 4.5, // You can calculate this from reviews
          reviews_count: 248, // You can count from reviews table
          views_count: 1250, // You can track this
          purchases_count: 89, // You can count from orders
        },

        // Additional Product Details
        meta: {
          unit_type: product.unit_type,
          measures_unit: product.measures_unit,
          weight_unit: product.weight_unit,
          is_digital: product.is_digital,
          is_physical: product.is_physical,
          is_delivery_only: product.is_delivery_only,
        },

        // SEO
        seo: {
          meta_title: product.meta_title,
          meta_description: product.meta_description,
          meta_keywords: product.meta_keywords,
        },
      };

      this.logger.info(
        `Product details retrieved for customer: ${product.title}`
      );

      return {
        status: "success",
        statusCode: 200,
        message: "Product details retrieved successfully",
        data: product,
      };
    } catch (err) {
      this.logger.error(
        `Error getting product details for customer: ${err.message}`
      );
      throw err;
    }
  }

  // Get recommended products based on current product
  async getRecommendedProducts(productSlug, params = {}) {
    try {
      const { limit = 8, exclude_out_of_stock = true } = params;

      this._validateRequiredField(productSlug, "Product Slug");

      // First, get the current product to base recommendations on
      const currentProduct = await Product.findOne({
        where: {
          slug: productSlug,
          is_published: true,
          is_active: true,
          status: "active",
        },
        include: [
          {
            model: Category,
            as: "categories",
            attributes: ["id", "name", "parent_id", "level"],
            through: { attributes: ["is_primary"] },
            required: false,
          },
          {
            model: Tax,
            as: "tax",
            attributes: ["id", "rate"],
            required: false,
          },
        ],
      });

      if (!currentProduct) {
        throw {
          status: "error",
          statusCode: 404,
          message: "Product not found",
        };
      }

      const whereConditions = {
        is_active: true,
        is_published: true,
        status: "active",
        id: { [Op.ne]: currentProduct.id }, // Exclude current product
      };

      if (exclude_out_of_stock) {
        whereConditions.is_available_on_stock = true;
      }

      // Get category IDs from current product
      const currentCategories = currentProduct.categories || [];
      const categoryIds = currentCategories.map((cat) => cat.id);
      const primaryCategory = currentCategories.find(
        (cat) =>
          cat.ProductCategory?.is_primary || cat.product_categories?.is_primary
      );

      // Price range for recommendations (±30% of current product price)
      const currentPrice = parseFloat(currentProduct.final_price_nett);
      const priceRangeMin = currentPrice * 0.7;
      const priceRangeMax = currentPrice * 1.3;

      const includeConditions = [
        {
          model: Tax,
          as: "tax",
          attributes: ["id", "name", "rate"],
        },
        {
          model: Company,
          as: "company",
          attributes: ["id", "business_name", "market_name", "logo_url"],
          required: false,
        },
        {
          model: Category,
          as: "categories",
          attributes: ["id", "name", "description", "image_url"],
          through: {
            attributes: ["is_primary"],
          },
          required: false,
        },
      ];

      // Build recommendation scoring query with multiple criteria
      const recommendations = await Product.findAll({
        where: whereConditions,
        include: includeConditions,
        attributes: [
          "id",
          "sku",
          "slug",
          "title",
          "description",
          "short_description",
          "main_image_url",
          "images",
          "regular_price_nett",
          "regular_price_gross",
          "final_price_nett",
          "final_price_gross",
          "is_discounted",
          "discount_percentage_nett",
          "mark_as_new",
          "mark_as_featured",
          "mark_as_top_seller",
          "is_on_sale",
          "shipping_free",
          "weight",
          "weight_unit",
          "created_at",
          "updated_at",
          // Add scoring calculation
          [
            sequelize.literal(`
            CASE 
              WHEN id IN (
                SELECT DISTINCT p2.id 
                FROM products p2 
                JOIN product_categories pc2 ON p2.id = pc2.product_id 
                WHERE pc2.category_id IN (${
                  categoryIds.length > 0
                    ? categoryIds.map((id) => `'${id}'`).join(",")
                    : "''"
                })
              ) THEN 50
              ELSE 0
            END +
            CASE 
              WHEN final_price_nett BETWEEN ${priceRangeMin} AND ${priceRangeMax} THEN 30
              ELSE 0  
            END +
            CASE WHEN mark_as_featured = true THEN 15 ELSE 0 END +
            CASE WHEN mark_as_top_seller = true THEN 10 ELSE 0 END +
            CASE WHEN is_on_sale = true THEN 10 ELSE 0 END +
            CASE WHEN mark_as_new = true THEN 5 ELSE 0 END +
            CASE WHEN shipping_free = true THEN 5 ELSE 0 END
          `),
            "recommendation_score",
          ],
        ],
        order: [
          [sequelize.literal("recommendation_score"), "DESC"],
          ["mark_as_featured", "DESC"],
          ["mark_as_top_seller", "DESC"],
          ["created_at", "DESC"],
        ],
        limit: parseInt(limit) * 2, // Get more to filter and sort
        distinct: true,
      });

      // Transform and score recommendations
      const scoredRecommendations = recommendations.map((product) => {
        const productData = product.toJSON();

        let score = parseInt(productData.recommendation_score) || 0;

        // Additional scoring based on similarity
        const productCategories = productData.categories || [];
        const productCategoryIds = productCategories.map((cat) => cat.id);

        // Category overlap bonus
        const categoryOverlap = categoryIds.filter((id) =>
          productCategoryIds.includes(id)
        ).length;

        if (categoryOverlap > 0) {
          score += categoryOverlap * 15; // 15 points per matching category
        }

        // Primary category match bonus
        if (
          primaryCategory &&
          productCategories.some(
            (cat) =>
              cat.id === primaryCategory.id && cat.ProductCategory?.is_primary
          )
        ) {
          score += 25;
        }

        // Same company bonus
        if (productData.company_id === currentProduct.company_id) {
          score += 20;
        }

        // Price similarity bonus (closer = higher score)
        const productPrice = parseFloat(productData.final_price_nett);
        const priceDifference =
          Math.abs(productPrice - currentPrice) / currentPrice;
        if (priceDifference <= 0.2) {
          // Within 20%
          score += 15;
        } else if (priceDifference <= 0.5) {
          // Within 50%
          score += 10;
        }

        // Calculate savings if discounted
        const savings = productData.is_discounted
          ? {
              savings_nett:
                parseFloat(productData.regular_price_nett) -
                parseFloat(productData.final_price_nett),
              savings_gross:
                parseFloat(productData.regular_price_gross) -
                parseFloat(productData.final_price_gross),
              savings_percentage: parseFloat(
                productData.discount_percentage_nett || 0
              ),
            }
          : null;

        // Get primary category
        const primaryProductCategory =
          productCategories.find((cat) => cat.ProductCategory?.is_primary) ||
          productCategories[0] ||
          null;

        // Format images
        const formattedImages =
          productData.images && productData.images.length > 0
            ? productData.images
            : productData.main_image_url
            ? [
                {
                  url: productData.main_image_url,
                  alt_text: productData.title,
                  is_main: true,
                },
              ]
            : [];

        return {
          id: productData.id,
          sku: productData.sku,
          slug: productData.slug,
          title: productData.title,
          description: productData.description,
          short_description: productData.short_description,
          main_image_url: productData.main_image_url,
          images: formattedImages,
          pricing: {
            regular_price_nett: parseFloat(productData.regular_price_nett),
            regular_price_gross: parseFloat(productData.regular_price_gross),
            final_price_nett: parseFloat(productData.final_price_nett),
            final_price_gross: parseFloat(productData.final_price_gross),
            is_discounted: productData.is_discounted,
            discount_percentage: parseFloat(
              productData.discount_percentage_nett || 0
            ),
            savings: savings,
          },
          badges: {
            is_new: productData.mark_as_new,
            is_featured: productData.mark_as_featured,
            is_top_seller: productData.mark_as_top_seller,
            is_on_sale: productData.is_on_sale || productData.is_discounted,
            free_shipping: productData.shipping_free,
          },
          physical_info: {
            weight: productData.weight,
            weight_unit: productData.weight_unit,
          },
          primary_category: primaryProductCategory,
          tax_info: productData.tax,
          company_info: productData.company,
          created_at: productData.created_at,
          updated_at: productData.updated_at,
          recommendation_score: score,
          recommendation_reasons: [
            ...(categoryOverlap > 0
              ? [`${categoryOverlap} matching categories`]
              : []),
            ...(primaryCategory &&
            productCategories.some((cat) => cat.id === primaryCategory.id)
              ? ["Same primary category"]
              : []),
            ...(priceDifference <= 0.2 ? ["Similar price range"] : []),
            ...(productData.company_id === currentProduct.company_id
              ? ["Same brand"]
              : []),
            ...(productData.mark_as_featured ? ["Featured product"] : []),
            ...(productData.mark_as_top_seller ? ["Top seller"] : []),
            ...(productData.is_on_sale ? ["On sale"] : []),
          ],
        };
      });

      // Sort by score and take the requested limit
      const finalRecommendations = scoredRecommendations
        .sort((a, b) => b.recommendation_score - a.recommendation_score)
        .slice(0, parseInt(limit));

      // Calculate recommendation statistics
      const stats = {
        total_recommendations: finalRecommendations.length,
        average_score:
          finalRecommendations.length > 0
            ? finalRecommendations.reduce(
                (sum, prod) => sum + prod.recommendation_score,
                0
              ) / finalRecommendations.length
            : 0,
        category_matches: finalRecommendations.filter((prod) =>
          prod.recommendation_reasons.some((reason) =>
            reason.includes("category")
          )
        ).length,
        price_similar: finalRecommendations.filter((prod) =>
          prod.recommendation_reasons.includes("Similar price range")
        ).length,
        same_brand: finalRecommendations.filter((prod) =>
          prod.recommendation_reasons.includes("Same brand")
        ).length,
        on_sale_count: finalRecommendations.filter(
          (prod) => prod.badges.is_on_sale
        ).length,
      };

      this.logger.info(
        `Generated ${finalRecommendations.length} recommendations for product: ${currentProduct.title}`
      );

      return {
        status: "success",
        statusCode: 200,
        message: "Recommended products retrieved successfully",
        data: {
          current_product: {
            id: currentProduct.id,
            slug: currentProduct.slug,
            title: currentProduct.title,
            price: parseFloat(currentProduct.final_price_nett),
            categories: currentProduct.categories?.map((cat) => cat.name) || [],
          },
          recommendations: finalRecommendations,
          statistics: stats,
          metadata: {
            limit: parseInt(limit),
            algorithm_version: "1.0",
            factors_considered: [
              "Category similarity",
              "Price range similarity",
              "Brand matching",
              "Product badges",
              "Product popularity",
            ],
            retrieved_at: new Date(),
          },
        },
      };
    } catch (err) {
      this.logger.error(`Error getting recommended products: ${err.message}`);
      throw {
        status: "error",
        statusCode: err.statusCode || 500,
        message: "Failed to retrieve recommended products",
        error: err.message,
      };
    }
  }

  // v4.0
  async searchProducts(params = {}) {
    try {
      const {
        query = "",
        limit = 25,
        offset = 0,
        sort_by = "relevance",
        sort_order = "DESC",
        min_price = "",
        max_price = "",
        filters = {},
        include_out_of_stock = false,
      } = params;

      // Base conditions - these should ALWAYS apply
      const whereConditions = {
        is_active: true,
        is_published: true,
        status: "active",
      };

      // Handle availability filter
      if (!include_out_of_stock) {
        whereConditions.is_available_on_stock = true;
      }

      // Price range filters
      if (min_price && !isNaN(parseFloat(min_price))) {
        whereConditions.final_price_nett = {
          ...whereConditions.final_price_nett,
          [Op.gte]: parseFloat(min_price),
        };
      }

      if (max_price && !isNaN(parseFloat(max_price))) {
        whereConditions.final_price_nett = {
          ...whereConditions.final_price_nett,
          [Op.lte]: parseFloat(max_price),
        };
      }

      // Search query conditions - only add if there's actually a search term
      if (query && query.trim() && query.trim().length > 0) {
        const searchTerm = `%${query.trim()}%`;

        // Create a separate search condition that will be combined with AND logic
        const searchConditions = {
          [Op.or]: [
            { title: { [Op.iLike]: searchTerm } },
            { description: { [Op.iLike]: searchTerm } },
            { short_description: { [Op.iLike]: searchTerm } },
            { sku: { [Op.iLike]: searchTerm } },
            { ean: { [Op.iLike]: searchTerm } },
            // ALSO SEARCH IN CUSTOM_DETAILS
            sequelize.where(
              sequelize.cast(sequelize.col("custom_details"), "text"),
              "ILIKE",
              searchTerm
            ),
          ],
        };

        // Add search conditions to where clause with AND logic
        whereConditions[Op.and] = [
          ...(whereConditions[Op.and] || []),
          searchConditions,
        ];
      }

      // Apply custom_details filters (if provided)
      if (filters && typeof filters === "string") {
        try {
          const parsedFilters = JSON.parse(filters);
          this.applyCustomDetailsFilters(whereConditions, parsedFilters);
        } catch (error) {
          this.logger.error(`Error parsing filters: ${error.message}`);
        }
      } else if (filters && typeof filters === "object") {
        this.applyCustomDetailsFilters(whereConditions, filters);
      }

      // Include conditions
      const includeConditions = [
        {
          model: Tax,
          as: "tax",
          attributes: ["id", "name", "rate"],
          required: false,
        },
      ];

      // Sorting logic
      let orderClause = [["created_at", "DESC"]];
      switch (sort_by) {
        case "price_low_high":
          orderClause = [["final_price_nett", "ASC"]];
          break;
        case "price_high_low":
          orderClause = [["final_price_nett", "DESC"]];
          break;
        case "name_a_z":
          orderClause = [["title", "ASC"]];
          break;
        case "name_z_a":
          orderClause = [["title", "DESC"]];
          break;
        case "newest":
          orderClause = [["created_at", "DESC"]];
          break;
        case "relevance":
        default:
          if (query && query.trim()) {
            orderClause = [
              ["mark_as_featured", "DESC"],
              ["mark_as_top_seller", "DESC"],
              ["is_on_sale", "DESC"],
              ["created_at", "DESC"],
            ];
          } else {
            orderClause = [
              ["mark_as_featured", "DESC"],
              ["mark_as_top_seller", "DESC"],
              ["created_at", "DESC"],
            ];
          }
          break;
      }

      // Log the search conditions for debugging
      this.logger.info(
        `Search conditions for query "${query}":`,
        JSON.stringify(whereConditions, null, 2)
      );

      // Get products with count
      const { rows: products, count: totalCount } =
        await Product.findAndCountAll({
          where: whereConditions,
          include: includeConditions,
          limit: parseInt(limit),
          offset: parseInt(offset),
          order: orderClause,
          attributes: [
            "id",
            "sku",
            "slug",
            "title",
            "description",
            "short_description",
            "main_image_url",
            "images",
            "regular_price_nett",
            "regular_price_gross",
            "final_price_nett",
            "final_price_gross",
            "is_discounted",
            "discount_percentage_nett",
            "mark_as_new",
            "mark_as_featured",
            "mark_as_top_seller",
            "is_on_sale",
            "shipping_free",
            "weight",
            "weight_unit",
            "custom_details",
            "created_at",
            "updated_at",
            "width",
            "height",
            "length",
            "depth",
            "thickness",
            "measures_unit",
            "unit_type",
            "is_digital",
            "is_physical",
            "is_available_on_stock",
          ],
          distinct: true,
          subQuery: false,
        });

      // Transform products
      const transformedProducts = products.map((product) => {
        const productData = product.toJSON();

        const savings = productData.is_discounted
          ? {
              savings_nett:
                parseFloat(productData.regular_price_nett) -
                parseFloat(productData.final_price_nett),
              savings_gross:
                parseFloat(productData.regular_price_gross) -
                parseFloat(productData.final_price_gross),
              savings_percentage: parseFloat(
                productData.discount_percentage_nett || 0
              ),
            }
          : null;

        const formattedImages =
          productData.images && productData.images.length > 0
            ? productData.images
            : productData.main_image_url
            ? [
                {
                  url: productData.main_image_url,
                  alt_text: productData.title,
                  is_main: true,
                },
              ]
            : [];

        return {
          id: productData.id,
          sku: productData.sku,
          slug: productData.slug,
          title: productData.title,
          description: productData.description,
          short_description: productData.short_description,
          main_image_url: productData.main_image_url,
          images: formattedImages,
          pricing: {
            regular_price_nett: parseFloat(productData.regular_price_nett),
            regular_price_gross: parseFloat(productData.regular_price_gross),
            final_price_nett: parseFloat(productData.final_price_nett),
            final_price_gross: parseFloat(productData.final_price_gross),
            is_discounted: productData.is_discounted,
            discount_percentage: parseFloat(
              productData.discount_percentage_nett || 0
            ),
            savings: savings,
          },
          badges: {
            is_new: productData.mark_as_new,
            is_featured: productData.mark_as_featured,
            is_top_seller: productData.mark_as_top_seller,
            is_on_sale: productData.is_on_sale || productData.is_discounted,
            free_shipping: productData.shipping_free,
          },
          physical_info: {
            weight: productData.weight,
            weight_unit: productData.weight_unit,
            dimensions: {
              width: productData.width,
              height: productData.height,
              length: productData.length,
              depth: productData.depth,
              thickness: productData.thickness,
              unit: productData.measures_unit,
            },
          },
          product_type: {
            is_digital: productData.is_digital,
            is_physical: productData.is_physical,
            unit_type: productData.unit_type,
          },
          availability: {
            is_available: productData.is_available_on_stock,
            status: productData.is_available_on_stock
              ? "In Stock"
              : "Out of Stock",
          },
          tax_info: productData.tax,
          custom_details: productData.custom_details || [],
          created_at: productData.created_at,
          updated_at: productData.updated_at,
        };
      });

      const hasMore = offset + limit < totalCount;
      const nextOffset = hasMore ? offset + limit : null;

      this.logger.info(
        `Search completed: ${transformedProducts.length} products found for query: "${query}"`
      );

      // AUTO-GENERATE AVAILABLE FILTERS from found products' custom_details
      const availableFilters = this.extractAutomaticFilters(products);

      return {
        status: "success",
        statusCode: 200,
        message: "Search completed successfully",
        data: {
          products: transformedProducts,
          pagination: {
            total_count: totalCount,
            current_offset: parseInt(offset),
            limit: parseInt(limit),
            has_more: hasMore,
            next_offset: nextOffset,
            current_page: Math.floor(offset / limit) + 1,
            total_pages: Math.ceil(totalCount / limit),
          },
          // Auto-generated filters from custom_details
          available_filters: availableFilters,
          search_info: {
            query: query,
            sort_by: sort_by,
            sort_order: sort_order,
            filters_applied: {
              price_range: {
                min_price: min_price ? parseFloat(min_price) : null,
                max_price: max_price ? parseFloat(max_price) : null,
              },
              include_out_of_stock: include_out_of_stock,
              custom_filters: filters,
            },
            result_count: totalCount,
            search_time: new Date(),
          },
        },
      };
    } catch (err) {
      this.logger.error(`Error in product search: ${err.message}`);
      this.logger.error(`Stack trace: ${err.stack}`);
      throw {
        status: "error",
        statusCode: 500,
        message: "Search failed",
        error: err.message,
      };
    }
  }

  // Method to extract automatic filters from products
  extractAutomaticFilters(products) {
    try {
      const filters = {
        // Price range filter (like "Filtro sipas çmimit" in your image)
        price_range: {
          type: "range",
          label: "Price Range",
          min: 0,
          max: 0,
          current_range: { min: 0, max: 0 },
        },
        // Availability filter (In Stock/Out of Stock)
        availability: {
          type: "checkbox",
          label: "Availability",
          options: [],
        },
        // Dynamic filters based on custom_details (like "Filtro sipas cilësive" in your image)
        specifications: {},
      };

      if (products.length === 0) {
        return filters;
      }

      // Generate price range filter
      const prices = products
        .map((p) => parseFloat(p.final_price_nett))
        .filter((p) => !isNaN(p));

      if (prices.length > 0) {
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);

        filters.price_range = {
          type: "range",
          label: "Price Range",
          min: Math.floor(minPrice),
          max: Math.ceil(maxPrice),
          current_range: {
            min: Math.floor(minPrice),
            max: Math.ceil(maxPrice),
          },
          formatted_range: `${Math.floor(minPrice)} Euro - ${Math.ceil(
            maxPrice
          )} Euro`,
        };
      }

      // Generate availability filter
      const availabilityCount = {
        in_stock: products.filter((p) => p.is_available_on_stock).length,
        out_of_stock: products.filter((p) => !p.is_available_on_stock).length,
      };

      filters.availability = {
        type: "checkbox",
        label: "Availability",
        options: [
          {
            value: "in_stock",
            label: "In Stock",
            count: availabilityCount.in_stock,
          },
          {
            value: "out_of_stock",
            label: "Out of Stock",
            count: availabilityCount.out_of_stock,
          },
        ].filter((option) => option.count > 0),
      };

      // AUTO-EXTRACT specifications from custom_details
      const specificationsMap = new Map();

      products.forEach((product) => {
        if (product.custom_details && Array.isArray(product.custom_details)) {
          product.custom_details.forEach((detail) => {
            if (detail.key && detail.value) {
              const key = detail.key.trim();
              const value = detail.value.toString().trim();

              if (!specificationsMap.has(key)) {
                specificationsMap.set(key, {
                  type: "dropdown", // Similar to dropdown in your image
                  label: this._generateUserFriendlyLabel(key),
                  values: new Map(),
                });
              }

              const specGroup = specificationsMap.get(key);
              const existing = specGroup.values.get(value) || {
                value: value,
                label: value,
                count: 0,
              };
              existing.count++;
              specGroup.values.set(value, existing);
            }
          });
        }
      });

      // Convert to final format
      specificationsMap.forEach((specData, key) => {
        const values = Array.from(specData.values.values());

        // Only include specifications that have multiple options or significant count
        if (values.length > 0) {
          filters.specifications[key] = {
            type: specData.type,
            label: specData.label,
            options: values.sort((a, b) => b.count - a.count),
            total_products: values.reduce((sum, v) => sum + v.count, 0),
          };
        }
      });

      // Sort specifications by most common first
      const sortedSpecs = Object.entries(filters.specifications)
        .sort(([, a], [, b]) => b.total_products - a.total_products)
        .reduce((acc, [key, value]) => {
          acc[key] = value;
          return acc;
        }, {});

      filters.specifications = sortedSpecs;

      this.logger.info(
        `Auto-generated ${
          Object.keys(filters.specifications).length
        } specification filters from ${products.length} products`
      );

      return filters;
    } catch (error) {
      this.logger.error(`Error extracting automatic filters: ${error.message}`);
      return {
        price_range: { type: "range", label: "Price Range", min: 0, max: 0 },
        availability: { type: "checkbox", label: "Availability", options: [] },
        specifications: {},
      };
    }
  }

  // Enhanced method to apply custom_details filters
  applyCustomDetailsFilters(whereConditions, filters = {}) {
    // Handle specification filters from custom_details
    if (
      filters.specifications &&
      Object.keys(filters.specifications).length > 0
    ) {
      Object.entries(filters.specifications).forEach(([key, values]) => {
        if (Array.isArray(values) && values.length > 0) {
          const specConditions = values.map((value) =>
            sequelize.where(
              sequelize.cast(sequelize.col("custom_details"), "text"),
              "ILIKE",
              `%"${key}"%"${value}"%`
            )
          );

          whereConditions[Op.and] = [
            ...(whereConditions[Op.and] || []),
            {
              [Op.or]: specConditions,
            },
          ];
        }
      });
    }

    // Handle other existing filters (materials, colors, etc.)
    if (filters.materials && filters.materials.length > 0) {
      const materialConditions = filters.materials.map((material) =>
        sequelize.where(
          sequelize.cast(sequelize.col("custom_details"), "text"),
          "ILIKE",
          `%"material"%"${material}"%`
        )
      );
      whereConditions[Op.and] = [
        ...(whereConditions[Op.and] || []),
        {
          [Op.or]: materialConditions,
        },
      ];
    }

    if (filters.colors && filters.colors.length > 0) {
      const colorConditions = filters.colors.map((color) =>
        sequelize.where(
          sequelize.cast(sequelize.col("custom_details"), "text"),
          "ILIKE",
          `%"color"%"${color}"%`
        )
      );
      whereConditions[Op.and] = [
        ...(whereConditions[Op.and] || []),
        {
          [Op.or]: colorConditions,
        },
      ];
    }

    return whereConditions;
  }

  // Helper method to generate user-friendly labels from attribute keys
  _generateUserFriendlyLabel(attributeKey) {
    // Convert camelCase or snake_case to Title Case
    const words = attributeKey
      .replace(/([A-Z])/g, " $1") // Split camelCase
      .replace(/_/g, " ") // Replace underscores with spaces
      .replace(/-/g, " ") // Replace hyphens with spaces
      .toLowerCase()
      .split(" ")
      .filter((word) => word.length > 0)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1));

    return words.join(" ");
  }

  // Get products by category with filters and facets - same as search but filtered by category
  // async getProductsByCategory(categoryId, params = {}) {
  //   try {
  //     const {
  //       limit = 25,
  //       offset = 0,
  //       sort_by = "relevance",
  //       sort_order = "DESC",
  //       min_price = "",
  //       max_price = "",
  //       filters = {},
  //       include_out_of_stock = false,
  //     } = params;

  //     // Validate category ID
  //     if (!categoryId || typeof categoryId !== "string") {
  //       throw {
  //         status: "error",
  //         statusCode: 400,
  //         message: "Valid category ID is required",
  //       };
  //     }

  //     // Verify category exists and is active
  //     const category = await Category.findOne({
  //       where: {
  //         id: categoryId,
  //         is_active: true,
  //       },
  //     });

  //     if (!category) {
  //       throw {
  //         status: "error",
  //         statusCode: 404,
  //         message: "Category not found or is inactive",
  //       };
  //     }

  //     // Base conditions - these should ALWAYS apply
  //     const whereConditions = {
  //       is_active: true,
  //       is_published: true,
  //       status: "active",
  //     };

  //     // Handle availability filter
  //     if (!include_out_of_stock) {
  //       whereConditions.is_available_on_stock = true;
  //     }

  //     // Price range filters
  //     if (min_price && !isNaN(parseFloat(min_price))) {
  //       whereConditions.final_price_nett = {
  //         ...whereConditions.final_price_nett,
  //         [Op.gte]: parseFloat(min_price),
  //       };
  //     }

  //     if (max_price && !isNaN(parseFloat(max_price))) {
  //       whereConditions.final_price_nett = {
  //         ...whereConditions.final_price_nett,
  //         [Op.lte]: parseFloat(max_price),
  //       };
  //     }

  //     // Apply custom_details filters
  //     if (filters && typeof filters === "string") {
  //       try {
  //         const parsedFilters = JSON.parse(filters);
  //         this.applyCustomDetailsFilters(whereConditions, parsedFilters);
  //       } catch (error) {
  //         this.logger.error(`Error parsing filters: ${error.message}`);
  //       }
  //     } else if (filters && typeof filters === "object") {
  //       this.applyCustomDetailsFilters(whereConditions, filters);
  //     }

  //     // Include conditions with category filter
  //     const includeConditions = [
  //       {
  //         model: Tax,
  //         as: "tax",
  //         attributes: ["id", "name", "rate"],
  //         required: false,
  //       },
  //       {
  //         model: Category,
  //         as: "categories",
  //         attributes: ["id", "name", "slug", "description"],
  //         through: {
  //           attributes: ["is_primary"],
  //         },
  //         required: true, // This ensures only products with categories are returned
  //         where: {
  //           id: categoryId,
  //           is_active: true,
  //         },
  //       },
  //     ];

  //     // Sorting logic
  //     let orderClause = [["created_at", "DESC"]];
  //     switch (sort_by) {
  //       case "price_low_high":
  //         orderClause = [["final_price_nett", "ASC"]];
  //         break;
  //       case "price_high_low":
  //         orderClause = [["final_price_nett", "DESC"]];
  //         break;
  //       case "name_a_z":
  //         orderClause = [["title", "ASC"]];
  //         break;
  //       case "name_z_a":
  //         orderClause = [["title", "DESC"]];
  //         break;
  //       case "newest":
  //         orderClause = [["created_at", "DESC"]];
  //         break;
  //       case "relevance":
  //       default:
  //         orderClause = [
  //           ["mark_as_featured", "DESC"],
  //           ["mark_as_top_seller", "DESC"],
  //           ["is_on_sale", "DESC"],
  //           ["created_at", "DESC"],
  //         ];
  //         break;
  //     }

  //     // Log the search conditions for debugging
  //     this.logger.info(
  //       `Category products conditions for category "${categoryId}":`,
  //       JSON.stringify(whereConditions, null, 2)
  //     );

  //     // Get products with count
  //     const { rows: products, count: totalCount } =
  //       await Product.findAndCountAll({
  //         where: whereConditions,
  //         include: includeConditions,
  //         limit: parseInt(limit),
  //         offset: parseInt(offset),
  //         order: orderClause,
  //         attributes: [
  //           "id",
  //           "sku",
  //           "slug",
  //           "title",
  //           "description",
  //           "short_description",
  //           "main_image_url",
  //           "images",
  //           "regular_price_nett",
  //           "regular_price_gross",
  //           "final_price_nett",
  //           "final_price_gross",
  //           "is_discounted",
  //           "discount_percentage_nett",
  //           "mark_as_new",
  //           "mark_as_featured",
  //           "mark_as_top_seller",
  //           "is_on_sale",
  //           "shipping_free",
  //           "weight",
  //           "weight_unit",
  //           "custom_details",
  //           "created_at",
  //           "updated_at",
  //           "width",
  //           "height",
  //           "length",
  //           "depth",
  //           "thickness",
  //           "measures_unit",
  //           "unit_type",
  //           "is_digital",
  //           "is_physical",
  //           "is_available_on_stock",
  //         ],
  //         distinct: true,
  //         subQuery: false,
  //       });

  //     // Generate enhanced facets with user-friendly labels
  //     const facets = await this.generateDynamicFacets(products, "");

  //     // Transform products (same as search)
  //     const transformedProducts = products.map((product) => {
  //       const productData = product.toJSON();

  //       const savings = productData.is_discounted
  //         ? {
  //             savings_nett:
  //               parseFloat(productData.regular_price_nett) -
  //               parseFloat(productData.final_price_nett),
  //             savings_gross:
  //               parseFloat(productData.regular_price_gross) -
  //               parseFloat(productData.final_price_gross),
  //             savings_percentage: parseFloat(
  //               productData.discount_percentage_nett || 0
  //             ),
  //           }
  //         : null;

  //       const formattedImages =
  //         productData.images && productData.images.length > 0
  //           ? productData.images
  //           : productData.main_image_url
  //           ? [
  //               {
  //                 url: productData.main_image_url,
  //                 alt_text: productData.title,
  //                 is_main: true,
  //               },
  //             ]
  //           : [];

  //       // Get the primary category or the requested category
  //       const primaryCategory =
  //         productData.categories && productData.categories.length > 0
  //           ? productData.categories.find(
  //               (cat) => cat.ProductCategory?.is_primary
  //             ) || productData.categories[0]
  //           : null;

  //       return {
  //         id: productData.id,
  //         sku: productData.sku,
  //         slug: productData.slug,
  //         title: productData.title,
  //         description: productData.description,
  //         short_description: productData.short_description,
  //         main_image_url: productData.main_image_url,
  //         images: formattedImages,
  //         pricing: {
  //           regular_price_nett: parseFloat(productData.regular_price_nett),
  //           regular_price_gross: parseFloat(productData.regular_price_gross),
  //           final_price_nett: parseFloat(productData.final_price_nett),
  //           final_price_gross: parseFloat(productData.final_price_gross),
  //           is_discounted: productData.is_discounted,
  //           discount_percentage: parseFloat(
  //             productData.discount_percentage_nett || 0
  //           ),
  //           savings: savings,
  //         },
  //         badges: {
  //           is_new: productData.mark_as_new,
  //           is_featured: productData.mark_as_featured,
  //           is_top_seller: productData.mark_as_top_seller,
  //           is_on_sale: productData.is_on_sale || productData.is_discounted,
  //           free_shipping: productData.shipping_free,
  //         },
  //         physical_info: {
  //           weight: productData.weight,
  //           weight_unit: productData.weight_unit,
  //           dimensions: {
  //             width: productData.width,
  //             height: productData.height,
  //             length: productData.length,
  //             depth: productData.depth,
  //             thickness: productData.thickness,
  //             unit: productData.measures_unit,
  //           },
  //         },
  //         product_type: {
  //           is_digital: productData.is_digital,
  //           is_physical: productData.is_physical,
  //           unit_type: productData.unit_type,
  //         },
  //         availability: {
  //           is_available: productData.is_available_on_stock,
  //           status: productData.is_available_on_stock
  //             ? "In Stock"
  //             : "Out of Stock",
  //         },
  //         primary_category: primaryCategory,
  //         categories: productData.categories || [],
  //         tax_info: productData.tax,
  //         custom_details: productData.custom_details || [],
  //         created_at: productData.created_at,
  //         updated_at: productData.updated_at,
  //       };
  //     });

  //     const hasMore = offset + limit < totalCount;
  //     const nextOffset = hasMore ? offset + limit : null;

  //     this.logger.info(
  //       `Category products completed: ${transformedProducts.length} products found for category: "${category.name}"`
  //     );

  //     return {
  //       status: "success",
  //       statusCode: 200,
  //       message: "Category products retrieved successfully",
  //       data: {
  //         category: {
  //           id: category.id,
  //           name: category.name,
  //           slug: category.slug,
  //           description: category.description,
  //           image_url: category.image_url,
  //           level: category.level,
  //           parent_id: category.parent_id,
  //         },
  //         products: transformedProducts,
  //         pagination: {
  //           total_count: totalCount,
  //           current_offset: parseInt(offset),
  //           limit: parseInt(limit),
  //           has_more: hasMore,
  //           next_offset: nextOffset,
  //           current_page: Math.floor(offset / limit) + 1,
  //           total_pages: Math.ceil(totalCount / limit),
  //         },
  //         facets: facets,
  //         filter_info: {
  //           category_id: categoryId,
  //           category_name: category.name,
  //           sort_by: sort_by,
  //           sort_order: sort_order,
  //           filters_applied: {
  //             price_range: {
  //               min_price: min_price ? parseFloat(min_price) : null,
  //               max_price: max_price ? parseFloat(max_price) : null,
  //             },
  //             include_out_of_stock: include_out_of_stock,
  //             custom_filters: filters,
  //           },
  //           result_count: totalCount,
  //           retrieved_at: new Date(),
  //         },
  //       },
  //     };
  //   } catch (err) {
  //     this.logger.error(`Error in getProductsByCategory: ${err.message}`);
  //     this.logger.error(`Stack trace: ${err.stack}`);
  //     throw {
  //       status: "error",
  //       statusCode: err.statusCode || 500,
  //       message: err.message || "Failed to retrieve category products",
  //       error: err.message,
  //     };
  //   }
  // }

  // v1.2
  // Get products by category with filters and facets - UPDATED to match searchProducts exactly
  async getProductsByCategory(categoryId, params = {}) {
    try {
      const {
        limit = 25,
        offset = 0,
        sort_by = "relevance",
        sort_order = "DESC",
        min_price = "",
        max_price = "",
        filters = {},
        include_out_of_stock = false,
      } = params;

      // Validate category ID
      if (!categoryId || typeof categoryId !== "string") {
        throw {
          status: "error",
          statusCode: 400,
          message: "Valid category ID is required",
        };
      }

      // Verify category exists and is active
      const category = await Category.findOne({
        where: {
          id: categoryId,
          is_active: true,
        },
      });

      if (!category) {
        throw {
          status: "error",
          statusCode: 404,
          message: "Category not found or is inactive",
        };
      }

      // Base conditions - these should ALWAYS apply
      const whereConditions = {
        is_active: true,
        is_published: true,
        status: "active",
      };

      // Handle availability filter
      if (!include_out_of_stock) {
        whereConditions.is_available_on_stock = true;
      }

      // Price range filters
      if (min_price && !isNaN(parseFloat(min_price))) {
        whereConditions.final_price_nett = {
          ...whereConditions.final_price_nett,
          [Op.gte]: parseFloat(min_price),
        };
      }

      if (max_price && !isNaN(parseFloat(max_price))) {
        whereConditions.final_price_nett = {
          ...whereConditions.final_price_nett,
          [Op.lte]: parseFloat(max_price),
        };
      }

      // Apply custom_details filters (if provided)
      if (filters && typeof filters === "string") {
        try {
          const parsedFilters = JSON.parse(filters);
          this.applyCustomDetailsFilters(whereConditions, parsedFilters);
        } catch (error) {
          this.logger.error(`Error parsing filters: ${error.message}`);
        }
      } else if (filters && typeof filters === "object") {
        this.applyCustomDetailsFilters(whereConditions, filters);
      }

      // Include conditions with category filter
      const includeConditions = [
        {
          model: Tax,
          as: "tax",
          attributes: ["id", "name", "rate"],
          required: false,
        },
        {
          model: Category,
          as: "categories",
          attributes: ["id", "name", "slug", "description"],
          through: {
            attributes: ["is_primary"],
          },
          required: true, // This ensures only products with categories are returned
          where: {
            id: categoryId,
            is_active: true,
          },
        },
      ];

      // Sorting logic
      let orderClause = [["created_at", "DESC"]];
      switch (sort_by) {
        case "price_low_high":
          orderClause = [["final_price_nett", "ASC"]];
          break;
        case "price_high_low":
          orderClause = [["final_price_nett", "DESC"]];
          break;
        case "name_a_z":
          orderClause = [["title", "ASC"]];
          break;
        case "name_z_a":
          orderClause = [["title", "DESC"]];
          break;
        case "newest":
          orderClause = [["created_at", "DESC"]];
          break;
        case "relevance":
        default:
          orderClause = [
            ["mark_as_featured", "DESC"],
            ["mark_as_top_seller", "DESC"],
            ["is_on_sale", "DESC"],
            ["created_at", "DESC"],
          ];
          break;
      }

      // Log the search conditions for debugging
      this.logger.info(
        `Category products conditions for category "${categoryId}":`,
        JSON.stringify(whereConditions, null, 2)
      );

      // Get products with count
      const { rows: products, count: totalCount } =
        await Product.findAndCountAll({
          where: whereConditions,
          include: includeConditions,
          limit: parseInt(limit),
          offset: parseInt(offset),
          order: orderClause,
          attributes: [
            "id",
            "sku",
            "slug",
            "title",
            "description",
            "short_description",
            "main_image_url",
            "images",
            "regular_price_nett",
            "regular_price_gross",
            "final_price_nett",
            "final_price_gross",
            "is_discounted",
            "discount_percentage_nett",
            "mark_as_new",
            "mark_as_featured",
            "mark_as_top_seller",
            "is_on_sale",
            "shipping_free",
            "weight",
            "weight_unit",
            "custom_details",
            "created_at",
            "updated_at",
            "width",
            "height",
            "length",
            "depth",
            "thickness",
            "measures_unit",
            "unit_type",
            "is_digital",
            "is_physical",
            "is_available_on_stock",
          ],
          distinct: true,
          subQuery: false,
        });

      // Transform products (same as search)
      const transformedProducts = products.map((product) => {
        const productData = product.toJSON();

        const savings = productData.is_discounted
          ? {
              savings_nett:
                parseFloat(productData.regular_price_nett) -
                parseFloat(productData.final_price_nett),
              savings_gross:
                parseFloat(productData.regular_price_gross) -
                parseFloat(productData.final_price_gross),
              savings_percentage: parseFloat(
                productData.discount_percentage_nett || 0
              ),
            }
          : null;

        const formattedImages =
          productData.images && productData.images.length > 0
            ? productData.images
            : productData.main_image_url
            ? [
                {
                  url: productData.main_image_url,
                  alt_text: productData.title,
                  is_main: true,
                },
              ]
            : [];

        // Get the primary category or the requested category
        const primaryCategory =
          productData.categories && productData.categories.length > 0
            ? productData.categories.find(
                (cat) => cat.ProductCategory?.is_primary
              ) || productData.categories[0]
            : null;

        return {
          id: productData.id,
          sku: productData.sku,
          slug: productData.slug,
          title: productData.title,
          description: productData.description,
          short_description: productData.short_description,
          main_image_url: productData.main_image_url,
          images: formattedImages,
          pricing: {
            regular_price_nett: parseFloat(productData.regular_price_nett),
            regular_price_gross: parseFloat(productData.regular_price_gross),
            final_price_nett: parseFloat(productData.final_price_nett),
            final_price_gross: parseFloat(productData.final_price_gross),
            is_discounted: productData.is_discounted,
            discount_percentage: parseFloat(
              productData.discount_percentage_nett || 0
            ),
            savings: savings,
          },
          badges: {
            is_new: productData.mark_as_new,
            is_featured: productData.mark_as_featured,
            is_top_seller: productData.mark_as_top_seller,
            is_on_sale: productData.is_on_sale || productData.is_discounted,
            free_shipping: productData.shipping_free,
          },
          physical_info: {
            weight: productData.weight,
            weight_unit: productData.weight_unit,
            dimensions: {
              width: productData.width,
              height: productData.height,
              length: productData.length,
              depth: productData.depth,
              thickness: productData.thickness,
              unit: productData.measures_unit,
            },
          },
          product_type: {
            is_digital: productData.is_digital,
            is_physical: productData.is_physical,
            unit_type: productData.unit_type,
          },
          availability: {
            is_available: productData.is_available_on_stock,
            status: productData.is_available_on_stock
              ? "In Stock"
              : "Out of Stock",
          },
          primary_category: primaryCategory,
          categories: productData.categories || [],
          tax_info: productData.tax,
          custom_details: productData.custom_details || [],
          created_at: productData.created_at,
          updated_at: productData.updated_at,
        };
      });

      const hasMore = offset + limit < totalCount;
      const nextOffset = hasMore ? offset + limit : null;

      this.logger.info(
        `Category products completed: ${transformedProducts.length} products found for category: "${category.name}"`
      );

      // AUTO-GENERATE AVAILABLE FILTERS from found products' custom_details (SAME AS SEARCH)
      const availableFilters = this.extractAutomaticFilters(products);

      return {
        status: "success",
        statusCode: 200,
        message: "Category products retrieved successfully",
        data: {
          category: {
            id: category.id,
            name: category.name,
            slug: category.slug,
            description: category.description,
            image_url: category.image_url,
            level: category.level,
            parent_id: category.parent_id,
          },
          products: transformedProducts,
          pagination: {
            total_count: totalCount,
            current_offset: parseInt(offset),
            limit: parseInt(limit),
            has_more: hasMore,
            next_offset: nextOffset,
            current_page: Math.floor(offset / limit) + 1,
            total_pages: Math.ceil(totalCount / limit),
          },
          // Auto-generated filters from custom_details (SAME AS SEARCH)
          available_filters: availableFilters,
          search_info: {
            query: "", // No search query for category browsing
            sort_by: sort_by,
            sort_order: sort_order,
            filters_applied: {
              price_range: {
                min_price: min_price ? parseFloat(min_price) : null,
                max_price: max_price ? parseFloat(max_price) : null,
              },
              include_out_of_stock: include_out_of_stock,
              custom_filters: filters,
            },
            result_count: totalCount,
            search_time: new Date(),
          },
          filter_info: {
            category_id: categoryId,
            category_name: category.name,
            sort_by: sort_by,
            sort_order: sort_order,
            filters_applied: {
              price_range: {
                min_price: min_price ? parseFloat(min_price) : null,
                max_price: max_price ? parseFloat(max_price) : null,
              },
              include_out_of_stock: include_out_of_stock,
              custom_filters: filters,
            },
            result_count: totalCount,
            retrieved_at: new Date(),
          },
        },
      };
    } catch (err) {
      this.logger.error(`Error in getProductsByCategory: ${err.message}`);
      this.logger.error(`Stack trace: ${err.stack}`);
      throw {
        status: "error",
        statusCode: err.statusCode || 500,
        message: err.message || "Failed to retrieve category products",
        error: err.message,
      };
    }
  }

  // Get flash deals with advanced filters - same filtering system as searchProducts
  async getFlashDeals(params = {}) {
    try {
      const {
        limit = 25,
        offset = 0,
        sort_by = "discount_percentage",
        sort_order = "DESC",
        min_price = "",
        max_price = "",
        min_discount = 10, // Minimum discount percentage for flash deals
        max_discount = "", // Maximum discount percentage filter
        filters = {},
        include_out_of_stock = false,
        category_id = "",
      } = params;

      // Base conditions for flash deals - these should ALWAYS apply
      const whereConditions = {
        is_active: true,
        is_published: true,
        status: "active",
        is_discounted: true, // Must be discounted to be a flash deal
        discount_percentage_nett: {
          [Op.gte]: parseFloat(min_discount), // Minimum discount threshold
        },
      };

      // Handle availability filter
      if (!include_out_of_stock) {
        whereConditions.is_available_on_stock = true;
      }

      // Price range filters (on final discounted price)
      if (min_price && !isNaN(parseFloat(min_price))) {
        whereConditions.final_price_nett = {
          ...whereConditions.final_price_nett,
          [Op.gte]: parseFloat(min_price),
        };
      }

      if (max_price && !isNaN(parseFloat(max_price))) {
        whereConditions.final_price_nett = {
          ...whereConditions.final_price_nett,
          [Op.lte]: parseFloat(max_price),
        };
      }

      // Maximum discount filter (if specified)
      if (max_discount && !isNaN(parseFloat(max_discount))) {
        whereConditions.discount_percentage_nett = {
          ...whereConditions.discount_percentage_nett,
          [Op.lte]: parseFloat(max_discount),
        };
      }

      // Apply custom_details filters (same as search and category methods)
      if (filters && typeof filters === "string") {
        try {
          const parsedFilters = JSON.parse(filters);
          this.applyCustomDetailsFilters(whereConditions, parsedFilters);
        } catch (error) {
          this.logger.error(`Error parsing filters: ${error.message}`);
        }
      } else if (filters && typeof filters === "object") {
        this.applyCustomDetailsFilters(whereConditions, filters);
      }

      // Include conditions
      const includeConditions = [
        {
          model: Tax,
          as: "tax",
          attributes: ["id", "name", "rate"],
          required: false,
        },
        {
          model: Company,
          as: "company",
          attributes: ["id", "business_name", "market_name", "logo_url"],
          required: false,
        },
      ];

      // Add category filter if specified
      if (category_id && this._isValidUUID(category_id)) {
        includeConditions.push({
          model: Category,
          as: "categories",
          attributes: ["id", "name", "slug", "description"],
          through: {
            attributes: ["is_primary"],
          },
          required: true,
          where: {
            id: category_id,
            is_active: true,
          },
        });
      } else {
        // Include categories for display purposes
        includeConditions.push({
          model: Category,
          as: "categories",
          attributes: ["id", "name", "slug", "description"],
          through: {
            attributes: ["is_primary"],
          },
          required: false,
          where: {
            is_active: true,
          },
        });
      }

      // Enhanced sorting logic for flash deals
      let orderClause = [["discount_percentage_nett", "DESC"]];
      switch (sort_by) {
        case "discount_percentage":
        case "discount_high_low":
          orderClause = [
            ["discount_percentage_nett", "DESC"],
            ["created_at", "DESC"],
          ];
          break;
        case "discount_low_high":
          orderClause = [
            ["discount_percentage_nett", "ASC"],
            ["created_at", "DESC"],
          ];
          break;
        case "savings_high_low":
          // Sort by absolute savings amount (regular - final)
          orderClause = [
            [
              sequelize.literal("(regular_price_nett - final_price_nett)"),
              "DESC",
            ],
            ["discount_percentage_nett", "DESC"],
          ];
          break;
        case "savings_low_high":
          orderClause = [
            [
              sequelize.literal("(regular_price_nett - final_price_nett)"),
              "ASC",
            ],
            ["discount_percentage_nett", "ASC"],
          ];
          break;
        case "price_low_high":
          orderClause = [
            ["final_price_nett", "ASC"],
            ["discount_percentage_nett", "DESC"],
          ];
          break;
        case "price_high_low":
          orderClause = [
            ["final_price_nett", "DESC"],
            ["discount_percentage_nett", "DESC"],
          ];
          break;
        case "name_a_z":
          orderClause = [
            ["title", "ASC"],
            ["discount_percentage_nett", "DESC"],
          ];
          break;
        case "name_z_a":
          orderClause = [
            ["title", "DESC"],
            ["discount_percentage_nett", "DESC"],
          ];
          break;
        case "newest":
          orderClause = [
            ["created_at", "DESC"],
            ["discount_percentage_nett", "DESC"],
          ];
          break;
        case "urgency":
          // Sort by deal urgency (highest discount + special flags)
          orderClause = [
            ["is_special_offer", "DESC"],
            ["is_on_sale", "DESC"],
            ["discount_percentage_nett", "DESC"],
            ["mark_as_featured", "DESC"],
            ["created_at", "DESC"],
          ];
          break;
        case "popularity":
          orderClause = [
            ["mark_as_top_seller", "DESC"],
            ["mark_as_featured", "DESC"],
            ["discount_percentage_nett", "DESC"],
            ["created_at", "DESC"],
          ];
          break;
        default:
          orderClause = [
            ["discount_percentage_nett", "DESC"],
            ["is_special_offer", "DESC"],
            ["is_on_sale", "DESC"],
            ["created_at", "DESC"],
          ];
          break;
      }

      // Log the flash deals conditions for debugging
      this.logger.info(
        `Flash deals conditions:`,
        JSON.stringify(whereConditions, null, 2)
      );

      // Get flash deals products with count
      const { rows: products, count: totalCount } =
        await Product.findAndCountAll({
          where: whereConditions,
          include: includeConditions,
          limit: parseInt(limit),
          offset: parseInt(offset),
          order: orderClause,
          attributes: [
            "id",
            "sku",
            "slug",
            "title",
            "description",
            "short_description",
            "main_image_url",
            "images",
            "regular_price_nett",
            "regular_price_gross",
            "final_price_nett",
            "final_price_gross",
            "is_discounted",
            "discount_percentage_nett",
            "discount_percentage_gross",
            "mark_as_new",
            "mark_as_featured",
            "mark_as_top_seller",
            "is_on_sale",
            "is_special_offer",
            "shipping_free",
            "weight",
            "weight_unit",
            "custom_details",
            "created_at",
            "updated_at",
            "width",
            "height",
            "length",
            "depth",
            "thickness",
            "measures_unit",
            "unit_type",
            "is_digital",
            "is_physical",
            "is_available_on_stock",
            // Calculate savings for sorting
            [
              sequelize.literal("(regular_price_nett - final_price_nett)"),
              "savings_amount_nett",
            ],
            [
              sequelize.literal("(regular_price_gross - final_price_gross)"),
              "savings_amount_gross",
            ],
          ],
          distinct: true,
          subQuery: false,
        });

      // Transform products with enhanced flash deal information
      const transformedProducts = products.map((product) => {
        const productData = product.toJSON();

        // Enhanced pricing calculations for flash deals
        const regularPriceNett = parseFloat(productData.regular_price_nett);
        const regularPriceGross = parseFloat(productData.regular_price_gross);
        const finalPriceNett = parseFloat(productData.final_price_nett);
        const finalPriceGross = parseFloat(productData.final_price_gross);
        const discountPercentage = parseFloat(
          productData.discount_percentage_nett || 0
        );

        const savingsNett = regularPriceNett - finalPriceNett;
        const savingsGross = regularPriceGross - finalPriceGross;

        // Determine flash deal urgency and type
        let dealUrgency = "medium";
        let dealType = "flash_deal";

        if (discountPercentage >= 70) {
          dealUrgency = "critical";
          dealType = "mega_deal";
        } else if (discountPercentage >= 50) {
          dealUrgency = "high";
          dealType = "super_deal";
        } else if (discountPercentage >= 30) {
          dealUrgency = "medium";
          dealType = "great_deal";
        } else if (discountPercentage >= 20) {
          dealUrgency = "moderate";
          dealType = "good_deal";
        } else {
          dealUrgency = "low";
          dealType = "standard_deal";
        }

        // Override with special flags
        if (productData.is_special_offer) {
          dealType = "special_offer";
          dealUrgency = "high";
        }

        if (productData.is_on_sale) {
          if (dealType === "special_offer") {
            dealType = "special_flash_sale";
          } else {
            dealType = "flash_sale";
          }
        }

        // Get primary category
        const primaryCategory =
          productData.categories && productData.categories.length > 0
            ? productData.categories.find(
                (cat) => cat.ProductCategory?.is_primary
              ) || productData.categories[0]
            : null;

        // Format images
        const formattedImages =
          productData.images && productData.images.length > 0
            ? productData.images
            : productData.main_image_url
            ? [
                {
                  url: productData.main_image_url,
                  alt_text: productData.title,
                  is_main: true,
                },
              ]
            : [];

        return {
          id: productData.id,
          sku: productData.sku,
          slug: productData.slug,
          title: productData.title,
          description: productData.description,
          short_description: productData.short_description,
          main_image_url: productData.main_image_url,
          images: formattedImages,

          // Enhanced pricing for flash deals
          pricing: {
            regular_price_nett: regularPriceNett,
            regular_price_gross: regularPriceGross,
            final_price_nett: finalPriceNett,
            final_price_gross: finalPriceGross,
            is_discounted: true, // Always true for flash deals
            discount_percentage_nett: discountPercentage,
            discount_percentage_gross: parseFloat(
              productData.discount_percentage_gross || 0
            ),
            savings: {
              savings_nett: savingsNett,
              savings_gross: savingsGross,
              savings_percentage: discountPercentage,
              you_save_text: `You save €${savingsNett.toFixed(
                2
              )} (${discountPercentage}%)`,
            },
          },

          // Enhanced flash deal specific information
          flash_deal: {
            deal_type: dealType,
            deal_urgency: dealUrgency,
            discount_percentage: discountPercentage,
            savings_amount_nett: savingsNett,
            savings_amount_gross: savingsGross,
            is_special_offer: productData.is_special_offer,
            is_flash_sale: productData.is_on_sale,
            is_mega_deal: discountPercentage >= 70,
            is_super_deal: discountPercentage >= 50,
            deal_quality_score: Math.min(
              100,
              Math.round(discountPercentage * 1.2 + savingsNett / 10)
            ),
            // You can add deal expiry time here if you implement it
            // deal_expires_at: productData.deal_expires_at,
            // time_remaining: this.calculateTimeRemaining(productData.deal_expires_at),
          },

          // Enhanced badges for flash deals
          badges: {
            is_new: productData.mark_as_new,
            is_featured: productData.mark_as_featured,
            is_top_seller: productData.mark_as_top_seller,
            is_on_sale: productData.is_on_sale,
            is_special_offer: productData.is_special_offer,
            free_shipping: productData.shipping_free,

            // Flash deal specific badges
            hot_deal: discountPercentage >= 40,
            mega_deal: discountPercentage >= 70,
            super_deal: discountPercentage >= 50,
            limited_time:
              productData.is_on_sale || productData.is_special_offer,
            best_value: savingsNett >= 100,
          },

          // Physical specifications
          physical_info: {
            weight: productData.weight,
            weight_unit: productData.weight_unit,
            dimensions: {
              width: productData.width,
              height: productData.height,
              length: productData.length,
              depth: productData.depth,
              thickness: productData.thickness,
              unit: productData.measures_unit,
            },
          },

          // Product type information
          product_type: {
            is_digital: productData.is_digital,
            is_physical: productData.is_physical,
            unit_type: productData.unit_type,
          },

          // Availability information
          availability: {
            is_available: productData.is_available_on_stock,
            status: productData.is_available_on_stock
              ? "In Stock"
              : "Out of Stock",
          },

          // Category and business information
          primary_category: primaryCategory,
          categories: productData.categories || [],
          company_info: productData.company,
          tax_info: productData.tax,

          // Custom product details for filtering
          custom_details: productData.custom_details || [],

          // Timestamps
          created_at: productData.created_at,
          updated_at: productData.updated_at,

          // Additional metadata for flash deals
          deal_metadata: {
            deal_score: Math.round(discountPercentage + savingsNett / 5),
            value_rating:
              savingsNett >= 200
                ? "excellent"
                : savingsNett >= 100
                ? "very_good"
                : savingsNett >= 50
                ? "good"
                : "fair",
            recommendation_score: Math.min(
              100,
              Math.round(
                discountPercentage * 0.6 +
                  (productData.mark_as_featured ? 10 : 0) +
                  (productData.mark_as_top_seller ? 10 : 0) +
                  savingsNett / 10
              )
            ),
          },
        };
      });

      const hasMore = offset + limit < totalCount;
      const nextOffset = hasMore ? offset + limit : null;

      // Calculate flash deals statistics
      const dealStats = {
        total_deals: totalCount,
        current_page_deals: transformedProducts.length,
        average_discount:
          transformedProducts.length > 0
            ? Math.round(
                transformedProducts.reduce(
                  (sum, product) =>
                    sum + product.flash_deal.discount_percentage,
                  0
                ) / transformedProducts.length
              )
            : 0,
        highest_discount:
          transformedProducts.length > 0
            ? Math.max(
                ...transformedProducts.map(
                  (p) => p.flash_deal.discount_percentage
                )
              )
            : 0,
        total_savings_available: Math.round(
          transformedProducts.reduce(
            (sum, product) => sum + product.flash_deal.savings_amount_nett,
            0
          )
        ),
        deal_types: {
          mega_deals: transformedProducts.filter(
            (p) => p.flash_deal.is_mega_deal
          ).length,
          super_deals: transformedProducts.filter(
            (p) => p.flash_deal.is_super_deal
          ).length,
          special_offers: transformedProducts.filter(
            (p) => p.flash_deal.is_special_offer
          ).length,
          flash_sales: transformedProducts.filter(
            (p) => p.flash_deal.is_flash_sale
          ).length,
        },
        urgency_levels: {
          critical: transformedProducts.filter(
            (p) => p.flash_deal.deal_urgency === "critical"
          ).length,
          high: transformedProducts.filter(
            (p) => p.flash_deal.deal_urgency === "high"
          ).length,
          medium: transformedProducts.filter(
            (p) => p.flash_deal.deal_urgency === "medium"
          ).length,
          low: transformedProducts.filter(
            (p) => p.flash_deal.deal_urgency === "low"
          ).length,
        },
      };

      this.logger.info(
        `Flash deals completed: ${transformedProducts.length} deals found`
      );

      // AUTO-GENERATE AVAILABLE FILTERS from found flash deals' custom_details
      const availableFilters = this.extractAutomaticFilters(products);

      // Enhance available filters with flash deal specific filters
      availableFilters.discount_ranges = {
        type: "checkbox",
        label: "Discount Ranges",
        options: [
          {
            value: "70_plus",
            label: "70% or more (Mega Deals)",
            count: transformedProducts.filter(
              (p) => p.flash_deal.discount_percentage >= 70
            ).length,
          },
          {
            value: "50_to_69",
            label: "50% - 69% (Super Deals)",
            count: transformedProducts.filter(
              (p) =>
                p.flash_deal.discount_percentage >= 50 &&
                p.flash_deal.discount_percentage < 70
            ).length,
          },
          {
            value: "30_to_49",
            label: "30% - 49% (Great Deals)",
            count: transformedProducts.filter(
              (p) =>
                p.flash_deal.discount_percentage >= 30 &&
                p.flash_deal.discount_percentage < 50
            ).length,
          },
          {
            value: "20_to_29",
            label: "20% - 29% (Good Deals)",
            count: transformedProducts.filter(
              (p) =>
                p.flash_deal.discount_percentage >= 20 &&
                p.flash_deal.discount_percentage < 30
            ).length,
          },
          {
            value: "10_to_19",
            label: "10% - 19% (Standard Deals)",
            count: transformedProducts.filter(
              (p) =>
                p.flash_deal.discount_percentage >= 10 &&
                p.flash_deal.discount_percentage < 20
            ).length,
          },
        ].filter((option) => option.count > 0),
      };

      availableFilters.deal_types = {
        type: "checkbox",
        label: "Deal Types",
        options: [
          {
            value: "special_offer",
            label: "Special Offers",
            count: transformedProducts.filter(
              (p) => p.flash_deal.is_special_offer
            ).length,
          },
          {
            value: "flash_sale",
            label: "Flash Sales",
            count: transformedProducts.filter((p) => p.flash_deal.is_flash_sale)
              .length,
          },
          {
            value: "mega_deal",
            label: "Mega Deals (70%+)",
            count: transformedProducts.filter((p) => p.flash_deal.is_mega_deal)
              .length,
          },
          {
            value: "super_deal",
            label: "Super Deals (50%+)",
            count: transformedProducts.filter((p) => p.flash_deal.is_super_deal)
              .length,
          },
        ].filter((option) => option.count > 0),
      };

      return {
        status: "success",
        statusCode: 200,
        message: "Flash deals retrieved successfully",
        data: {
          products: transformedProducts,
          pagination: {
            total_count: totalCount,
            current_offset: parseInt(offset),
            limit: parseInt(limit),
            has_more: hasMore,
            next_offset: nextOffset,
            current_page: Math.floor(offset / limit) + 1,
            total_pages: Math.ceil(totalCount / limit),
          },

          // Auto-generated filters from custom_details (same as search)
          available_filters: availableFilters,

          // Flash deals specific statistics
          deal_statistics: dealStats,

          // Filter and search information
          flash_deals_info: {
            sort_by: sort_by,
            sort_order: sort_order,
            filters_applied: {
              price_range: {
                min_price: min_price ? parseFloat(min_price) : null,
                max_price: max_price ? parseFloat(max_price) : null,
              },
              discount_range: {
                min_discount: min_discount,
                max_discount: max_discount ? parseFloat(max_discount) : null,
              },
              include_out_of_stock: include_out_of_stock,
              category_id: category_id || null,
              custom_filters: filters,
            },
            result_count: totalCount,
            retrieved_at: new Date(),
            algorithm_version: "1.0",
          },

          // Additional metadata
          metadata: {
            min_discount_threshold: min_discount,
            deals_found: totalCount,
            best_deal:
              transformedProducts.length > 0 ? transformedProducts[0] : null,
            recommended_sorting: [
              "discount_percentage",
              "savings_high_low",
              "urgency",
              "popularity",
            ],
          },
        },
      };
    } catch (err) {
      this.logger.error(`Error in getFlashDeals: ${err.message}`);
      this.logger.error(`Stack trace: ${err.stack}`);
      throw {
        status: "error",
        statusCode: err.statusCode || 500,
        message: "Failed to retrieve flash deals",
        error: err.message,
      };
    }
  }
};

module.exports = new ProductServiceLayer();
