const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require("../../../configurations/db");

const Product = sequelize.define(
  "products",
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: Sequelize.UUIDV4,
      allowNull: false,
    },
    sku: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    slug: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    short_description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    barcode: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    status: {
      type: DataTypes.ENUM("active", "archived"),
      allowNull: false,
      defaultValue: "active",
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    ean: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
    },
    is_available_on_stock: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    shipping_free: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    mark_as_top_seller: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    mark_as_new: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    mark_as_featured: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    is_published: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    is_digital: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    is_physical: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    is_on_sale: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    is_delivery_only: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    is_special_offer: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    has_services: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    has_custom_fields: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    weight: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    weight_unit: {
      type: DataTypes.ENUM("kg", "g", "lbs", "oz"),
      allowNull: true,
      defaultValue: "kg",
    },
    measures_unit: {
      type: DataTypes.ENUM("cm", "mm", "inches", "feet"),
      allowNull: false,
      defaultValue: "cm",
    },
    unit_type: {
      type: DataTypes.ENUM("pcs", "pack", "box"),
      allowNull: false,
      defaultValue: "pcs",
    },
    width: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    height: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    length: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    thickness: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    depth: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    lead_time: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 5, // in days
    },
    // META
    meta_title: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    meta_description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    meta_keywords: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    // PRICES
    purchase_price_nett: { 
      type: DataTypes.DOUBLE,
      allowNull: false,
      defaultValue: 0.0,
    },
    purchase_price_gross: {
      type: DataTypes.DOUBLE,
      allowNull: false,
      defaultValue: 0.0,
    },
    regular_price_nett: {
      type: DataTypes.DOUBLE,
      allowNull: false,
      defaultValue: 0.0,
    },
    regular_price_gross: {
      type: DataTypes.DOUBLE,
      allowNull: false,
      defaultValue: 0.0,
    },
    is_discounted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    discount_percentage_nett: {
      type: DataTypes.DOUBLE,
      allowNull: true,
      defaultValue: 0.0,
    },
    discount_percentage_gross: {
      type: DataTypes.DOUBLE,
      allowNull: true,
      defaultValue: 0.0,
    },
    final_price_nett: {
      type: DataTypes.DOUBLE,
      allowNull: false,
      defaultValue: 0.0,
    },
    final_price_gross: {
      type: DataTypes.DOUBLE,
      allowNull: false,
      defaultValue: 0.0,
    },
    // CUSTOM FIELDS
    custom_details: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
    },
    // IMAGES
    images: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    main_image_url: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    // RANKING ALGORITHMS
    score: {
      type: DataTypes.FLOAT,
      allowNull: true,
      defaultValue: 0.0,
    },
    // FOREIGN KEYS
    supplier_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "companies",
        key: "id",
      },
    },
    tax_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "taxes",
        key: "id",
      },
    },
    company_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "companies",
        key: "id",
      },
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "products",
    timestamps: false,
  }
);

module.exports = Product;
