const {
    Administration,
    Notification,
} = require('../../configurations/associations');
const { Op } = require('sequelize');
const logger = require('../../logger/logger');

// Constants
const CONSTANTS = {
    IMPORTANCE_LEVELS: {
        LOW: 'low',
        MEDIUM: 'medium',
        HIGH: 'high'
    },
    PAGINATION: {
        DEFAULT_PAGE: 1,
        DEFAULT_LIMIT: 10,
        MAX_LIMIT: 100,
        DEFAULT_SORT_BY: 'created_at',
        DEFAULT_SORT_ORDER: 'DESC',
    },
    LINK_TYPES: {
        PRODUCT: 'product',
        USER: 'user',
        ORDER: 'order',
        COMPANY: 'company',
        ASSET: 'asset',
        DOCUMENT: 'document',
        ADMINISTRATION: 'administration'
    }
};

class NotificationService {
    constructor() {
        this.logger = logger;
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

    validateImportanceLevel(importance) {
        const validLevels = Object.values(CONSTANTS.IMPORTANCE_LEVELS);
        if (!validLevels.includes(importance)) {
            throw {
                status: "error",
                statusCode: 400,
                message: `Invalid importance level. Valid levels are: ${validLevels.join(', ')}`,
            };
        }
    }

    validateLinkType(linkType) {
        if (!linkType) return; // Optional field
        
        const validTypes = Object.values(CONSTANTS.LINK_TYPES);
        if (!validTypes.includes(linkType)) {
            throw {
                status: "error",
                statusCode: 400,
                message: `Invalid link type. Valid types are: ${validTypes.join(', ')}`,
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

    // ============ UTILITY METHODS ============

    isValidUUID(value) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return uuidRegex.test(value);
    }

    sanitizeString(str) {
        return typeof str === 'string' ? str.trim() : str;
    }

    async findAccountById(accountId, includeInactive = false) {
        if(!accountId || !this.isValidUUID(accountId)) {
            this.requestFailed();
        }

        this.validateUUID(accountId, 'Account ID');

        const whereClause = { id: accountId };
        if (!includeInactive) {
            whereClause.is_inactive = false;
            whereClause.is_locked = false;
            whereClause.is_blocked_sign_in = false;
        }

        const account = await Administration.findOne({ where: whereClause });

        if (!account) {
            throw {
                status: 'error',
                statusCode: 404,
                message: 'Account not found in our system records.'
            };
        }

        return account;
    }

    async findNotificationById(notificationId, accountId) {
        this.validateUUID(notificationId, 'Notification ID');
        this.validateUUID(accountId, 'Account ID');

        if(!notificationId || !accountId || !this.isValidUUID(notificationId) || !this.isValidUUID(accountId)) {
            this.requestFailed();
        }

        const notification = await Notification.findOne({
            where: {
                id: notificationId,
                administration_id: accountId,
            }
        });

        if (!notification) {
            throw {
                status: 'error',
                statusCode: 404,
                message: 'Notification not found in our system records.'
            };
        }

        return notification;
    }

    formatTimestamps(data) {
        if (Array.isArray(data)) {
            return data.map(item => ({
                ...item.dataValues,
                created_at: item.created_at ? item.created_at.getTime() : null,
                updated_at: item.updated_at ? item.updated_at.getTime() : null,
            }));
        }

        return {
            ...data.dataValues,
            created_at: data.created_at ? data.created_at.getTime() : null,
            updated_at: data.updated_at ? data.updated_at.getTime() : null,
        };
    }

    formatPaginatedResponse(result, page, limit) {
        return {
            total_items: result.count,
            current_page: page,
            total_pages: Math.ceil(result.count / limit),
            items_per_page: limit,
        };
    }

    requestFailed(message = 'Request has been failed, please try again later.') {
        throw {
            status: 'error',
            statusCode: 400,
            message
        };
    }

    // ============ NOTIFICATION MANAGEMENT METHODS ============

    // Create notification
    async createNotification(notificationData) {
        try {
            if (!notificationData) {
                this.requestFailed('Notification data is required');
            }

            // Validate required fields
            this.validateRequiredFields(notificationData, ['title', 'administration_id']);

            // Validate administration exists
            await this.findAccountById(notificationData.administration_id);

            // Validate importance level if provided
            if (notificationData.importance) {
                this.validateImportanceLevel(notificationData.importance);
            }

            // Validate link type if provided
            if (notificationData.link_type) {
                this.validateLinkType(notificationData.link_type);
            }

            // Sanitize and prepare notification data
            const sanitizedNotificationData = {
                title: this.sanitizeString(notificationData.title),
                description: this.sanitizeString(notificationData.description),
                importance: notificationData.importance || CONSTANTS.IMPORTANCE_LEVELS.MEDIUM,
                is_read: false,
                link: this.sanitizeString(notificationData.link),
                link_uuid: this.sanitizeString(notificationData.link_uuid),
                link_type: this.sanitizeString(notificationData.link_type),
                requester_id: this.sanitizeString(notificationData.requester_id),
                administration_id: notificationData.administration_id,
                created_at: new Date(),
                updated_at: new Date(),
            };

            const createNewNotification = await Notification.create(sanitizedNotificationData);

            this.logger.info(`Notification created successfully with ID: ${createNewNotification.id} for user: ${notificationData.administration_id}`);
            return createNewNotification;
        } catch (error) {
            this.logger.error('Create notification failed:', error);
            throw error;
        }
    }

    // Get all notifications self
    async getAllNotificationsSelf(administrationId, page = 1, limit = 10) {
        try {
            if(!administrationId || !this.isValidUUID(administrationId)) {
                this.requestFailed();
            }

            // Validate account exists
            await this.findAccountById(administrationId);

            const { page: parsedPage, limit: parsedLimit } = this.validatePaginationParams(page, limit);
            const offset = (parsedPage - 1) * parsedLimit;

            let notifications = await Notification.findAndCountAll({
                where: {
                    administration_id: administrationId,
                },
                offset: offset,
                limit: parsedLimit,
                order: [[CONSTANTS.PAGINATION.DEFAULT_SORT_BY, CONSTANTS.PAGINATION.DEFAULT_SORT_ORDER]],
            });
            
            // Format timestamps
            const formattedNotifications = this.formatTimestamps(notifications.rows);

            const response = {
                ...this.formatPaginatedResponse(notifications, parsedPage, parsedLimit),
                notifications: formattedNotifications,
            };

            this.logger.info(`Retrieved ${notifications.count} notifications for user: ${administrationId}`);
            return response;

        } catch (error) {
            this.logger.error('Get all notifications self failed:', error);
            throw error;
        }
    }

    // Count of unread notifications self
    async countUnReadNotificationsSelf(accountId) {
        try {
            if(!accountId || !this.isValidUUID(accountId)) {
                this.requestFailed();
            }

            // Validate account exists
            const account = await this.findAccountById(accountId);

            const unread_count = await Notification.count({
                where: {
                    administration_id: account.id,
                    is_read: false,
                }
            });

            this.logger.info(`Unread notifications count for user ${accountId}: ${unread_count}`);
            return unread_count;
        } catch (error) {
            this.logger.error('Count unread notifications self failed:', error);
            throw error;
        }
    }

    // Mark notification as read
    async markNotificationSelfAsRead(notificationId, accountId) {
        try {
            if (!notificationId || !accountId) {
                this.requestFailed('Notification ID and Account ID are required');
            }

            if(!this.isValidUUID(notificationId) || !this.isValidUUID(accountId)) {
                this.requestFailed();
            }

            // Validate account exists
            const account = await this.findAccountById(accountId);

            // Find and validate notification
            const notification = await this.findNotificationById(notificationId, account.id);

            // Mark as read if not already read
            if (!notification.is_read) {
                notification.is_read = true;
                notification.updated_at = new Date();
                await notification.save();

                this.logger.info(`Notification ${notificationId} marked as read for user: ${accountId}`);
            }

            return notification;
        } catch (error) {
            this.logger.error('Mark notification as read failed:', error);
            throw error;
        }
    }

    // Mark all self notifications as read
    async markAllNotificatinsSelfAsRead(accountId) {
        try {
            if(!accountId || !this.isValidUUID(accountId)) {
                this.requestFailed();
            }

            // Validate account exists
            const account = await this.findAccountById(accountId);

            const [updatedRows] = await Notification.update(
                { 
                    is_read: true,
                    updated_at: new Date(),
                },
                {
                    where: {
                        administration_id: account.id,
                        is_read: false
                    }
                }
            );

            this.logger.info(`Marked ${updatedRows} notifications as read for user: ${accountId}`);
            return updatedRows;
        } catch (error) {
            this.logger.error('Mark all notifications as read failed:', error);
            throw error;
        }
    }

    // Delete notification self
    async deleteNotificationSelf(accountId, notificationId) {
        try {
            if (!accountId || !notificationId) {
                this.requestFailed('Account ID and Notification ID are required');
            }

            if(!this.isValidUUID(accountId) || !this.isValidUUID(notificationId)) {
                this.requestFailed();
            }

            // Validate account exists
            const account = await this.findAccountById(accountId);

            // Find and validate notification
            const notification = await this.findNotificationById(notificationId, account.id);

            await notification.destroy();

            this.logger.info(`Notification ${notificationId} deleted successfully for user: ${accountId}`);

            return {
                status: 'success',
                statusCode: 200,
                message: 'Notification deleted successfully.'
            };

        } catch (error) {
            this.logger.error('Delete notification self failed:', error);
            throw error;
        }
    }

    // ============ ADDITIONAL UTILITY METHODS ============

    // Get notifications by importance level
    async getNotificationsByImportance(administrationId, importance, page = 1, limit = 10) {
        try {
            if (!administrationId || !this.isValidUUID(administrationId)) {
                this.requestFailed();
            }

            if(!importance) {
                throw {
                    status: 'error',
                    statusCode: 400,
                    message: 'Importance level is required.'
                }
            }

            // Validate account exists
            await this.findAccountById(administrationId);

            // Validate importance level
            this.validateImportanceLevel(importance);

            const { page: parsedPage, limit: parsedLimit } = this.validatePaginationParams(page, limit);
            const offset = (parsedPage - 1) * parsedLimit;

            const notifications = await Notification.findAndCountAll({
                where: {
                    administration_id: administrationId,
                    importance: importance,
                },
                offset: offset,
                limit: parsedLimit,
                order: [[CONSTANTS.PAGINATION.DEFAULT_SORT_BY, CONSTANTS.PAGINATION.DEFAULT_SORT_ORDER]],
            });

            const formattedNotifications = this.formatTimestamps(notifications.rows);

            const response = {
                ...this.formatPaginatedResponse(notifications, parsedPage, parsedLimit),
                notifications: formattedNotifications,
            };

            return response;

        } catch (error) {
            this.logger.error('Get notifications by importance failed:', error);
            throw error;
        }
    }

    // Get unread notifications only
    async getUnreadNotificationsSelf(administrationId, page = 1, limit = 10) {
        try {
            if(!administrationId || !this.isValidUUID(administrationId)) {
                this.requestFailed();
            }

            // Validate account exists
            await this.findAccountById(administrationId);

            const { page: parsedPage, limit: parsedLimit } = this.validatePaginationParams(page, limit);
            const offset = (parsedPage - 1) * parsedLimit;

            const notifications = await Notification.findAndCountAll({
                where: {
                    administration_id: administrationId,
                    is_read: false,
                },
                offset: offset,
                limit: parsedLimit,
                order: [[CONSTANTS.PAGINATION.DEFAULT_SORT_BY, CONSTANTS.PAGINATION.DEFAULT_SORT_ORDER]],
            });

            const formattedNotifications = this.formatTimestamps(notifications.rows);

            const response = {
                ...this.formatPaginatedResponse(notifications, parsedPage, parsedLimit),
                notifications: formattedNotifications,
            };

            return response;

        } catch (error) {
            this.logger.error('Get unread notifications self failed:', error);
            throw error;
        }
    }

    // Delete all read notifications
    async deleteAllReadNotificationsSelf(accountId) {
        try {
            if(!accountId || !this.isValidUUID(accountId)) {
                this.requestFailed();
            }

            // Validate account exists
            const account = await this.findAccountById(accountId);

            const deletedCount = await Notification.destroy({
                where: {
                    administration_id: account.id,
                    is_read: true
                }
            });

            this.logger.info(`Deleted ${deletedCount} read notifications for user: ${accountId}`);

            return {
                status: 'success',
                statusCode: 200,
                message: `${deletedCount} read notifications deleted successfully.`,
                deleted_count: deletedCount
            };

        } catch (error) {
            this.logger.error('Delete all read notifications failed:', error);
            throw error;
        }
    }
}

module.exports = new NotificationService();