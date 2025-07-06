const taxService = require("./tax.service");
const logger = require("../../logger/logger");

class TaxController {
  async createTax(req, res, next) {
    const taxData = req.body;
    try {
      const result = await taxService.createTax(taxData);

      return res.status(201).json({
        status: "success",
        statusCode: 201,
        message: "Tax has been created successfully.",
        data: result,
      });
    } catch (err) {
      logger.error(`createTax: error: ${err}, err msg: ${err.message}`);
      next(err);
    }
  }

  // edit a tax
  async editTax(req, res, next) {
    const taxId = req.params.taxId;
    const taxData = req.body;
    try {
      const result = await taxService.editTax(taxId, taxData);

      return res.status(200).json({
        status: "success",
        statusCode: 200,
        message: "Tax has been updated successfully.",
        data: result,
      });
    } catch (err) {
      logger.error(`editTax: error: ${err}, err msg: ${err.message}`);
      next(err);
    }
  }

  // delete a tax rate
  async deleteTax(req, res, next) {
    const { taxId } = req.params;
    try {
      const result = await taxService.deleteTax(taxId);

      return res.status(200).json({
        status: "success",
        statusCode: 200,
        message: "Tax has been deleted successfully.",
        data: result,
      });
    } catch (err) {
      logger.error(`deleteTax: error: ${err}, err msg: ${err.message}`);
      next(err);
    }
  }

  // get all taxes
  async getAllTaxesList(req, res, next) {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = "created_at",
        sortOrder = "DESC",
        search = "",
        rate,
        min_rate,
        max_rate,
      } = req.query;

      const filters = {};
      if (rate) filters.rate = rate;
      if (min_rate) filters.min_rate = min_rate;
      if (max_rate) filters.max_rate = max_rate;

      const result = await taxService.getAllTaxesList(
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
        data: result,
      });
    } catch (err) {
      logger.error(`getAllTaxesList: error: ${err}, err msg: ${err.message}`);
      next(err);
    }
  }
}

module.exports = new TaxController();
