const companyService = require("./company.service");
const logger = require("../../logger/logger");
const axios = require('axios');

class CompanyController {
  // create a new company
  async createCompany(req, res, next) {
    try {
      const companyData = req.body;
      const logoFile = req.file; 
      if (!companyData.business_name || !companyData.market_name) {
        logger.warn(
          "Create company attempt with missing required fields: business_name or market_name"
        );
        return res.status(400).json({
          status: "error",
          statusCode: 400,
          message: "Business name and market name are required fields!",
        });
      }

      logger.info(
        `Received request to create company: ${companyData.business_name}`,
        { companyData, hasLogo: !!logoFile }
      );

      const newCompany = await companyService.createCompany(
        companyData,
        logoFile
      );

      logger.info(
        `Company created successfully: ${newCompany.id} - ${newCompany.business_name}`
      );

      return res.status(201).json({
        status: "success",
        statusCode: 201,
        message: "Company created successfully",
        data: newCompany,
      });
    } catch (err) {
      logger.error(`createCompany: ${err.message}`);
      next(err);
    }
  }

  // get info about a specific company
  async getCompanyInfo(req, res, next) {
    const { companyId } = req.params;
    try {
      const result = await companyService.getCompanyInfo(companyId);

      return res.status(200).json({
        status: "success",
        statusCode: 200,
        data: result,
      });
    } catch (err) {
      logger.error(`getCompanyInfo: ${err.message}`);
      next(err);
    }
  }

  // make inactive a company
  async makeCompanyInactive(req, res, next) {
    const { companyId } = req.params;
    try {
      const result = await companyService.makeCompanyInactive(companyId);

      return res.status(200).json({
        status: "success",
        statusCode: 200,
        message: "Company made inactive successfully",
        data: result,
      });
    } catch (err) {
      logger.error(`makeCompanyInactive: ${err.message}`);
      next(err);
    }
  }

  // edit a company
  async editCompany(req, res, next) {
    const { companyId } = req.params;
    const companyData = req.body;
    try {
      const result = await companyService.editCompany(companyId, companyData);

      return res.status(200).json({
        status: "success",
        statusCode: 200,
        message: "Company updated successfully",
        data: result,
      });
    } catch (err) {
      logger.error(`editCompany: ${err.message}`);
      next(err);
    }
  }

  // get all users of a company
  async getAllUsersOfCompany(req, res, next) {
    const { companyId } = req.params;
    try {
      const result = await companyService.getAllUsersOfCompany(companyId);

      return res.status(200).json({
        status: "success",
        statusCode: 200,
        data: result,
      });
    } catch (err) {
      logger.error(`getAllUsersOfCompany: ${err.message}`);
      next(err);
    }
  }

  // get all companies for select
  async getAllCompaniesForSelect(req, res, next) {
    try {
      const result = await companyService.getAllCompaniesForSelect();

      return res.status(200).json({
        status: "success",
        statusCode: 200,
        data: result,
      });
    } catch (err) {
      logger.error(`getAllCompaniesForSelect: ${err.message}`);
      next(err);
    }
  }

  // make company active
  async makeCompanyActive(req, res, next) {
    const { companyId } = req.params;
    try {
      const result = await companyService.makeCompanyActive(companyId);

      return res.status(200).json({
        status: "success",
        statusCode: 200,
        message: "Company made active successfully",
        data: result,
      });
    } catch (err) {
      logger.error(`makeCompanyActive: ${err.message}`);
      next(err);
    }
  }

  // get all companies list
  async getAllCompaniesList(req, res, next) {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = "created_at",
        sortOrder = "DESC",
        search = "",
        is_inactive,
        is_verified,
        country,
        type_of_business,
      } = req.query;

      const filters = {
        is_inactive,
        is_verified,
        country,
        type_of_business,
      };

      Object.keys(filters).forEach((key) => {
        if (filters[key] === undefined || filters[key] === "") {
          delete filters[key];
        }
      });

      logger.info("Controller: Request to get all companies list", {
        page,
        limit,
        sortBy,
        sortOrder,
        search,
        filters,
      });

      const result = await companyService.getAllCompaniesList(
        page,
        limit,
        filters,
        sortBy,
        sortOrder,
        search
      );

