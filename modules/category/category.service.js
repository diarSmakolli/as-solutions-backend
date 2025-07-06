const {
    Category,
} = require('../../configurations/associations');
const { Op } = require('sequelize');
const logger = require('../../logger/logger');
const multer = require('multer');
const path = require('path');
const uploadToSpaces = require('../../commons/uploadToSpaces');

// Constants for file uploads
const CONSTANTS = {
    FILE_TYPES: {
        CATEGORY_IMAGES: {
            EXTENSIONS: /jpeg|jpg|png|gif|svg|webp/,
            MAX_SIZE: 10 * 1024 * 1024, // 10MB
        },
    },
    SPACES_FOLDERS: {
        CATEGORY_IMAGES: 'category-images',
    },
};

/**
 * Service class for managing categories with validation and error handling
 */
class CategoryService {
    
    constructor() {
        this.logger = logger;
        this.setupMulterConfiguration();
    }

    // ============ VALIDATION METHODS ============
    
    /**
     * Validates category data
     * @param {Object} categoryData - Category data to validate
     * @param {boolean} isUpdate - Whether this is an update operation
     * @param {string} excludeId - Category ID to exclude from unique checks (for updates)
     * @returns {Object} Validation result
     */
    async validateCategoryData(categoryData, isUpdate = false, excludeId = null) {
        const errors = [];
        
        if (!categoryData || typeof categoryData !== 'object') {
            errors.push('Category data must be a valid object');
            return { isValid: false, errors };
        }

        // Name validation for create
        if (!isUpdate && (!categoryData.name || typeof categoryData.name !== 'string' || categoryData.name.trim().length === 0)) {
            errors.push('Category name is required and must be a non-empty string');
        }
        
        // Name validation for update
        if (isUpdate && categoryData.name !== undefined && (typeof categoryData.name !== 'string' || categoryData.name.trim().length === 0)) {
            errors.push('Category name must be a non-empty string');
        }

        // Name length validation
        if (categoryData.name && categoryData.name.length > 255) {
            errors.push('Category name must not exceed 255 characters');
        }

        // Check for unique category name
        if (categoryData.name) {
            const whereClause = { name: categoryData.name.trim() };
            if (excludeId) {
                whereClause.id = { [Op.ne]: excludeId };
            }
            
            const existingCategory = await Category.findOne({ where: whereClause });
            if (existingCategory) {
                errors.push(`Category name '${categoryData.name.trim()}' already exists. Please choose a different name.`);
            }
        }

        // Description validation
        if (categoryData.description !== undefined && categoryData.description !== null && typeof categoryData.description !== 'string') {
            errors.push('Category description must be a string');
        }

        // Meta title validation
        if (categoryData.meta_title !== undefined && categoryData.meta_title !== null && typeof categoryData.meta_title !== 'string') {
            errors.push('Meta title must be a string');
        }

        return { isValid: errors.length === 0, errors };
    }

    /**
     * Validates category ID
     * @param {string} categoryId - Category ID to validate
     * @returns {Object} Validation result
     */
    validateCategoryId(categoryId) {
        if (!categoryId || typeof categoryId !== 'string' || categoryId.trim().length === 0) {
            return { isValid: false, error: 'Category ID is required and must be a valid string' };
        }
        return { isValid: true };
    }

    // ============ SLUG UTILITY METHODS ============
    
    /**
     * Generate a URL-friendly slug from a string
     * @param {string} text - Text to convert to slug
     * @returns {string} Generated slug
     */
    generateSlug(text) {
        return text
            .toString()
            .toLowerCase()
            .trim()
            .replace(/\s+/g, '-')           // Replace spaces with -
            .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
            .replace(/\-\-+/g, '-')         // Replace multiple - with single -
            .replace(/^-+/, '')             // Trim - from start of text
            .replace(/-+$/, '');            // Trim - from end of text
    }

