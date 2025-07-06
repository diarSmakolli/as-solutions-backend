const express = require("express");
const router = express.Router();
const CompanyController = require("./company.controller");
const authGuard = require("../../guards/auth.guard");
const companyService = require("./company.service");
const roleGuard = require("../../guards/role.guard");

// API routes
router.post(
  "/create",
  authGuard,
  roleGuard("global-administrator", "administrator"),
  companyService.getLogoUploadMiddleware(),
  CompanyController.createCompany
);
router.get(
  "/info-company/:companyId",
  authGuard,
  CompanyController.getCompanyInfo
);
router.delete(
  "/mark-inactive/:companyId",
  authGuard,
  roleGuard("global-administrator", "administrator"),
  CompanyController.makeCompanyInactive
);
router.put(
  "/update/:companyId",
  authGuard,
  roleGuard("global-administrator", "administrator", "supplier"),
  CompanyController.editCompany
);
router.get(
  "/get-all-users/:companyId",
  authGuard,
  CompanyController.getAllUsersOfCompany
);
router.get(
  "/get-all-companies-for-select",
  authGuard,
  CompanyController.getAllCompaniesForSelect
);
router.put(
  "/mark-active/:companyId",
  authGuard,
  roleGuard("global-administrator", "administrator"),
  CompanyController.makeCompanyActive
);
router.get(
  "/companies-list",
  authGuard,
  roleGuard("global-administrator", "administrator"),
  CompanyController.getAllCompaniesList
);
router.put(
  "/:companyId/change-logo",
  authGuard,
  roleGuard("global-administrator", "administrator"),
  companyService.getLogoUploadMiddleware(),
  CompanyController.changeCompanyLogo
);
router.post(
  "/:companyId/assets",
  authGuard,
  roleGuard("global-administrator", "administrator", "supplier"),
  companyService.getAssetImagesUploadMiddleware(),
  CompanyController.createCompanyAsset
);

router.get(
  "/:companyId/assets",
  authGuard,
  roleGuard("global-administrator", "administrator", "supplier"),
  CompanyController.getAllCompanyAssets
);

router.put(
  "/:companyId/assets/:assetId",
  authGuard,
  roleGuard("global-administrator", "administrator", "supplier"),
  CompanyController.editCompanyAsset
);

router.delete(
  "/:companyId/assets/:assetId",
  authGuard,
  roleGuard("global-administrator", "administrator", "supplier"),
  CompanyController.deleteCompanyAsset
);

router.put(
  "/:companyId/assets/:assetId/status",
  authGuard,
  roleGuard("global-administrator", "administrator", "supplier"),
  CompanyController.updateCompanyAssetStatus
);

router.post(
  "/:companyId/documents",
  authGuard,
  roleGuard("global-administrator", "administrator", "supplier"),
  companyService.getCompanyDocumentUploadMiddleware(),
  CompanyController.createCompanyDocument
);

// Download a specific document file
router.get(
  "/:companyId/documents/:documentId/download",
  authGuard,
  roleGuard("global-administrator", "administrator", "supplier"),
  CompanyController.downloadCompanyDocument
);

// // Get all documents for a company (with pagination, filtering, sorting)
router.get(
  "/:companyId/documents",
  authGuard,
  roleGuard("global-administrator", "administrator", "supplier"),
  CompanyController.getAllCompanyDocuments
);

// // Get details of a specific document
router.get(
  "/:companyId/documents/:documentId",
  authGuard,
  roleGuard("global-administrator", "administrator", "supplier"),
  CompanyController.getCompanyDocumentDetails
);

// // Edit a specific document of a company (metadata and/or replace file)
router.put(
  "/:companyId/documents/:documentId",
  authGuard,
  roleGuard("global-administrator", "administrator", "supplier"),
  companyService.getCompanyDocumentUploadMiddleware(),
  CompanyController.editCompanyDocument
);

// Delete a specific document of a company
router.delete(
  "/:companyId/documents/:documentId",
  authGuard,
  roleGuard("global-administrator", "administrator"),
  CompanyController.deleteCompanyDocument
);

module.exports = router;
