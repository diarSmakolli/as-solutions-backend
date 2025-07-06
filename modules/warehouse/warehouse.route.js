const express = require("express");
const WarehouseController = require("./warehouse.controller");
const authGuard = require("../../guards/auth.guard");
const warehouseService = require("./warehouse.controller");
const roleGuard = require("../../guards/role.guard");

const router = express.Router();
// Create a new warehouse
router.post(
  "/create-warehouse/:companyId",
  authGuard,
  roleGuard("global-administrator", "administrator", "supplier"),
  WarehouseController.createWarehouse
);
// get warehouses for a company
router.get(
  "/get-warehouses/:companyId",
  authGuard,
  roleGuard("global-administrator", "administrator", "supplier"),
  WarehouseController.getWarehousesForCompany
);
// duplicate a warehouse
router.post(
  "/duplicate-warehouse/:warehouseId",
  authGuard,
  roleGuard("global-administrator", "administrator", "supplier"),
  WarehouseController.duplicateWarehouse
);
// inactive a warehouse
router.post(
  "/inactive-warehouse/:warehouseId",
  authGuard,
  roleGuard("global-administrator", "administrator"),
  WarehouseController.makeWarehouseInactive
);
// update a warehouse
router.post(
  "/company/:companyId/update-warehouse/:warehouseId",
  authGuard,
  roleGuard("global-administrator", "administrator", "supplier"),
  WarehouseController.updateWarehouseDetails
);

module.exports = router;