    /**
     * Generate a unique slug for a category
     * @param {string} name - Category name
     * @param {string} excludeId - Category ID to exclude from uniqueness check (for updates)
     * @returns {Promise<string>} Unique slug
     */
    async generateUniqueSlug(name, excludeId = null) {
        let baseSlug = this.generateSlug(name);
        let slug = baseSlug;
        let counter = 1;

        while (true) {
            const whereClause = { slug };
            if (excludeId) {
                whereClause.id = { [Op.ne]: excludeId };
            }

            const existingCategory = await Category.findOne({ where: whereClause });
            
            if (!existingCategory) {
                return slug;
            }

            slug = `${baseSlug}-${counter}`;
            counter++;
        }
    }

    /**
     * Validate slug format
     * @param {string} slug - Slug to validate
     * @returns {Object} Validation result
     */
    validateSlug(slug) {
        if (!slug || typeof slug !== 'string') {
            return { isValid: false, error: 'Slug is required and must be a string' };
        }

        const slugRegex = /^[a-z0-9-]+$/;
        if (!slugRegex.test(slug)) {
            return { isValid: false, error: 'Slug can only contain lowercase letters, numbers, and hyphens' };
        }

        if (slug.length < 2) {
            return { isValid: false, error: 'Slug must be at least 2 characters long' };
        }

        if (slug.length > 100) {
            return { isValid: false, error: 'Slug must not exceed 100 characters' };
        }

        return { isValid: true };
    }

    // ============ MULTER CONFIGURATION ============
    setupMulterConfiguration() {
        this.categoryImageUpload = multer({
            storage: multer.memoryStorage(),
            limits: { fileSize: CONSTANTS.FILE_TYPES.CATEGORY_IMAGES.MAX_SIZE },
            fileFilter: (req, file, cb) => {
                const filetypes = CONSTANTS.FILE_TYPES.CATEGORY_IMAGES.EXTENSIONS;
                const mimetype = filetypes.test(file.mimetype);
                const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
                
                if (mimetype && extname) {
                    return cb(null, true);
                }
                cb(new Error(`Category image upload only supports the following filetypes - ${filetypes}`));
            },
        });
    }

