const {
    Tax,
} = require('../../configurations/associations');
const logger = require('../../logger/logger');
const { Op } = require('sequelize');

class TaxService {
  // create a new tax
  async createTax(taxData) {
    if (!taxData.name || !taxData.rate) {
      throw {
        status: "error",
        statusCode: 400,
        message: "Name and rate are required to create a tax record.",
      };
    }

    const existingTaxRate = await Tax.findOne({
      where: {
        rate: taxData.rate,
        is_inactive: false,
      },
    });

    if (existingTaxRate) {
      throw {
        status: "error",
        statusCode: 400,
        message: `A tax with rate ${taxData.rate} already exists.`,
      };
    }

    const newTax = await Tax.create({
      name: taxData.name,
      rate: taxData.rate,
      is_inactive: false,
      created_at: new Date(),
      updated_at: new Date(),
    });

    await newTax.save();

    return newTax;
  }

  // edit a tax
  async editTax(taxId, taxData) {
    if(!taxId || !this.isValidUUID(taxId)) {
        this.requestFailure();
    }

    if(!taxData) {
        throw {
            status: 'error',
            statusCode: 400,
            message: 'Tax data is required to update a tax record.'
        }
    }

    const tax = await Tax.findByPk(taxId);

    if (!tax) {
      throw {
        status: "error",
        statusCode: 404,
        message: "Tax not found in our records.",
      };
    }

    tax.name = taxData.name || tax.name;
    tax.rate = taxData.rate || tax.rate;
    tax.is_inactive =
      taxData.is_inactive !== undefined ? taxData.is_inactive : tax.is_inactive;

    tax.updated_at = new Date();
    await tax.save();

    return tax;
  }

  // delete a tax
  async deleteTax(taxId) {
    if(!taxId || !this.isValidUUID(taxId)) {
        this.requestFailure();
    }

    const tax = await Tax.findByPk(taxId);

    if(!tax) {
        throw {
            status: 'error',
            statusCode: 404,
            messsage: 'Tax not found in our records.'
        }
    }

    if(tax.is_inactive) {
        throw {
            status: 'error',
            statusCode: 400,
            message: 'This tax is already inactive and cannot be deleted.'
        }
    }

    tax.is_inactive = true;

    await tax.save();

    return tax;
  }

  // display all taxes
  async getAllTaxesList(
    page = 1,
    limit = 10,
    filters = {},
    sortBy = "created_at",
    sortOrder = "DESC",
    search = ""
  ) {
    const parsedPage = parseInt(page, 10);
    const parsedLimit = parseInt(limit, 10);
    const offset = (parsedPage - 1) * parsedLimit;
  
    const whereClause = {
      is_inactive: false,
    };
  
    // Add search
    if (search && search.trim() !== "") {
      whereClause[Op.or] = [
        {
          name: {
            [Op.iLike]: `%${search.trim()}%`
          }
        }
      ];
    }
  
    // Add filters
    if (filters.rate) {
      whereClause.rate = filters.rate;
    }
  
    if (filters.min_rate !== undefined || filters.max_rate !== undefined) {
      whereClause.rate = {};
      if (filters.min_rate !== undefined) {
        whereClause.rate[Op.gte] = parseFloat(filters.min_rate);
      }
      if (filters.max_rate !== undefined) {
        whereClause.rate[Op.lte] = parseFloat(filters.max_rate);
      }
    }
  
    // Validate sort
    const allowedSortFields = ['name', 'rate', 'created_at', 'updated_at'];
    const validSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
    const validSortOrder = ['ASC', 'DESC'].includes(sortOrder.toUpperCase()) 
      ? sortOrder.toUpperCase() 
      : 'DESC';
  
    const { count, rows: taxes } = await Tax.findAndCountAll({
      where: whereClause,
      offset: offset,
      limit: parsedLimit,
      order: [[validSortBy, validSortOrder]]
    });
  
    const totalPages = Math.ceil(count / parsedLimit);
  
    return {
      taxes: taxes,
      pagination: {
        current_page: parsedPage,
        per_page: parsedLimit,
        total_items: count,
        total_pages: totalPages,
        has_next_page: parsedPage < totalPages,
        has_prev_page: parsedPage > 1
      }
    };
  }

  // helper functions
  requestFailure() {
    throw {
      status: "error",
      statusCode: 400,
      message: "Request has been failed, please try again later.",
    };
  }

  isValidUUID(value) {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(value);
  }
}

module.exports = new TaxService();