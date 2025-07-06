const {
    Warehouse,
    Company
} = require('../../configurations/associations');
const { Op } = require('sequelize');
const logger = require('../../logger/logger');

// Constants
const CONSTANTS = {
    WAREHOUSE_TYPES: {
        MAIN: 'main',
        OUTLET: 'outlet',
        WRITE_OFF: 'write_off'
    },
    PAGINATION: {
        DEFAULT_PAGE: 1,
        DEFAULT_LIMIT: 10,
        MAX_LIMIT: 100,
        DEFAULT_SORT_BY: 'created_at',
        DEFAULT_SORT_ORDER: 'DESC',
    },
    RESPONSE_CODES: {
        SUCCESS: 200,
        CREATED: 201,
        BAD_REQUEST: 400,
        NOT_FOUND: 404,
        INTERNAL_ERROR: 500
    },
    CONTACT_INFO: {
        EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        PHONE_REGEX: /^[\+]?[1-9][\d]{0,15}$/
    }
};

class WarehouseService {
    constructor() {
        this.logger = logger;
    }

    // ============ VALIDATION HELPERS ============

    validateUUID(value, fieldName = 'ID') {
        if (!value || !this.isValidUUID(value)) {
            throw {
                status: "error",
                statusCode: CONSTANTS.RESPONSE_CODES.BAD_REQUEST,
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
                statusCode: CONSTANTS.RESPONSE_CODES.BAD_REQUEST,
                message: `Please provide all required fields: ${missingFields.join(', ')}.`,
            };
        }
    }

    validateWarehouseType(type) {
        const validTypes = Object.values(CONSTANTS.WAREHOUSE_TYPES);
        if (!validTypes.includes(type)) {
            throw {
                status: "error",
                statusCode: CONSTANTS.RESPONSE_CODES.BAD_REQUEST,
                message: `Invalid warehouse type. Valid types are: ${validTypes.join(', ')}`,
            };
        }
    }

    validateEmail(email) {
        if (!email) return; // Optional field
        
        if (!CONSTANTS.CONTACT_INFO.EMAIL_REGEX.test(email)) {
            throw {
                status: "error",
                statusCode: CONSTANTS.RESPONSE_CODES.BAD_REQUEST,
                message: "Please provide a valid email address",
            };
        }
    }

    validatePhone(phone) {
        if (!phone) return; // Optional field
        
        if (!CONSTANTS.CONTACT_INFO.PHONE_REGEX.test(phone)) {
            throw {
                status: "error",
                statusCode: CONSTANTS.RESPONSE_CODES.BAD_REQUEST,
                message: "Please provide a valid phone number",
            };
        }
    }