      return res.status(200).json({
        status: "success",
        statusCode: 200,
        message: "Companies list retrieved successfully.",
        data: result,
      });
    } catch (error) {
      logger.error(
        `Error in CompanyController.getAllCompaniesList: ${error.message}`,
        { stack: error.stack }
      );
      next(error);
    }
  }

  // change company logo
  async changeCompanyLogo(req, res, next) {
    const { companyId } = req.params;
    const newLogoFile = req.file;
    try {
      if (!newLogoFile) {
        return res.status(400).json({
          status: "error",
          statusCode: 400,
          message: "Logo file is required.",
        });
      }

      const result = await companyService.changeCompanyLogo(
        companyId,
        newLogoFile
      );

      return res.status(200).json({
        status: "success",
        statusCode: 200,
        message: "Company logo updated successfully",
        data: result,
      });
    } catch (err) {
      logger.error(`changeCompanyLogo: ${err.message}`);
      next(err);
    }
  }

  // create company asset
  async createCompanyAsset(req, res, next) {
    const { companyId } = req.params;
    const assetData = req.body;
    const imageFiles = req.files;
    try {
      if (!assetData.asset_name || !assetData.asset_tag) {
        logger.warn(
          `Create asset attempt for company ${companyId} with missing required fields.`
        );
        return res.status(400).json({
          status: "error",
          statusCode: 400,
          message: "Asset name and asset tag are required.",
        });
      }

      logger.info(
        `Received request to create asset for company ID: ${companyId}`,
        {
          assetData: Object.keys(assetData),
          imageCount: imageFiles ? imageFiles.length : 0,
        }
      );
      const newAsset = await companyService.createCompanyAsset(
        companyId,
        assetData,
        imageFiles
      );
      logger.info(
        `Asset created successfully for company ${companyId}: ${newAsset.id}`
      );

      return res.status(201).json({
        status: "success",
        statusCode: 201,
        message: "Company asset created successfully.",
        data: newAsset,
      });
    } catch (err) {
      logger.error(
        `createCompanyAsset Error for company ${companyId}: ${err.message}`,
        { stack: err.stack }
      );
      // Handle specific multer errors if necessary (e.g., file type, size limit)
      if (err.message.includes("File upload only supports")) {
        return res
          .status(400)
          .json({ status: "error", statusCode: 400, message: err.message });
      }
      next(err);
    }
  }

  // get all company assets
  async getAllCompanyAssets(req, res, next) {
    const { companyId } = req.params;
    const {
      page = 1,
      limit = 10,
      sortBy = "created_at",
      sortOrder = "DESC",
      search = "",
      status,
      category,
    } = req.query;

    const filters = { status, category };
    Object.keys(filters).forEach((key) => {
      if (filters[key] === undefined || filters[key] === "") {
        delete filters[key];
      }
    });

    const queryParams = { page, limit, sortBy, sortOrder, search, filters };

    try {
      logger.info(`Request to get all assets for company ID: ${companyId}`, {
        queryParams,
      });
      const result = await companyService.getAllCompanyAssets(
        companyId,
        queryParams
      );
      return res.status(200).json({
        status: "success",
        statusCode: 200,
        message: "Company assets retrieved successfully.",
        data: result,
      });
    } catch (err) {
      logger.error(
        `getAllCompanyAssets Error for company ${companyId}: ${err.message}`,
        { stack: err.stack }
      );
      next(err);
    }
  }

  // edit company asset
  async editCompanyAsset(req, res, next) {
    const { companyId, assetId } = req.params;
    const assetUpdateData = req.body;
    try {
      logger.info(
        `Request to edit asset ID: ${assetId} for company ID: ${companyId}`,
        { assetUpdateData: Object.keys(assetUpdateData) }
      );
      const updatedAsset = await companyService.editCompanyAsset(
        companyId,
        assetId,
        assetUpdateData
      );
      logger.info(
        `Asset ${assetId} updated successfully for company ${companyId}.`
      );
      return res.status(200).json({
        status: "success",
        statusCode: 200,
        message: "Company asset updated successfully.",
        data: updatedAsset,
      });
    } catch (err) {
      logger.error(
        `editCompanyAsset Error for asset ${assetId}, company ${companyId}: ${err.message}`,
        { stack: err.stack }
      );
      next(err);
    }
  }

  // delete company asset
  async deleteCompanyAsset(req, res, next) {
    const { companyId, assetId } = req.params;
    try {
      logger.info(
        `Request to delete asset ID: ${assetId} for company ID: ${companyId}`
      );
      const result = await companyService.deleteCompanyAsset(
        companyId,
        assetId
      );
      logger.info(
        `Asset ${assetId} deleted successfully for company ${companyId}.`
      );
      return res.status(200).json({
        // Or 204 No Content if not returning a message
        status: "success",
        statusCode: 200,
        message: result.message,
      });
    } catch (err) {
      logger.error(
        `deleteCompanyAsset Error for asset ${assetId}, company ${companyId}: ${err.message}`,
        { stack: err.stack }
      );
      next(err);
    }
  }

  // update company asset status
  async updateCompanyAssetStatus(req, res, next) {
    const { companyId, assetId } = req.params;
    const { status } = req.body;

    try {
      if (!status) {
        logger.warn(
          `Update asset status attempt for asset ${assetId} without status.`
        );
        return res.status(400).json({
          status: "error",
          statusCode: 400,
          message: "Status is required.",
        });
      }
      logger.info(
        `Request to update status for asset ID: ${assetId} to "${status}" for company ID: ${companyId}`
      );
      const updatedAsset = await companyService.updateCompanyAssetStatus(
        companyId,
        assetId,
        status
      );
      logger.info(
        `Status for asset ${assetId} updated to ${status} for company ${companyId}.`
      );
      return res.status(200).json({
        status: "success",
        statusCode: 200,
        message: "Company asset status updated successfully.",
        data: updatedAsset,
      });
    } catch (err) {
      logger.error(
        `updateCompanyAssetStatus Error for asset ${assetId}, company ${companyId}: ${err.message}`,
        { stack: err.stack }
      );
      next(err);
    }
  }

  // create company document
  async createCompanyDocument(req, res, next) {
    const { companyId } = req.params;
    const documentData = req.body;
    const documentFile = req.file;
    const uploaderId = req.account.id;
    try {
      if (!uploaderId) {
        logger.warn(
          `Create document attempt for company ${companyId} without uploader ID.`
        );
        return res.status(401).json({
          status: "error",
          statusCode: 401,
          message: "User not authenticated or ID not found.",
        });
      }
      logger.info(
        `Request to create document for company ID: ${companyId} by user ${uploaderId}`,
        { documentName: documentData.document_name, hasFile: !!documentFile }
      );
      const newDocument = await companyService.createCompanyDocument(
        companyId,
        uploaderId,
        documentData,
        documentFile
      );
      logger.info(
        `Document created successfully for company ${companyId}: ${newDocument.id}`
      );
      return res.status(201).json({
        status: "success",
        statusCode: 201,
        message: "Company document created successfully.",
        data: newDocument,
      });
    } catch (err) {
      logger.error(
        `createCompanyDocument Error for company ${companyId}: ${err.message}`,
        { stack: err.stack }
      );
      if (err.message.includes("File upload only supports")) {
        return res
          .status(400)
          .json({ status: "error", statusCode: 400, message: err.message });
      }
      next(err);
    }
  }

  // download company document
  // async downloadCompanyDocument(req, res, next) {
  //   const { companyId, documentId } = req.params;
  //   try {
  //     logger.info(
  //       `Request to download document ID: ${documentId} for company ID: ${companyId}`
  //     );
  //     const { downloadUrl, documentName } =
  //       await companyService.getCompanyDocumentFile(companyId, documentId);

  //     // For DigitalOcean Spaces, redirect to the presigned URL
  //     if (downloadUrl) {
  //       res.redirect(downloadUrl);
  //     } else {
  //       return res.status(404).json({
  //         status: "error",
  //         statusCode: 404,
  //         message: "Document file not found.",
  //       });
  //     }
  //   } catch (err) {
  //     logger.error(
  //       `downloadCompanyDocument Error for document ${documentId}, company ${companyId}: ${err.message}`,
  //       { stack: err.stack }
  //     );
  //     if (!res.headersSent) {
  //       next(err);
  //     }
  //   }
  // }

  async downloadCompanyDocument(req, res, next) {
    const { companyId, documentId } = req.params;
    
    try {
      logger.info(
        `Request to download document ID: ${documentId} for company ID: ${companyId}`
      );
      
      const document = await companyService.getCompanyDocumentFile(companyId, documentId);
      
      if (!document || !document.downloadUrl) {
        return res.status(404).json({
          status: "error",
          statusCode: 404,
          message: "Document file not found"
        });
      }
  
      // Since files are public, proxy the download to avoid CORS issues
      try {
        // Fetch the file from DigitalOcean Spaces
        const fileResponse = await axios({
          method: 'GET',
          url: document.downloadUrl,
          responseType: 'stream',
          timeout: 30000, // 30 seconds timeout
          headers: {
            'User-Agent': 'AS-Solutions-Backend/1.0'
          }
        });
  
        // Set proper headers for download
        const filename = document.documentName || 'document';
        
        // Set download headers
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', fileResponse.headers['content-type'] || document.mimeType || 'application/octet-stream');
        res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, Content-Type, Content-Length');
        
        if (fileResponse.headers['content-length']) {
          res.setHeader('Content-Length', fileResponse.headers['content-length']);
        }
  
        // Pipe the file stream to response
        fileResponse.data.pipe(res);
  
        logger.info(`Document ${documentId} downloaded successfully for company ${companyId}`);
  
      } catch (downloadError) {
        logger.error(`Error downloading file from Spaces: ${downloadError.message}`);
        
        if (downloadError.response?.status === 403) {
          return res.status(403).json({
            status: 'error',
            statusCode: 403,
            message: 'Access denied to file in storage'
          });
        }
        
        if (downloadError.response?.status === 404) {
          return res.status(404).json({
            status: 'error',
            statusCode: 404,
            message: 'File not found in storage'
          });
        }
        
        if (downloadError.code === 'ECONNABORTED') {
          return res.status(408).json({
            status: 'error',
            statusCode: 408,
            message: 'Download timeout - file too large or network slow'
          });
        }
        
        return res.status(500).json({
          status: 'error',
          statusCode: 500,
          message: 'Failed to download file from storage'
        });
      }
  
    } catch (error) {
      logger.error(
        `downloadCompanyDocument Error: ${error.message}`, 
        { 
          stack: error.stack,
          companyId,
          documentId 
        }
      );
      
      if (!res.headersSent) {
        return res.status(500).json({
          status: 'error',
          statusCode: 500,
          message: 'Failed to download document'
        });
      }
    }
  }

  // get all company documents
  async getAllCompanyDocuments(req, res, next) {
    const { companyId } = req.params;
    const {
      page,
      limit,
      sortBy,
      sortOrder,
      search,
      uploaded_by,
      is_confidential,
    } = req.query;
    const filters = { uploaded_by, is_confidential };
    Object.keys(filters).forEach(
      (key) =>
        (filters[key] === undefined || filters[key] === "") &&
        delete filters[key]
    );
    const queryParams = { page, limit, sortBy, sortOrder, search, filters };
    try {
      logger.info(`Request to get all documents for company ID: ${companyId}`, {
        queryParams,
      });
      const result = await companyService.getAllCompanyDocuments(
        companyId,
        queryParams
      );
      return res.status(200).json({
        status: "success",
        statusCode: 200,
        message: "Company documents retrieved successfully.",
        data: result,
      });
    } catch (err) {
      logger.error(
        `getAllCompanyDocuments Error for company ${companyId}: ${err.message}`,
        { stack: err.stack }
      );
      next(err);
    }
  }

  // get company document details
  async getCompanyDocumentDetails(req, res, next) {
    const { companyId, documentId } = req.params;
    try {
      logger.info(
        `Request to get details for document ID: ${documentId}, company ID: ${companyId}`
      );
      const document = await companyService.getCompanyDocumentDetails(
        companyId,
        documentId
      );
      return res.status(200).json({
        status: "success",
        statusCode: 200,
        message: "Document details retrieved successfully.",
        data: document,
      });
    } catch (err) {
      logger.error(
        `getCompanyDocumentDetails Error for document ${documentId}, company ${companyId}: ${err.message}`,
        { stack: err.stack }
      );
      next(err);
    }
  }

  // edit/update company document
  async editCompanyDocument(req, res, next) {
    const { companyId, documentId } = req.params;
    const documentUpdateData = req.body;
    const newDocumentFile = req.file;
    const uploaderId = req.account.id;
    try {
      if (!uploaderId) {
        return res.status(401).json({
          status: "error",
          statusCode: 401,
          message: "User not authenticated or ID not found.",
        });
      }
      logger.info(
        `Request to edit document ID: ${documentId} for company ID: ${companyId} by user ${uploaderId}`,
        { hasNewFile: !!newDocumentFile }
      );
      const updatedDocument = await companyService.editCompanyDocument(
        companyId,
        documentId,
        uploaderId,
        documentUpdateData,
        newDocumentFile
      );
      logger.info(
        `Document ${documentId} updated successfully for company ${companyId}.`
      );
      return res.status(200).json({
        status: "success",
        statusCode: 200,
        message: "Company document updated successfully.",
        data: updatedDocument,
      });
    } catch (err) {
      logger.error(
        `editCompanyDocument Error for document ${documentId}, company ${companyId}: ${err.message}`,
        { stack: err.stack }
      );
      if (err.message.includes("File upload only supports")) {
        return res
          .status(400)
          .json({ status: "error", statusCode: 400, message: err.message });
      }
      next(err);
    }
  }

  // delete company document
  async deleteCompanyDocument(req, res, next) {
    const { companyId, documentId } = req.params;
    try {
      logger.info(
        `Request to delete document ID: ${documentId} for company ID: ${companyId}`
      );
      const result = await companyService.deleteCompanyDocument(
        companyId,
        documentId
      );
      logger.info(
        `Document ${documentId} deleted successfully for company ${companyId}.`
      );
      return res
        .status(200)
        .json({ status: "success", statusCode: 200, message: result.message });
    } catch (err) {
      logger.error(
        `deleteCompanyDocument Error for document ${documentId}, company ${companyId}: ${err.message}`,
        { stack: err.stack }
      );
      next(err);
    }
  }


  
}

module.exports = new CompanyController();
