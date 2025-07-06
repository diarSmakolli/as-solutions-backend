const Sequelize = require('sequelize');
const dotenv = require('dotenv');
const sequelize = require('../db');

dotenv.config();

// Define entities here
const Administration = require('../../modules/administration/entities/administration.entity');
const Session = require('../../modules/administration/entities/session.entity');
const Activity = require('../../modules/administration/entities/activity.entity');
const Company = require('../../modules/company/entities/company.entity');
const Unit = require('../../modules/company/entities/unit.entity');
const Notification = require('../../modules/notifications-administration/entities/notification.entity');
const Asset = require('../../modules/company/entities/asset.entity');
const CompanyDocument = require('../../modules/company/entities/company.document.entity');
const Warehouse = require('../../modules/warehouse/entities/warehouse.entity');
const Tax = require('../../modules/taxes/tax.entity');
const Category = require('../../modules/category/category.entity');
const Product = require('../../modules/product/entities/product.entity');
const ProductCategory = require('../../modules/product/entities/product.category.entity');
const ProductService = require('../../modules/product/entities/product.service.entity');
const ProductCustomOption = require('../../modules/product/entities/product.customoption.entity');
const ProductCustomOptionValue = require('../../modules/product/entities/product.customoptionvalue.entity');

// Define associations here
Administration.hasMany(Session, {
    foreignKey: 'administration_id',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
    as: 'session'
});

Session.belongsTo(Administration, {
    foreignKey: 'administration_id',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
    as: 'administration'
});

// Administration and Activity associations
Administration.hasMany(Activity, {
    foreignKey: 'administration_id',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
    as: 'activity'
});

Activity.belongsTo(Administration, {
    foreignKey: 'administration_id',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
    as: 'administration'
});

// Company and Unit associations
Company.hasMany(Unit, {
    foreignKey: 'company_id',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
    as: 'unit'
});

Unit.belongsTo(Company, {
    foreignKey: 'company_id',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
    as: 'company'
});

// Administration and Notification associations
Administration.hasMany(Notification, {
    foreignKey: 'administration_id',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
    as: 'notification'
});

Notification.belongsTo(Administration, {
    foreignKey: 'administration_id',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
    as: 'administration'
});
// Company and Administration employee associations
Administration.belongsTo(Company, {
    foreignKey: 'company_id',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
    as: 'company'
});

Company.hasMany(Administration, {
    foreignKey: 'company_id',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
    as: 'administration'
});

// Company And Asset Associations
Company.hasMany(Asset, {
    foreignKey: 'company_id',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
    as: 'asset'
});

Asset.belongsTo(Company, {
    foreignKey: 'company_id',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
    as: 'company'
});

// Company Document associations
Company.hasMany(CompanyDocument, {
    foreignKey: 'company_id',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
    as: 'company_document'
});

CompanyDocument.belongsTo(Company, {
    foreignKey: 'company_id',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
    as: 'company'
});

// Warehouse and Company associations
Company.hasMany(Warehouse, {
    foreignKey: 'company_id',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
    as: 'warehouse'
});

Warehouse.belongsTo(Company, {
    foreignKey: 'company_id',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
    as: 'company'
});

// Category self-referencing association
Category.hasMany(Category, {
    foreignKey: 'parent_id',
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
    as: 'subcategories'
});

Category.belongsTo(Category, {
    foreignKey: 'parent_id',
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
    as: 'parent'
});

// Product, Category and Product Services associations
Company.hasMany(Product, {
    foreignKey: 'company_id',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
    as: 'product'
});

Product.belongsTo(Company, {
    foreignKey: 'company_id',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
    as: 'company'
});

Company.hasMany(Product, {
    foreignKey: 'supplier_id',
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
    as: 'supplier_products'
});

Product.belongsTo(Company, {
    foreignKey: 'supplier_id',
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
    as: 'supplier'
});

Product.belongsTo(Tax, {
    foreignKey: 'tax_id',
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
    as: 'tax'
});

Tax.hasMany(Product, {
    foreignKey: 'tax_id',
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
    as: 'products'
});

Product.belongsToMany(Category, {
    through: ProductCategory,
    foreignKey: 'product_id',
    otherKey: 'category_id',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
    as: 'categories'
});

Category.belongsToMany(Product, {
    through: ProductCategory,
    foreignKey: 'category_id',
    otherKey: 'product_id',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
    as: 'products'
});

// PRODUCT -> PRODUCT CATEGORY (DIRECT ASSOCIATIONN FOR ADVANCED QUERIES)
Product.hasMany(ProductCategory, {
    foreignKey: 'product_id',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
    as: 'product_categories'
});

ProductCategory.belongsTo(Product, {
    foreignKey: 'product_id',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
    as: 'product'
});

Category.hasMany(ProductCategory, {
    foreignKey: 'category_id',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
    as: 'product_categories'
});

ProductCategory.belongsTo(Category, {
    foreignKey: 'category_id',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
    as: 'category'
});

// PRODUCT/PRODUCT SERVICE ASSOCIATIONS
Company.hasMany(ProductService, {
    foreignKey: 'company_id',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
    as: 'product_services'
});

ProductService.belongsTo(Company, {
    foreignKey: 'company_id',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
    as: 'company'
});

Product.hasMany(ProductService, {
    foreignKey: 'product_id',
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
    as: 'product_services'
});

ProductService.belongsTo(Product, {
    foreignKey: 'product_id',
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
    as: 'product'
});

// Product Custom Options associations
Product.hasMany(ProductCustomOption, {
    foreignKey: 'product_id',
    as: 'custom_options',
    onDelete: 'CASCADE'
});

ProductCustomOption.belongsTo(Product, {
    foreignKey: 'product_id',
    as: 'product'
});

ProductCustomOption.hasMany(ProductCustomOptionValue, {
    foreignKey: 'custom_option_id',
    as: 'option_values',
    onDelete: 'CASCADE'
});

ProductCustomOptionValue.belongsTo(ProductCustomOption, {
    foreignKey: 'custom_option_id',
    as: 'custom_option'
});

// Export models here
module.exports = {
    Administration,
    Session,
    Activity,
    Company,
    Unit,
    Notification,
    Asset,
    CompanyDocument,
    Warehouse,
    Tax,
    Category,
    Product,
    ProductCategory,
    ProductService,
    ProductCustomOption,
    ProductCustomOptionValue,
    sequelize
};