    validateUpdateData(updateData) {
        if (!updateData || Object.keys(updateData).length === 0) {
            throw {
                status: 'error',
                statusCode: CONSTANTS.RESPONSE_CODES.BAD_REQUEST,
                message: 'No update data provided.'
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

        const whereClause = { id: companyId };
        if (!includeInactive) {
            whereClause.is_inactive = false;
        }

        const company = await Company.findOne({ where: whereClause });

        if (!company) {
            throw {
                status: 'error',
                statusCode: CONSTANTS.RESPONSE_CODES.NOT_FOUND,
                message: 'Company not found in our records.'
            };
        }

        return company;
    }

    async findWarehouseById(warehouseId, includeInactive = false) {
        this.validateUUID(warehouseId, 'Warehouse ID');

        const whereClause = { id: warehouseId };

        if (!includeInactive) {
            whereClause.is_active = true;
        }

        const warehouse = await Warehouse.findOne({ where: whereClause });
        if (!warehouse) {
            throw {
                status: 'error',
                statusCode: CONSTANTS.RESPONSE_CODES.NOT_FOUND,
                message: 'Warehouse not found in our records.'
            };
        }

        return warehouse;
    }

    async findWarehouseByIdAndCompany(warehouseId, companyId, includeInactive = false) {
        this.validateUUID(warehouseId, 'Warehouse ID');
        this.validateUUID(companyId, 'Company ID');

        const whereClause = { 
            id: warehouseId, 
            company_id: companyId 
        };
        
        if (!includeInactive) {
            whereClause.is_active = true;
        }

        const warehouse = await Warehouse.findOne({ where: whereClause });

        if (!warehouse) {
            throw {
                status: 'error',
                statusCode: CONSTANTS.RESPONSE_CODES.NOT_FOUND,
                message: 'Warehouse not found or does not belong to this company.'
            };
        }

        return warehouse;
    }

    formatSuccessResponse(statusCode, message, data = null) {
        const response = {
            status: 'success',
            statusCode: statusCode,
            message: message
        };

        if (data !== null) {
            response.data = data;
        }

        return response;
    }

    requestFailed(message = 'Request has been failed, please try again.') {
        throw {
            status: 'error',
            statusCode: CONSTANTS.RESPONSE_CODES.BAD_REQUEST,
            message
        };
    }

    sanitizeWarehouseData(warehouseData) {
        return {
            ...warehouseData,
            name: this.sanitizeString(warehouseData.name),
            type: warehouseData.type || CONSTANTS.WAREHOUSE_TYPES.MAIN,
            city: this.sanitizeString(warehouseData.city),
            country: this.sanitizeString(warehouseData.country),
            address: this.sanitizeString(warehouseData.address),
            postal_code: this.sanitizeString(warehouseData.postal_code),
            contact_email: this.sanitizeString(warehouseData.contact_email),
            contact_phone: this.sanitizeString(warehouseData.contact_phone),
            notes: this.sanitizeString(warehouseData.notes),
            is_active: warehouseData.is_active !== undefined ? warehouseData.is_active : true,
        };
    }

    // ============ WAREHOUSE MANAGEMENT METHODS ============

    // Create a new warehouse
    async createWarehouse(warehouseData, companyId, actingUserId) {
        try {
            if (!warehouseData) {
                this.requestFailed('Warehouse data is required.');
            }

            // Validate required fields
            this.validateRequiredFields(warehouseData, ['name']);

            // Validate company exists
            const company = await this.findCompanyById(companyId);

            // Validate warehouse type if provided
            if (warehouseData.type) {
                this.validateWarehouseType(warehouseData.type);
            }

            // Validate email if provided
            if (warehouseData.contact_email) {
                this.validateEmail(warehouseData.contact_email);
            }

            // Validate phone if provided
            if (warehouseData.contact_phone) {
                this.validatePhone(warehouseData.contact_phone);
            }

            // Sanitize data
            const sanitizedData = this.sanitizeWarehouseData(warehouseData);

            const warehouse = await Warehouse.create({
                ...sanitizedData,
                company_id: companyId,
                created_at: new Date(),
                updated_at: new Date()
            });

            this.logger.info(`Warehouse created with ID: ${warehouse.id} by user ID: ${actingUserId}`);

            return warehouse;

        } catch (error) {
            this.logger.error('Create warehouse failed:', error);
            throw error;
        }
    }

    // Get all warehouses for a company - no need for pagination max 3 - 5 warehouses per company 
    async getWarehousesForCompany(companyId) {
        try {
            // Validate company exists
            const company = await this.findCompanyById(companyId);

            const warehouses = await Warehouse.findAndCountAll({
                where: {
                    company_id: company.id,
                    is_active: true
                },
                order: [[CONSTANTS.PAGINATION.DEFAULT_SORT_BY, CONSTANTS.PAGINATION.DEFAULT_SORT_ORDER]]
            });

            return this.formatSuccessResponse(
                CONSTANTS.RESPONSE_CODES.SUCCESS,
                'Warehouses retrieved successfully',
                {
                    total_items: warehouses.count,
                    warehouses: warehouses.rows
                }
            );

        } catch (error) {
            this.logger.error('Get warehouses for company failed:', error);
            throw error;
        }
    }

    // Copy a warehouse / duplicate a warehouse settings
    async duplicateWarehouse(warehouseId) {
        try {
            const warehouse = await this.findWarehouseById(warehouseId);

            // Get plain object and prepare for duplication
            const warehouseData = warehouse.get({ plain: true });
            
            // Remove fields that should not be duplicated
            delete warehouseData.id;
            delete warehouseData.created_at;
            delete warehouseData.updated_at;

            // Create a new warehouse with the same data
            const newWarehouse = await Warehouse.create({
                ...warehouseData,
                name: `${warehouse.name} (Copy)`,
                created_at: new Date(),
                updated_at: new Date()
            });

            this.logger.info(`Warehouse duplicated with new ID: ${newWarehouse.id} from original ID: ${warehouseId}`);
            
            return this.formatSuccessResponse(
                CONSTANTS.RESPONSE_CODES.CREATED,
                'Warehouse duplicated successfully.',
                newWarehouse
            );
        } catch (error) {
            this.logger.error('Duplicate warehouse failed:', error);
            throw error;
        }
    }

    // Make a warehouse inactive
    async makeWarehouseInactive(warehouseId) {
        try {
            const warehouse = await this.findWarehouseById(warehouseId);

            // Update the warehouse to be inactive
            await warehouse.update({
                is_active: false,
                updated_at: new Date()
            });

            this.logger.info(`Warehouse with ID: ${warehouseId} has been made inactive.`);

            return warehouse;

        } catch (error) {
            this.logger.error('Make warehouse inactive failed:', error);
            throw error;
        }
    }

    // Update a warehouse
    async updateWarehouseDetails(warehouseId, companyId, updateData, actingUserId) {
        try {
            this.validateUpdateData(updateData);

            const warehouse = await this.findWarehouseByIdAndCompany(warehouseId, companyId);

            // Fields that should not be updated directly through this method
            const forbiddenUpdates = ['id', 'company_id', 'created_at', 'updated_at'];

            // Remove forbidden fields
            const sanitizedUpdateData = { ...updateData };
            forbiddenUpdates.forEach(key => {
                delete sanitizedUpdateData[key];
            });

            if (Object.keys(sanitizedUpdateData).length === 0) {
                throw {
                    status: 'error',
                    statusCode: CONSTANTS.RESPONSE_CODES.BAD_REQUEST,
                    message: 'No valid fields provided for update after filtering.'
                };
            }

            // Validate warehouse type if being updated
            if (sanitizedUpdateData.type) {
                this.validateWarehouseType(sanitizedUpdateData.type);
            }

            // Validate email if being updated
            if (sanitizedUpdateData.contact_email) {
                this.validateEmail(sanitizedUpdateData.contact_email);
            }

            // Validate phone if being updated
            if (sanitizedUpdateData.contact_phone) {
                this.validatePhone(sanitizedUpdateData.contact_phone);
            }

            // Sanitize the update data
            const finalUpdateData = this.sanitizeWarehouseData(sanitizedUpdateData);

            await warehouse.update({
                ...finalUpdateData,
                updated_at: new Date()
            });

            this.logger.info(`Warehouse with ID: ${warehouseId} for company ${companyId} updated by user ${actingUserId}. Data: ${JSON.stringify(finalUpdateData)}`);

            const updatedWarehouse = await Warehouse.findByPk(warehouseId);

            return this.formatSuccessResponse(
                CONSTANTS.RESPONSE_CODES.SUCCESS,
                'Warehouse details updated successfully.',
                updatedWarehouse
            );

        } catch (error) {
            this.logger.error('Update warehouse details failed:', error);
            throw error;
        }
    }

    // ============ ADDITIONAL UTILITY METHODS ============

    // Get warehouse details by ID
    async getWarehouseDetails(warehouseId, companyId) {
        try {
            const warehouse = await this.findWarehouseByIdAndCompany(warehouseId, companyId);

            return this.formatSuccessResponse(
                CONSTANTS.RESPONSE_CODES.SUCCESS,
                'Warehouse details retrieved successfully.',
                warehouse
            );

        } catch (error) {
            this.logger.error('Get warehouse details failed:', error);
            throw error;
        }
    }

    // Make warehouse active
    async makeWarehouseActive(warehouseId) {
        try {
            const warehouse = await this.findWarehouseById(warehouseId, true); // Include inactive

            await warehouse.update({
                is_active: true,
                updated_at: new Date()
            });

            this.logger.info(`Warehouse with ID: ${warehouseId} has been made active.`);

            return warehouse;

        } catch (error) {
            this.logger.error('Make warehouse active failed:', error);
            throw error;
        }
    }

    // Get warehouses by type
    async getWarehousesByType(companyId, type) {
        try {
            // Validate company exists
            const company = await this.findCompanyById(companyId);

            // Validate warehouse type
            this.validateWarehouseType(type);

            const warehouses = await Warehouse.findAndCountAll({
                where: {
                    company_id: company.id,
                    type: type,
                    is_active: true
                },
                order: [[CONSTANTS.PAGINATION.DEFAULT_SORT_BY, CONSTANTS.PAGINATION.DEFAULT_SORT_ORDER]]
            });

            return this.formatSuccessResponse(
                CONSTANTS.RESPONSE_CODES.SUCCESS,
                `Warehouses of type '${type}' retrieved successfully`,
                {
                    total_items: warehouses.count,
                    warehouses: warehouses.rows
                }
            );

        } catch (error) {
            this.logger.error('Get warehouses by type failed:', error);
            throw error;
        }
    }

    // Count warehouses by company
    async countWarehousesByCompany(companyId, includeInactive = false) {
        try {
            // Validate company exists
            const company = await this.findCompanyById(companyId);

            const whereClause = { company_id: company.id };
            if (!includeInactive) {
                whereClause.is_active = true;
            }

            const count = await Warehouse.count({ where: whereClause });

            return {
                company_id: companyId,
                total_warehouses: count,
                active_only: !includeInactive
            };

        } catch (error) {
            this.logger.error('Count warehouses by company failed:', error);
            throw error;
        }
    }

    // Get warehouse statistics
    async getWarehouseStatistics(companyId) {
        try {
            // Validate company exists
            const company = await this.findCompanyById(companyId);

            const [activeCount, inactiveCount, typeStats] = await Promise.all([
                Warehouse.count({
                    where: { company_id: company.id, is_active: true }
                }),
                Warehouse.count({
                    where: { company_id: company.id, is_active: false }
                }),
                Warehouse.findAll({
                    where: { company_id: company.id, is_active: true },
                    attributes: [
                        'type',
                        [Warehouse.sequelize.fn('COUNT', Warehouse.sequelize.col('type')), 'count']
                    ],
                    group: ['type'],
                    raw: true
                })
            ]);

            const statistics = {
                company_id: companyId,
                total_warehouses: activeCount + inactiveCount,
                active_warehouses: activeCount,
                inactive_warehouses: inactiveCount,
                warehouses_by_type: typeStats.reduce((acc, stat) => {
                    acc[stat.type] = parseInt(stat.count);
                    return acc;
                }, {})
            };

            return this.formatSuccessResponse(
                CONSTANTS.RESPONSE_CODES.SUCCESS,
                'Warehouse statistics retrieved successfully',
                statistics
            );

        } catch (error) {
            this.logger.error('Get warehouse statistics failed:', error);
            throw error;
        }
    }

    // Bulk update warehouse status
    async bulkUpdateWarehouseStatus(companyId, warehouseIds, isActive, actingUserId) {
        try {
            // Validate company exists
            const company = await this.findCompanyById(companyId);

            // Validate warehouse IDs
            if (!Array.isArray(warehouseIds) || warehouseIds.length === 0) {
                this.requestFailed('Please provide valid warehouse IDs array.');
            }

            warehouseIds.forEach(id => this.validateUUID(id, 'Warehouse ID'));

            const [updatedCount] = await Warehouse.update(
                { 
                    is_active: isActive,
                    updated_at: new Date()
                },
                {
                    where: {
                        id: { [Op.in]: warehouseIds },
                        company_id: company.id
                    }
                }
            );

            const action = isActive ? 'activated' : 'deactivated';
            this.logger.info(`${updatedCount} warehouses ${action} by user ${actingUserId} for company ${companyId}`);

            return this.formatSuccessResponse(
                CONSTANTS.RESPONSE_CODES.SUCCESS,
                `${updatedCount} warehouses ${action} successfully.`,
                {
                    updated_count: updatedCount,
                    warehouse_ids: warehouseIds,
                    new_status: isActive
                }
            );

        } catch (error) {
            this.logger.error('Bulk update warehouse status failed:', error);
            throw error;
        }
    }
}

module.exports = new WarehouseService();