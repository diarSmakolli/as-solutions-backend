const WarehouseService = require('./warehouse.service');
const logger = require('../../logger/logger');

class WarehouseController {

    // create a new warehouse
    async createWarehouse(req, res, next) {
        const warehouseData = req.body;
        const { companyId } = req.params;
        const actingUserId = req.account.id;
        try {
            const result = await WarehouseService.createWarehouse(
                warehouseData,
                companyId,
                actingUserId
            );

            return res.status(201).json({
                status: 'success',
                statusCode: 201,
                message: 'Warehouse created successfully.',
                data: result
            });
        } catch(err) {
            logger.error(`createWarehouse: Unexpected error handler: ${err}`);
            next(err);
        }
    }


    // get all warehouses for a company
    async getWarehousesForCompany(req, res, next) {
        const { companyId } = req.params;
        try {
            const result = await WarehouseService.getWarehousesForCompany(
                companyId
            );

            return res.status(200).json(result);
        } catch(err) {
            logger.error(`getWarehousesForCompany: Unexpected error handler: ${err}`);
            next(err);
        }
    }

    // duplicate a warehouse settings
    async duplicateWarehouse(req, res, next) {
        const { warehouseId } = req.params;
        try {
            const result = await WarehouseService.duplicateWarehouse(warehouseId);

            return res.status(200).json({
                status: 'success',
                statusCode: 201,
                message: 'Warehouse duplicated successfully.',
                data: result
            });
        } catch(err) {
            logger.error(`duplicateWarehouse: Unexpected error handler: ${err}`);
            next(err);
        }
    }

    // make a warehouse inactive
    async makeWarehouseInactive(req, res, next) {
        const { warehouseId } = req.params;
        try {
            const result = await WarehouseService.makeWarehouseInactive(warehouseId);

            return res.status(200).json({
                status: 'success',
                statusCode: 200,
                message: 'Warehouse made inactive successfully.',
                data: result
            });
        } catch(err) {
            logger.error(`makeWarehouseInactive: Unexpected error handler: ${err}`);
            next(err);
        }
    }

    // Update warehouse details
    async updateWarehouseDetails(req, res, next) {
        const { companyId, warehouseId } = req.params;
        const updateData = req.body;
        const actingUserId = req.account.id;
        try {
            const result = await WarehouseService.updateWarehouseDetails(
                warehouseId,
                companyId,
                updateData,
                actingUserId
            );
            return res.status(result.statusCode).json(result);
        } catch (err) {
            logger.error(`updateWarehouseDetails: Unexpected error handler: ${err}`);
            next(err);
        }
    }
}

module.exports = new WarehouseController();