    // ============ UTILITY METHODS ============
    async safeFileDelete(fileUrl, description = 'file') {
        try {
            if (fileUrl && fileUrl.includes('digitaloceanspaces.com')) {
                const urlParts = fileUrl.split('/');
                const key = urlParts.slice(-2).join('/'); // Get folder/filename part
                
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

    /**
     * Create a new category with optional image
     * @param {Object} categoryData - Category data
     * @param {Object} imageFile - Optional image file
     * @returns {Promise<Object>} Created category
     */
    async createCategory(categoryData, imageFile) {
        try {
            const validation = await this.validateCategoryData(categoryData, false);
            if (!validation.isValid) {
                throw {
                    status: 'error',
                    statusCode: 400,
                    message: 'Validation failed',
                    details: validation.errors
                };
            }

            const { name, description, parent_id, meta_title, sort_order, slug } = categoryData;
            
            let level = 0;
            let processedParentId = null;

            const existingCategory = await Category.findOne({
                where: { name: name.trim() }
            });

            if(existingCategory) {
                throw {
                    status: 'error',
                    statusCode: 400,
                    message: `Category with name '${name.trim()}' already exists. Please choose a different name.`,
                }
            }

            const finalSlug = slug ? slug : await this.generateUniqueSlug(name);
            
            // Process parent_id more carefully
            if (parent_id && parent_id !== '' && parent_id !== 'null' && parent_id !== 'undefined') {
                processedParentId = String(parent_id).trim();
                
                // Validate that parent exists
                const parentCategory = await Category.findByPk(processedParentId);
                if (!parentCategory) {
                    throw {
                        status: 'error',
                        statusCode: 404,
                        message: 'Parent category not found in our records.'
                    }
                }
                
                level = parentCategory.level + 1;
                
                // Update parent to be marked as parent
                await Category.update(
                    { is_parent: true },
                    { where: { id: processedParentId } }
                );
            }

            const categoryPayload = {
                name: name.trim(),
                slug: finalSlug,
                description: description ? description.trim() : null,
                parent_id: processedParentId,
                level,
                meta_title: meta_title ? meta_title.trim() : null,
                sort_order: parseInt(sort_order) || 0,
                created_at: new Date(),
                updated_at: new Date()
            };

            // Upload image to DigitalOcean Spaces if provided
            if (imageFile) {
                const imageUrl = await uploadToSpaces(
                    imageFile.buffer,
                    imageFile.originalname,
                    CONSTANTS.SPACES_FOLDERS.CATEGORY_IMAGES,
                    'public-read'
                );
                categoryPayload.image_url = imageUrl;
            }
            
            const category = await Category.create(categoryPayload);
            
            logger.info(`Category created successfully: ${category.id}`);
            return category;
        } catch (error) {
            logger.error('Error creating category:', error);
            
            // Handle Sequelize unique constraint errors
            if (error.name === 'SequelizeUniqueConstraintError') {
                throw {
                    status: 'error',
                    statusCode: 400,
                    message: 'A category with this name already exists. Please choose a different name.',
                    details: ['Category names must be unique across the system.']
                };
            }
            
            // Handle other Sequelize validation errors
            if (error.name === 'SequelizeValidationError') {
                const validationErrors = error.errors.map(err => err.message);
                throw {
                    status: 'error',
                    statusCode: 400,
                    message: 'Validation failed',
                    details: validationErrors
                };
            }
            
            throw error;
        }
    }
    
    /**
     * Edit an existing category
     * @param {string} categoryId - Category ID to update
     * @param {Object} updateData - Updated category data
     * @returns {Promise<Object>} Updated category
     */
    async editCategory(categoryId, updateData) {
        try {
            // Validate category ID
            const idValidation = this.validateCategoryId(categoryId);
            if (!idValidation.isValid) {
                throw {
                    status: 'error',
                    statusCode: 400,
                    message: idValidation.error
                };
            }

            // Validate update data with database checks, excluding current category
            const validation = await this.validateCategoryData(updateData, true, categoryId);
            if (!validation.isValid) {
                throw {
                    status: 'error',
                    statusCode: 400,
                    message: 'Validation failed',
                    details: validation.errors
                };
            }

            const category = await Category.findByPk(categoryId);
            if (!category) {
                throw {
                    status: 'error',
                    statusCode: 404,
                    message: 'Category not found in our records.'
                }
            }
            
            const { name, description, image_url, parent_id, meta_title, sort_order } = updateData;

            const existingCategory = await Category.findOne({
                where: { name: name.trim() }
            });

            if(existingCategory) {
                throw {
                    status: 'error',
                    statusCode: 400,
                    message: `Category with name '${name.trim()}' already exists. Please choose a different name.`,
                }
            }

            if (name && name.trim() !== category.name) {
                const existingCategory = await Category.findOne({
                    where: { 
                        name: name.trim(),
                        id: { [Op.ne]: categoryId }
                    }
                });

                if(existingCategory) {
                    throw {
                        status: 'error',
                        statusCode: 400,
                        message: `Category with name '${name.trim()}' already exists. Please choose a different name.`,
                    }
                }
            }
            
            let level = category.level;
            let finalSlug = category.slug;

            // Generate new slug if name changed and no manual slug provided
            if (name && name.trim() !== category.name && !slug) {
                finalSlug = await this.generateUniqueSlug(name, categoryId);
            } else if (slug && slug !== category.slug) {
                finalSlug = slug;
            }
            
            // If parent_id is being changed
            if (parent_id !== undefined && parent_id !== category.parent_id) {
                if (parent_id) {
                    const parentCategory = await Category.findByPk(parent_id);
                    if (!parentCategory) {
                        throw {
                            status: 'error',
                            statusCode: 404,
                            message: 'New parent category not found in our records.'
                        }
                    }
                    level = parentCategory.level + 1;
                    
                    // Update new parent to be marked as parent
                    await Category.update(
                        { is_parent: true },
                        { where: { id: parent_id } }
                    );
                } else {
                    level = 0;
                }
                
                // Check if old parent still has children
                if (category.parent_id) {
                    const siblingCount = await Category.count({
                        where: { 
                            parent_id: category.parent_id,
                            id: { [Op.ne]: categoryId },
                            is_active: true
                        }
                    });
                    
                    if (siblingCount === 0) {
                        await Category.update(
                            { is_parent: false },
                            { where: { id: category.parent_id } }
                        );
                    }
                }
            }
            
            const updatePayload = {
                name: name ? name.trim() : category.name,
                slug: finalSlug,
                description: description !== undefined ? (description ? description.trim() : null) : category.description,
                image_url: image_url !== undefined ? image_url : category.image_url,
                parent_id: parent_id !== undefined ? parent_id : category.parent_id,
                level,
                meta_title: meta_title !== undefined ? (meta_title ? meta_title.trim() : null) : category.meta_title,
                sort_order: sort_order !== undefined ? sort_order : category.sort_order,
                updated_at: new Date()
            };
            
            await Category.update(updatePayload, { where: { id: categoryId } });
            
            logger.info(`Category updated successfully: ${categoryId}`);
            return await Category.findByPk(categoryId);
        } catch (error) {
            logger.error('Error updating category:', error);
            
            // Handle Sequelize unique constraint errors
            if (error.name === 'SequelizeUniqueConstraintError') {
                throw {
                    status: 'error',
                    statusCode: 400,
                    message: 'A category with this name already exists. Please choose a different name.',
                    details: ['Category names must be unique across the system.']
                };
            }
            
            // Handle other Sequelize validation errors
            if (error.name === 'SequelizeValidationError') {
                const validationErrors = error.errors.map(err => err.message);
                throw {
                    status: 'error',
                    statusCode: 400,
                    message: 'Validation failed',
                    details: validationErrors
                };
            }
            
            throw error;
        }
    }

     /**
     * Get category by slug with all children
     * @param {string} slug - Category slug
     * @returns {Promise<Object>} Category with hierarchical children
     */
    async getCategoryBySlug(slug) {
        try {
            const category = await Category.findOne({
                where: { 
                    slug: slug.trim(),
                    is_active: true 
                }
            });

            if (!category) {
                throw {
                    status: 'error',
                    statusCode: 404,
                    message: 'Category not found with the provided slug.'
                };
            }

            // Get all parents (breadcrumb)
            const parents = [];
            let currentCategory = category;
            
            while (currentCategory.parent_id) {
                const parent = await Category.findOne({
                    where: { 
                        id: currentCategory.parent_id,
                        is_active: true 
                    }
                });
                if (parent) {
                    parents.unshift(parent);
                    currentCategory = parent;
                } else {
                    break;
                }
            }

            // Get all descendants recursively
            const getAllDescendants = async (parentId) => {
                const directChildren = await Category.findAll({
                    where: { 
                        parent_id: parentId,
                        is_active: true
                    },
                    order: [['sort_order', 'ASC'], ['name', 'ASC']]
                });
                
                const descendants = [];
                for (const child of directChildren) {
                    const childDescendants = await getAllDescendants(child.id);
                    descendants.push({
                        ...child.toJSON(),
                        children: childDescendants
                    });
                }
                
                return descendants;
            };

            const children = await getAllDescendants(category.id);

            // Get direct children for quick access
            const directChildren = await Category.findAll({
                where: { 
                    parent_id: category.id,
                    is_active: true
                },
                order: [['sort_order', 'ASC'], ['name', 'ASC']]
            });

            // Get sibling categories (same parent)
            let siblings = [];
            if (category.parent_id) {
                siblings = await Category.findAll({
                    where: { 
                        parent_id: category.parent_id,
                        is_active: true,
                        id: { [Op.ne]: category.id }
                    },
                    order: [['sort_order', 'ASC'], ['name', 'ASC']]
                });
            }

            return {
                category: category.toJSON(),
                parents,
                children, // All descendants with nested structure
                direct_children: directChildren, // Only direct children
                siblings,
                breadcrumb: [...parents, category],
                meta: {
                    total_children: children.length,
                    total_direct_children: directChildren.length,
                    level: category.level,
                    has_children: directChildren.length > 0,
                    has_siblings: siblings.length > 0
                }
            };
        } catch (error) {
            logger.error('Error fetching category by slug:', error);
            throw error;
        }
    }
    
    // Get all categories with hierarchical structure
    async getAllCategories(includeInactive = false) {
        try {
            const whereClause = includeInactive ? {} : { is_active: true };
            
            const categories = await Category.findAll({
                where: whereClause,
                order: [['level', 'ASC'], ['sort_order', 'ASC'], ['name', 'ASC']]
            });
            
            // Build hierarchical structure
            const categoryMap = {};
            const rootCategories = [];
            
            categories.forEach(category => {
                categoryMap[category.id] = {
                    ...category.toJSON(),
                    children: []
                };
            });
            
            categories.forEach(category => {
                if (category.parent_id && categoryMap[category.parent_id]) {
                    categoryMap[category.parent_id].children.push(categoryMap[category.id]);
                } else {
                    rootCategories.push(categoryMap[category.id]);
                }
            });
            
            return rootCategories;
        } catch (error) {
            logger.error('Error fetching categories:', error);
            throw error;
        }
    }
    
    /**
     * Soft delete a category
     * @param {string} categoryId - Category ID to delete
     * @returns {Promise<Object>} Success message
     */
    async deleteCategory(categoryId) {
        try {
            // Validate category ID
            const idValidation = this.validateCategoryId(categoryId);
            if (!idValidation.isValid) {
                throw {
                    status: 'error',
                    statusCode: 400,
                    message: idValidation.error
                };
            }

            const category = await Category.findByPk(categoryId);

            if (!category) {
                throw {
                    status: 'error',
                    statusCode: 404,
                    message: 'Category not found in our records.'
                };
            }
            
            // Check if category has active children
            const childrenCount = await Category.count({
                where: { 
                    parent_id: categoryId,
                    is_active: true
                }
            });
            
            if (childrenCount > 0) {
                throw {
                    status: 'error',
                    statusCode: 400,
                    message: 'Cannot delete category with active children'
                };
            }
            
            // Soft delete the category
            await Category.update(
                { 
                    is_active: false,
                    updated_at: new Date()
                },
                { where: { id: categoryId } }
            );
            
            // Check if parent still has active children
            if (category.parent_id) {
                const activeSiblingCount = await Category.count({
                    where: { 
                        parent_id: category.parent_id,
                        is_active: true
                    }
                });
                
                if (activeSiblingCount === 0) {
                    await Category.update(
                        { is_parent: false },
                        { where: { id: category.parent_id } }
                    );
                }
            }
            
            logger.info(`Category soft deleted successfully: ${categoryId}`);
            return { message: 'Category deleted successfully' };
        } catch (error) {
            logger.error('Error deleting category:', error);
            throw error;
        }
    }
    
    /**
     * Get category info with nested parent/children relationships
     * @param {string} categoryId - Category ID
     * @returns {Promise<Object>} Category info with relationships
     */
    async getCategoryInfo(categoryId) {
        try {
            // Validate category ID
            const idValidation = this.validateCategoryId(categoryId);

            if (!idValidation.isValid) {
                throw {
                    status: 'error',
                    statusCode: 400,
                    message: idValidation.error
                };
            }

            const category = await Category.findByPk(categoryId);

            if (!category) {
                throw {
                    status: 'error',
                    statusCode: 404,
                    message: 'Category not found in our records.'
                };
            }
            
            // Get all parents (breadcrumb)
            const parents = [];
            let currentCategory = category;
            
            while (currentCategory.parent_id) {
                const parent = await Category.findByPk(currentCategory.parent_id);
                if (parent) {
                    parents.unshift(parent);
                    currentCategory = parent;
                } else {
                    break;
                }
            }
            
            // Get direct children
            const children = await Category.findAll({
                where: { 
                    parent_id: categoryId,
                    is_active: true
                },
                order: [['sort_order', 'ASC'], ['name', 'ASC']]
            });
            
            // Get all descendants recursively
            const getAllDescendants = async (parentId) => {
                const directChildren = await Category.findAll({
                    where: { 
                        parent_id: parentId,
                        is_active: true
                    },
                    order: [['sort_order', 'ASC'], ['name', 'ASC']]
                });
                
                const descendants = [];
                for (const child of directChildren) {
                    const childDescendants = await getAllDescendants(child.id);
                    descendants.push({
                        ...child.toJSON(),
                        children: childDescendants
                    });
                }
                
                return descendants;
            };
            
            const descendants = await getAllDescendants(categoryId);
            
            return {
                category: category.toJSON(),
                parents,
                children,
                descendants,
                breadcrumb: [...parents, category]
            };
        } catch (error) {
            logger.error('Error fetching category info:', error);
            throw error;
        }
    }
    
    /**
     * Change category image with file upload
     * @param {string} categoryId - Category ID
     * @param {Object} imageFile - Image file object
     * @returns {Promise<Object>} Updated category
     */
    async changeCategoryImage(categoryId, imageFile) {
        try {
            // Validate category ID
            const idValidation = this.validateCategoryId(categoryId);

            if (!idValidation.isValid) {
                throw {
                    status: 'error',
                    statusCode: 400,
                    message: idValidation.error
                };
            }

            const category = await Category.findByPk(categoryId);

            if (!category) {
                throw {
                    status: 'error',
                    statusCode: 404,
                    message: 'Category not found in our records.'
                }
            }

            if (!imageFile) {
                throw {
                    status: 'error',
                    statusCode: 400,
                    message: 'Image file is required.'
                }
            }

            // Delete old image from DigitalOcean Spaces if exists
            if (category.image_url) {
                await this.safeFileDelete(category.image_url, 'old category image');
            }

            // Upload new image to DigitalOcean Spaces
            const newImageUrl = await uploadToSpaces(
                imageFile.buffer,
                imageFile.originalname,
                CONSTANTS.SPACES_FOLDERS.CATEGORY_IMAGES,
                'public-read'
            );
            
            await Category.update(
                { 
                    image_url: newImageUrl,
                    updated_at: new Date()
                },
                { where: { id: categoryId } }
            );
            
            logger.info(`Category image updated successfully: ${categoryId}`);
            return await Category.findByPk(categoryId);
        } catch (error) {
            logger.error('Error updating category image:', error);
            throw error;
        }
    }

    /**
     * Remove category image
     * @param {string} categoryId - Category ID
     * @returns {Promise<Object>} Updated category
     */
    async removeCategoryImage(categoryId) {
        try {
            // Validate category ID
            const idValidation = this.validateCategoryId(categoryId);

            if (!idValidation.isValid) {
                throw {
                    status: 'error',
                    statusCode: 400,
                    message: idValidation.error
                };
            }

            const category = await Category.findByPk(categoryId);
            
            if (!category) {
                throw {
                    status: 'error',
                    statusCode: 404,
                    message: 'Category not found in our records.'
                }
            }

            // Delete image from DigitalOcean Spaces if exists
            if (category.image_url) {
                await this.safeFileDelete(category.image_url, 'category image');
            }

            await Category.update(
                { 
                    image_url: null,
                    updated_at: new Date()
                },
                { where: { id: categoryId } }
            );
            
            logger.info(`Category image removed successfully: ${categoryId}`);
            return await Category.findByPk(categoryId);
        } catch (error) {
            logger.error('Error removing category image:', error);
            throw error;
        }
    }

    /**
     * Get categories by level
     * @param {number} level - Category level
     * @returns {Promise<Array>} Categories at specified level
     */
    async getCategoriesByLevel(level) {
        try {
            // Basic validation for level parameter
            if (level === undefined || level === null) {
                throw {
                    status: 'error',
                    statusCode: 400,
                    message: 'Level parameter is required'
                };
            }

            const categories = await Category.findAll({
                where: { 
                    level,
                    is_active: true
                },
                order: [['sort_order', 'ASC'], ['name', 'ASC']]
            });
            
            return categories;
        } catch (error) {
            logger.error('Error fetching categories by level:', error);
            throw error;
        }
    }

    // ============ MULTER MIDDLEWARE GETTER ============
    getCategoryImageUploadMiddleware() {
        return this.categoryImageUpload.single('image');
    }
}

module.exports = new CategoryService();