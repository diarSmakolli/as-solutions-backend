const {
  Administration,
  Company,
  Unit,
  Asset,
  CompanyDocument,
} = require("../../configurations/associations");
const logger = require("../../logger/logger");
const multer = require("multer");
const path = require("path");
const { Op } = require("sequelize");
const uploadToSpaces = require("../../commons/uploadToSpaces");

// Constants
const CONSTANTS = {
  FILE_TYPES: {
    LOGO: {
      EXTENSIONS: /jpeg|jpg|png|gif|svg/,
      MAX_SIZE: 10 * 1024 * 1024, // 10MB
    },
    ASSET_IMAGES: {
      EXTENSIONS: /jpeg|jpg|png|webp|gif/,
      MAX_SIZE: 10 * 1024 * 1024, // 10MB
    },
    DOCUMENTS: {
      EXTENSIONS: /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv|zip|rar/,
      MAX_SIZE: 25 * 1024 * 1024, // 25MB
    },
  },
  PAGINATION: {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 10,
    MAX_LIMIT: 100,
    DEFAULT_SORT_BY: 'created_at',
    DEFAULT_SORT_ORDER: 'DESC',
  },
  ASSET_STATUSES: ['active', 'inactive', 'pending', 'verified'],
  DEFAULT_EMPLOYEE_COUNT: 0,
  DEFAULT_RATING: 0,
  DEFAULT_ORDERS: 0,
  DEFAULT_RETURNS: 0,
  SPACES_FOLDERS: {
    LOGOS: 'company-logos',
    ASSET_IMAGES: 'company-assets',
    COMPANY_DOCUMENTS: 'company-documents',
  },
};

class CompanyService {
  constructor() {
    this.logger = logger;
    this.setupMulterConfigurations();
  }

  // ============ VALIDATION HELPERS ============

  validateUUID(value, fieldName = 'ID') {
    if (!value || !this.isValidUUID(value)) {
      throw {
        status: "error",
        statusCode: 400,
        message: `Invalid ${fieldName} format`,
      };
    }
  }

  validateRequiredFields(data, requiredFields) {
    const missingFields = [];
    
    for (const field of requiredFields) {
      if (!data[field] || (typeof data[field] === 'string' && data[field].trim() === '')) {
        missingFields.push(field.replace('_', ' '));
      }
    }
    
    if (missingFields.length > 0) {
      throw {
        status: "error",
        statusCode: 400,
        message: `Please provide all required fields: ${missingFields.join(', ')}.`,
      };
    }
  }

  validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw {
        status: "error",
        statusCode: 400,
        message: "Please provide a valid email address",
      };
    }
  }

  validatePaginationParams(page, limit) {
    const parsedPage = Math.max(1, parseInt(page) || CONSTANTS.PAGINATION.DEFAULT_PAGE);
    const parsedLimit = Math.min(
      CONSTANTS.PAGINATION.MAX_LIMIT, 
      Math.max(1, parseInt(limit) || CONSTANTS.PAGINATION.DEFAULT_LIMIT)
    );
    
    return { page: parsedPage, limit: parsedLimit };
  }

  validateAssetStatus(status) {
    if (!CONSTANTS.ASSET_STATUSES.includes(status)) {
      throw {
        status: "error",
        statusCode: 400,
        message: `Invalid status value. Allowed statuses are: ${CONSTANTS.ASSET_STATUSES.join(', ')}`,
      };
    }
  }

  // ============ UTILITY METHODS ============

  isValidUUID(value) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(value);
  }

  sanitizeString(str) {
    return typeof str === 'string' ? str.trim() : str;
  }

  async findCompanyById(companyId, includeInactive = false) {
    this.validateUUID(companyId, 'Company ID');

    if(!companyId) {
      this.requestFailure();
    }

    const whereClause = { id: companyId };
    if (!includeInactive) {
      whereClause.is_inactive = false;
    }

    const company = await Company.findOne({ where: whereClause });
    if (!company) {
      throw {
        status: "error",
        statusCode: 404,
        message: "Company not found in our records.",
      };
    }

    return company;
  }

  buildSearchClause(search, searchFields) {
    if (!search) return {};
    
    return {
      [Op.or]: searchFields.map(field => ({
        [field]: { [Op.iLike]: `%${search}%` }
      }))
    };
  }

  buildWhereClause(baseConditions, search, searchFields, filters) {
    const whereClause = { [Op.and]: [...baseConditions] };

    if (search) {
      whereClause[Op.and].push(this.buildSearchClause(search, searchFields));
    }

    // Apply filters
    Object.keys(filters).forEach(key => {
      const value = filters[key];
      if (value !== undefined && value !== null && value !== '') {
        if (typeof value === 'boolean' || value === 'true' || value === 'false') {
          whereClause[Op.and].push({ [key]: value === 'true' || value === true });
        } else if (typeof value === 'string' && key.includes('date')) {
          // Handle date range filters if needed
          whereClause[Op.and].push({ [key]: { [Op.gte]: new Date(value) } });
        } else {
          whereClause[Op.and].push({ [key]: { [Op.iLike]: `%${value}%` } });
        }
      }
    });

    return whereClause[Op.and].length > 0 ? whereClause : {};
  }

  formatPaginatedResponse(result, page, limit) {
    return {
      total_items: result.count,
      current_page: page,
      total_pages: Math.ceil(result.count / limit),
      items_per_page: limit,
    };
  }

  async safeFileDelete(fileUrl, description = 'file') {
    try {
      if (fileUrl && fileUrl.includes('digitaloceanspaces.com')) {
        const urlParts = fileUrl.split('/');
        const key = urlParts.slice(-2).join('/');
        
        const s3 = require("../../commons/doSpaces");
        await s3.deleteObject({
          Bucket: "as-solutions-storage",
          Key: key,
        }).promise();
        
        this.logger.info(`Deleted ${description} from DigitalOcean Spaces: ${key}`);
      } else {
        this.logger.warn(`Invalid or missing ${description} URL for deletion: ${fileUrl}`);
      }
    } catch (err) {
      this.logger.error(`Error deleting ${description} from DigitalOcean Spaces ${fileUrl}: ${err.message}`);
    }
  }

  requestFailure(message = "Request has been failed, please try again later.") {
    throw {
      status: "error",
      statusCode: 400,
      message,
    };
  }

  // ============ MULTER CONFIGURATIONS ============

  setupMulterConfigurations() {
    // Logo upload configuration - using memory storage
    this.logoUpload = multer({
      storage: multer.memoryStorage(),
      limits: { fileSize: CONSTANTS.FILE_TYPES.LOGO.MAX_SIZE },
      fileFilter: (req, file, cb) => {
        const filetypes = CONSTANTS.FILE_TYPES.LOGO.EXTENSIONS;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        
        if (mimetype && extname) {
          return cb(null, true);
        }
        cb(new Error(`File upload only supports the following filetypes - ${filetypes}`));
      },
    });

    // Asset images upload configuration - using memory storage
    this.assetImagesUpload = multer({
      storage: multer.memoryStorage(),
      limits: { fileSize: CONSTANTS.FILE_TYPES.ASSET_IMAGES.MAX_SIZE },
      fileFilter: (req, file, cb) => {
        const filetypes = CONSTANTS.FILE_TYPES.ASSET_IMAGES.EXTENSIONS;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        
        if (mimetype && extname) {
          return cb(null, true);
        }
        cb(new Error(`Asset image upload only supports the following filetypes - ${filetypes}`));
      },
    });

    // Company document upload configuration - using memory storage
    this.companyDocumentUpload = multer({
      storage: multer.memoryStorage(),
      limits: { fileSize: CONSTANTS.FILE_TYPES.DOCUMENTS.MAX_SIZE },
      fileFilter: (req, file, cb) => {
        const filetypes = CONSTANTS.FILE_TYPES.DOCUMENTS.EXTENSIONS;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        
        if (mimetype || extname) {
          return cb(null, true);
        }
        cb(new Error(`Document upload only supports common document types. Disallowed type: ${file.mimetype || path.extname(file.originalname)}`));
      },
    });
  }

  // ============ COMPANY MANAGEMENT METHODS ============

  // Create a new company
  async createCompany(companyData, logoFile) {
    try {
      this.logger.info("Attempting to create a new company");

      // Validate required fields
      this.validateRequiredFields(companyData, ['business_name', 'market_name']);

      // Validate contact person email if provided
      if (companyData.contact_person_email) {
        this.validateEmail(companyData.contact_person_email);
      }

      const newCompanyPayload = {
        ...companyData,
        business_name: this.sanitizeString(companyData.business_name),
        market_name: this.sanitizeString(companyData.market_name),
        type_of_business: this.sanitizeString(companyData.type_of_business),
        city: this.sanitizeString(companyData.city),
        country: this.sanitizeString(companyData.country),
        address: this.sanitizeString(companyData.address),
        contact_person: this.sanitizeString(companyData.contact_person),
        contact_person_email: this.sanitizeString(companyData.contact_person_email),
        contact_person_phone: this.sanitizeString(companyData.contact_person_phone),
        website_url: this.sanitizeString(companyData.website_url),
        notes_internal: this.sanitizeString(companyData.notes_internal),
        flagged_reason: this.sanitizeString(companyData.flagged_reason),
        employees_count: companyData.employees_count || CONSTANTS.DEFAULT_EMPLOYEE_COUNT,
        total_orders: CONSTANTS.DEFAULT_ORDERS,
        average_rating: CONSTANTS.DEFAULT_RATING,
        return_count: CONSTANTS.DEFAULT_RETURNS,
        is_verified: false,
        is_inactive: false,
        is_on_top_list: false,
        is_flagged: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      // Upload logo to DigitalOcean Spaces if provided
      if (logoFile) {
        const logoUrl = await uploadToSpaces(
          logoFile.buffer,
          logoFile.originalname,
          CONSTANTS.SPACES_FOLDERS.LOGOS,
          'public-read'
        );
        newCompanyPayload.logo_url = logoUrl;
      }

      const company = await Company.create(newCompanyPayload);
      this.logger.info(`Company created successfully with ID: ${company.id}`);
      return company;
    } catch (error) {
      this.logger.error('Company creation failed:', error);
      throw error;
    }
  }

  // Get info about a specific company
  async getCompanyInfo(companyId) {
    try {
      if(!companyId || !this.isValidUUID(companyId)) {
        this.requestFailure();
      }

      return await this.findCompanyById(companyId);
    } catch (error) {
      this.logger.error('Get company info failed:', error);
      throw error;
    }
  }

  // Make inactive a company
  async makeCompanyInactive(companyId) {
    try {
      if(!companyId || !this.isValidUUID(companyId)) {
        this.requestFailure();
      }

      const company = await this.findCompanyById(companyId);

      await company.update({
        is_inactive: true,
        updated_at: new Date(),
      });

      this.logger.info(`Company ${companyId} made inactive`);
      return company;

    } catch (error) {
      this.logger.error('Make company inactive failed:', error);
      throw error;
    }
  }

  // Make company active
  async makeCompanyActive(companyId) {
    try {
      if(!companyId || !this.isValidUUID(companyId)) {
        this.requestFailure();
      }

      const company = await this.findCompanyById(companyId, true);

      await company.update({
        is_inactive: false,
        updated_at: new Date(),
      });

      this.logger.info(`Company ${companyId} made active`);
      return company;

    } catch (error) {
      this.logger.error('Make company active failed:', error);
      throw error;
    }
  }

  // Get all user of company
  async getAllUsersOfCompany(companyId) {
    try {
      if(!companyId || !this.isValidUUID(companyId)) {
        this.requestFailure();
      }

      const company = await Company.findOne({
        where: { id: companyId },
        include: [
          {
            model: Administration,
            as: "administration",
            required: false,
          },
        ],
      });

      if (!company) {
        throw {
          status: "error",
          statusCode: 404,
          message: "Company not found in our records.",
        };
      }

      return company;

    } catch (error) {
      this.logger.error('Get all users of company failed:', error);
      throw error;
    }
  }

  // Edit a company
  async editCompany(companyId, companyData) {
    try {
      if(!companyId || !this.isValidUUID(companyId)) {
        this.requestFailure();
      }

      const company = await this.findCompanyById(companyId);

      // Validate email if provided
      if (companyData.contact_person_email) {
        this.validateEmail(companyData.contact_person_email);
      }

      // Sanitize string fields
      const sanitizedData = {
        ...companyData,
        business_name: this.sanitizeString(companyData.business_name),
        market_name: this.sanitizeString(companyData.market_name),
        type_of_business: this.sanitizeString(companyData.type_of_business),
        city: this.sanitizeString(companyData.city),
        country: this.sanitizeString(companyData.country),
        address: this.sanitizeString(companyData.address),
        contact_person: this.sanitizeString(companyData.contact_person),
        contact_person_email: this.sanitizeString(companyData.contact_person_email),
        contact_person_phone: this.sanitizeString(companyData.contact_person_phone),
        website_url: this.sanitizeString(companyData.website_url),
        notes_internal: this.sanitizeString(companyData.notes_internal),
        flagged_reason: this.sanitizeString(companyData.flagged_reason),
        updated_at: new Date(),
      };

      await company.update(sanitizedData);

      this.logger.info(`Company ${companyId} updated successfully`);
      return company;

    } catch (error) {
      this.logger.error('Edit company failed:', error);
      throw error;
    }
  }

  // Get all companies for select
  async getAllCompaniesForSelect() {
    try {
      const companies = await Company.findAll({
        where: { is_inactive: false },
        attributes: ["id", "business_name", "market_name"],
        order: [['business_name', 'ASC']],
      });

      return companies;

    } catch (error) {
      this.logger.error('Get all companies for select failed:', error);
      throw error;
    }
  }

  // Get all companies
  async getAllCompaniesList(page = 1, limit = 10, filters = {}, sortBy = "created_at", sortOrder = "DESC", search = "") {
    try {
      this.logger.info("Service: Fetching all companies list", {
        page, limit, sortBy, sortOrder, search, filters,
      });

      const { page: parsedPage, limit: parsedLimit } = this.validatePaginationParams(page, limit);
      const offset = (parsedPage - 1) * parsedLimit;

      const searchFields = ['business_name', 'market_name', 'type_of_business', 'city', 'country'];
      const whereClause = this.buildWhereClause([], search, searchFields, filters);

      const order = [[sortBy, sortOrder.toUpperCase() === "DESC" ? "DESC" : "ASC"]];

      const { count, rows } = await Company.findAndCountAll({
        where: whereClause,
        limit: parsedLimit,
        offset,
        order,
      });

      const response = {
        ...this.formatPaginatedResponse({ count }, parsedPage, parsedLimit),
        companies: rows,
      };

      return response;

    } catch (error) {
      this.logger.error('Get all companies list failed:', error);
      throw error;
    }
  }

  // Change logo of company
  async changeCompanyLogo(companyId, logoFile) {
    try {
      if(!companyId || !this.isValidUUID(companyId)) {
        this.requestFailure();
      }

      const company = await this.findCompanyById(companyId);

      if (!logoFile) {
        throw {
          status: "error",
          statusCode: 400,
          message: "Logo file is required.",
        };
      }

      // Delete old logo from DigitalOcean Spaces if exists
      if (company.logo_url) {
        await this.safeFileDelete(company.logo_url, 'old logo file');
      }

      // Upload new logo to DigitalOcean Spaces
      const newLogoUrl = await uploadToSpaces(
        logoFile.buffer,
        logoFile.originalname,
        CONSTANTS.SPACES_FOLDERS.LOGOS,
        'public-read'
      );

      await company.update({
        logo_url: newLogoUrl,
        updated_at: new Date(),
      });

      this.logger.info(`Company logo updated for company ID: ${companyId}`);
      return company;

    } catch (error) {
      this.logger.error('Change company logo failed:', error);
      throw error;
    }
  }

  // ============ ASSET MANAGEMENT METHODS ============

  // Create asset and assign multiple files
  async createCompanyAsset(companyId, assetData, imageFiles = []) {
    try {
      if(!companyId || !this.isValidUUID(companyId)) {
        this.requestFailure();
      }

      this.logger.info(`Attempting to create asset for company ID: ${companyId}`, {
        assetData: assetData ? Object.keys(assetData) : null,
        imageCount: imageFiles.length,
      });

      const company = await this.findCompanyById(companyId);

      // Validate required fields
      this.validateRequiredFields(assetData, ['asset_name', 'asset_tag']);

      // Upload images to DigitalOcean Spaces
      const processedImages = [];
      for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i];
        const imageUrl = await uploadToSpaces(
          file.buffer,
          file.originalname,
          CONSTANTS.SPACES_FOLDERS.ASSET_IMAGES,
          'public-read'
        );
        processedImages.push({
          url: imageUrl,
          order: i + 1,
        });
      }

      const newAssetPayload = {
        ...assetData,
        asset_name: this.sanitizeString(assetData.asset_name),
        asset_tag: this.sanitizeString(assetData.asset_tag),
        description: this.sanitizeString(assetData.description),
        category: this.sanitizeString(assetData.category),
        serial_number: this.sanitizeString(assetData.serial_number),
        model: this.sanitizeString(assetData.model),
        location: this.sanitizeString(assetData.location),
        company_id: companyId,
        images: processedImages,
        status: assetData.status || 'active',
        created_at: new Date(),
        updated_at: new Date(),
      };

      const asset = await Asset.create(newAssetPayload);
      this.logger.info(`Asset created successfully with ID: ${asset.id} for company ID: ${companyId}`);
      return asset;

    } catch (error) {
      this.logger.error('Create company asset failed:', error);
      throw error;
    }
  }

  // Delete asset and images
  async deleteCompanyAsset(companyId, assetId) {
    try {
      if(!companyId || !this.isValidUUID(companyId)) {
        this.requestFailure();
      }

      if(!assetId || !this.isValidUUID(assetId)) {
        this.requestFailure();
      }

      this.logger.info(`Attempting to delete asset ID: ${assetId} for company ID: ${companyId}`);
      
      this.validateUUID(companyId, 'Company ID');
      this.validateUUID(assetId, 'Asset ID');

      const asset = await Asset.findOne({
        where: { id: assetId, company_id: companyId },
      });

      if (!asset) {
        throw {
          status: "error",
          statusCode: 404,
          message: "Asset not found or does not belong to this company.",
        };
      }

      // Delete images from DigitalOcean Spaces
      if (asset.images && asset.images.length > 0) {
        for (const imageObj of asset.images) {
          if (imageObj.url) {
            await this.safeFileDelete(imageObj.url, 'asset image file');
          }
        }
      }

      await asset.destroy();
      this.logger.info(`Asset ID: ${assetId} deleted successfully.`);
      return { message: "Asset deleted successfully." };

    } catch (error) {
      this.logger.error('Delete company asset failed:', error);
      throw error;
    }
  }

  // Edit the asset properties
  async editCompanyAsset(companyId, assetId, assetUpdateData) {
    try {
      if(!companyId || !this.isValidUUID(companyId)) {
        this.requestFailure();
      }

      if(!assetId || !this.isValidUUID(assetId)) {
        this.requestFailure();
      }

      this.logger.info(`Attempting to edit asset ID: ${assetId} for company ID: ${companyId}`, {
        assetUpdateData: assetUpdateData ? Object.keys(assetUpdateData) : null
      });

      this.validateUUID(companyId, 'Company ID');
      this.validateUUID(assetId, 'Asset ID');

      const asset = await Asset.findOne({
        where: { id: assetId, company_id: companyId },
      });

      if (!asset) {
        throw {
          status: "error",
          statusCode: 404,
          message: "Asset not found or does not belong to this company.",
        };
      }

      // Remove non-updatable fields
      const { company_id, ...updatableData } = assetUpdateData;

      // Sanitize string fields
      const sanitizedData = {
        ...updatableData,
        asset_name: this.sanitizeString(updatableData.asset_name),
        asset_tag: this.sanitizeString(updatableData.asset_tag),
        description: this.sanitizeString(updatableData.description),
        category: this.sanitizeString(updatableData.category),
        serial_number: this.sanitizeString(updatableData.serial_number),
        model: this.sanitizeString(updatableData.model),
        location: this.sanitizeString(updatableData.location),
        updated_at: new Date(),
      };

      await asset.update(sanitizedData);
      this.logger.info(`Asset ID: ${assetId} updated successfully.`);
      return asset.reload();

    } catch (error) {
      this.logger.error('Edit company asset failed:', error);
      throw error;
    }
  }

  // Update status of the asset
  async updateCompanyAssetStatus(companyId, assetId, status) {
    try {
      if(!companyId || !this.isValidUUID(companyId)) {
        this.requestFailure();
      }

      if(!assetId || !this.isValidUUID(assetId)) {
        this.requestFailure();
      }

      this.logger.info(`Attempting to update status for asset ID: ${assetId} to "${status}" for company ID: ${companyId}`);
      
      this.validateUUID(companyId, 'Company ID');
      this.validateUUID(assetId, 'Asset ID');

      if (!status) {
        this.requestFailure("Status is required.");
      }

      this.validateAssetStatus(status);

      const asset = await Asset.findOne({
        where: { id: assetId, company_id: companyId },
      });

      if (!asset) {
        throw {
          status: "error",
          statusCode: 404,
          message: "Asset not found or does not belong to this company.",
        };
      }

      await asset.update({ 
        status,
        updated_at: new Date(),
      });

      this.logger.info(`Status for asset ID: ${assetId} updated to "${status}".`);
      return asset.reload();

    } catch (error) {
      this.logger.error('Update company asset status failed:', error);
      throw error;
    }
  }

  // Get all assets of the company
  async getAllCompanyAssets(companyId, queryParams = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        filters = {},
        sortBy = "created_at",
        sortOrder = "DESC",
        search = "",
      } = queryParams;

      this.logger.info(`Fetching assets for company ID: ${companyId}`, { queryParams });

      await this.findCompanyById(companyId); // Validate company exists

      const { page: parsedPage, limit: parsedLimit } = this.validatePaginationParams(page, limit);
      const offset = (parsedPage - 1) * parsedLimit;

      const searchFields = ['asset_name', 'asset_tag', 'serial_number', 'category', 'model', 'location'];
      const baseConditions = [{ company_id: companyId }];
      const whereClause = this.buildWhereClause(baseConditions, search, searchFields, filters);

      const order = [[sortBy, sortOrder.toUpperCase() === "DESC" ? "DESC" : "ASC"]];

      const { count, rows } = await Asset.findAndCountAll({
        where: whereClause,
        limit: parsedLimit,
        offset,
        order,
      });

      const response = {
        ...this.formatPaginatedResponse({ count }, parsedPage, parsedLimit),
        assets: rows,
      };

      return response;

    } catch (error) {
      this.logger.error('Get all company assets failed:', error);
      throw error;
    }
  }

  // ============ DOCUMENT MANAGEMENT METHODS ============

  // Create a document for the company
  async createCompanyDocument(companyId, uploaderId, documentData, documentFile) {
    try {
      this.logger.info(`Attempting to create document for company ID: ${companyId} by user ${uploaderId}`, {
        documentName: documentData.document_name
      });

      if(!companyId || !this.isValidUUID(companyId)) {
        this.requestFailure();
      }

      this.validateUUID(companyId, 'Company ID');
      this.validateUUID(uploaderId, 'Uploader ID');

      if (!documentFile) {
        this.requestFailure("Document file is required.");
      }

      this.validateRequiredFields(documentData, ['document_name']);

      const company = await this.findCompanyById(companyId);

      // Process tags
      let processedTags = [];
      if (documentData.tags) {
        if (Array.isArray(documentData.tags)) {
          processedTags = documentData.tags
            .map(tag => String(tag).trim())
            .filter(tag => tag);
        } else if (typeof documentData.tags === 'string') {
          processedTags = documentData.tags
            .split(",")
            .map(tag => String(tag).trim())
            .filter(tag => tag);
        }
      }

      // Upload document to DigitalOcean Spaces
      const documentUrl = await uploadToSpaces(
        documentFile.buffer,
        documentFile.originalname,
        CONSTANTS.SPACES_FOLDERS.COMPANY_DOCUMENTS,
        'public-read'
      );

      const newDocumentPayload = {
        ...documentData,
        document_name: this.sanitizeString(documentData.document_name),
        version: this.sanitizeString(documentData.version),
        tags: processedTags.length > 0 ? processedTags : null,
        uploaded_by: uploaderId,
        company_id: companyId,
        file_url: documentUrl,
        file_size: documentFile.size,
        is_confidential: documentData.is_confidential || false,
        expiration_date: documentData.expiration_date ? new Date(documentData.expiration_date) : null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const document = await CompanyDocument.create(newDocumentPayload);
      this.logger.info(`Document created successfully with ID: ${document.id} for company ID: ${companyId}`);
      return document;

    } catch (error) {
      this.logger.error('Create company document failed:', error);
      throw error;
    }
  }

  async getCompanyDocumentFile(companyId, documentId) {
    try {
      this.validateUUID(companyId, 'Company ID');
      this.validateUUID(documentId, 'Document ID');
  
      // Find the company
      const company = await this.findCompanyById(companyId);
  
      // Find the document
      const document = await CompanyDocument.findOne({
        where: {
          id: documentId,
          company_id: companyId
        }
      });
  
      if (!document) {
        throw {
          status: "error",
          statusCode: 404,
          message: "Document not found in our records."
        };
      }
  
      const fileUrl = document.file_url;
      const documentName = document.document_name;
      const fileSize = document.file_size;
      
      const path = require('path');
      const urlExtension = path.extname(fileUrl);
      const finalDocumentName = documentName.includes('.') 
        ? documentName 
        : `${documentName}${urlExtension}`;
  
      this.logger.info(`Document file URL retrieved for document ${documentId}: ${fileUrl}`);
      
      return {
        downloadUrl: fileUrl,
        documentName: finalDocumentName,
        fileSize: fileSize,
        mimeType: this.getMimeTypeFromUrl(fileUrl)
      };
  
    } catch (error) {
      this.logger.error('Get company document file failed:', error);
      throw error;
    }
  }

  // Get all documents of the company
  async getAllCompanyDocuments(companyId, queryParams = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        filters = {},
        sortBy = "created_at",
        sortOrder = "DESC",
        search = "",
      } = queryParams;

      this.logger.info(`Fetching documents for company ID: ${companyId}`, { queryParams });

      this.validateUUID(companyId, 'Company ID');

      const { page: parsedPage, limit: parsedLimit } = this.validatePaginationParams(page, limit);
      const offset = (parsedPage - 1) * parsedLimit;

      const baseConditions = [{ company_id: companyId }];
      const whereClause = { [Op.and]: [...baseConditions] };

      if (search) {
        whereClause[Op.and].push({
          [Op.or]: [
            { document_name: { [Op.iLike]: `%${search}%` } },
            {
              tags: {
                [Op.overlap]: search
                  .split(",")
                  .map(tag => tag.trim())
                  .filter(tag => tag),
              },
            },
          ],
        });
      }

      // Apply filters
      Object.keys(filters).forEach(key => {
        const value = filters[key];
        if (value !== undefined && value !== null && value !== '') {
          if (key === 'is_confidential') {
            whereClause[Op.and].push({
              is_confidential: value === "true" || value === true,
            });
          } else if (key === 'uploaded_by') {
            whereClause[Op.and].push({ uploaded_by: value });
          }
        }
      });

      const order = [[sortBy, sortOrder.toUpperCase() === "DESC" ? "DESC" : "ASC"]];

      const { count, rows } = await CompanyDocument.findAndCountAll({
        where: whereClause[Op.and].length > 0 ? whereClause : {},
        limit: parsedLimit,
        offset,
        order,
      });

      const response = {
        ...this.formatPaginatedResponse({ count }, parsedPage, parsedLimit),
        documents: rows,
      };

      return response;

    } catch (error) {
      this.logger.error('Get all company documents failed:', error);
      throw error;
    }
  }

  // Get a document details
  async getCompanyDocumentDetails(companyId, documentId) {
    try {
      this.logger.info(`Fetching details for document ID: ${documentId}, company ID: ${companyId}`);

      this.validateUUID(companyId, 'Company ID');
      this.validateUUID(documentId, 'Document ID');

      const document = await CompanyDocument.findOne({
        where: { id: documentId, company_id: companyId },
      });

      if (!document) {
        throw {
          status: "error",
          statusCode: 404,
          message: "Document not found or does not belong to this company.",
        };
      }

      return document;
    } catch (error) {
      this.logger.error('Get company document details failed:', error);
      throw error;
    }
  }

  // Edit a document
  async editCompanyDocument(companyId, documentId, uploaderId, documentUpdateData, newDocumentFile) {
    try {
      this.logger.info(`Attempting to edit document ID: ${documentId} for company ID: ${companyId} by user ${uploaderId}`, {
        hasNewFile: !!newDocumentFile
      });

      this.validateUUID(companyId, 'Company ID');
      this.validateUUID(documentId, 'Document ID');
      this.validateUUID(uploaderId, 'Uploader ID');

      const document = await CompanyDocument.findOne({
        where: { id: documentId, company_id: companyId },
      });

      if (!document) {
        throw {
          status: "error",
          statusCode: 404,
          message: "Document not found or does not belong to this company.",
        };
      }

      // Remove non-updatable fields
      const {
        company_id,
        uploaded_by,
        file_url,
        file_size,
        created_at,
        ...updatableData
      } = documentUpdateData;

      // Sanitize data
      const sanitizedData = {
        ...updatableData,
        document_name: this.sanitizeString(updatableData.document_name),
        version: this.sanitizeString(updatableData.version),
        updated_at: new Date(),
      };

      // Process tags if provided
      if (updatableData.tags) {
        if (Array.isArray(updatableData.tags)) {
          sanitizedData.tags = updatableData.tags
            .map(tag => String(tag).trim())
            .filter(tag => tag);
        } else if (typeof updatableData.tags === 'string') {
          sanitizedData.tags = updatableData.tags
            .split(",")
            .map(tag => String(tag).trim())
            .filter(tag => tag);
        }
      }

      // Handle new file upload
      if (newDocumentFile) {
        // Delete old file from DigitalOcean Spaces
        if (document.file_url) {
          await this.safeFileDelete(document.file_url, 'old document file');
        }

        // Upload new file to DigitalOcean Spaces
        const newDocumentUrl = await uploadToSpaces(
          newDocumentFile.buffer,
          newDocumentFile.originalname,
          CONSTANTS.SPACES_FOLDERS.COMPANY_DOCUMENTS,
          'public-read'
        );

        sanitizedData.file_url = newDocumentUrl;
        sanitizedData.file_size = newDocumentFile.size;
      }

      await document.update(sanitizedData);
      this.logger.info(`Document ID: ${documentId} updated successfully.`);
      return document.reload();

    } catch (error) {
      this.logger.error('Edit company document failed:', error);
      throw error;
    }
  }

  // Delete a document
  async deleteCompanyDocument(companyId, documentId) {
    try {
      this.logger.info(`Attempting to delete document ID: ${documentId} for company ID: ${companyId}`);

      this.validateUUID(companyId, 'Company ID');
      this.validateUUID(documentId, 'Document ID');

      const document = await CompanyDocument.findOne({
        where: { id: documentId, company_id: companyId },
      });

      if (!document) {
        throw {
          status: "error",
          statusCode: 404,
          message: "Document not found or does not belong to this company.",
        };
      }

      // Delete file from DigitalOcean Spaces
      if (document.file_url) {
        await this.safeFileDelete(document.file_url, 'document file');
      }

      await document.destroy();
      this.logger.info(`Document ID: ${documentId} deleted successfully.`);
      return { message: "Document deleted successfully." };

    } catch (error) {
      this.logger.error('Delete company document failed:', error);
      throw error;
    }
  }

  // ============ MULTER MIDDLEWARE GETTERS ============

  getMimeTypeFromUrl(url) {
    const path = require('path');
    const ext = path.extname(url).toLowerCase();
    
    const mimeTypes = {
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.ppt': 'application/vnd.ms-powerpoint',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.txt': 'text/plain',
      '.csv': 'text/csv',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.zip': 'application/zip',
      '.rar': 'application/vnd.rar'
    };
    
    return mimeTypes[ext] || 'application/octet-stream';
  }

  // Get logo upload middleware
  getLogoUploadMiddleware() {
    return this.logoUpload.single("logo");
  }

  // Image asset upload middleware
  getAssetImagesUploadMiddleware(maxCount = 10) {
    return this.assetImagesUpload.array("images", maxCount);
  }

  // Get company document upload middleware
  getCompanyDocumentUploadMiddleware() {
    return this.companyDocumentUpload.single("documentFile");
  }
}

module.exports = new CompanyService();
