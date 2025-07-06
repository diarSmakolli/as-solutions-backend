const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require("../../../configurations/db");

const ProductService = sequelize.define("product_services", {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: Sequelize.UUIDV4,
    allowNull: false,
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  description: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  full_description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  slug: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true,
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00,
  },
  thumbnail: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  is_required: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  standalone: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  service_type: {
    type: DataTypes.ENUM(
        "service",
        "support",
        "installation",
        "transport",
        "setup",
        "training",
        "other"
    ),
    allowNull: false,
    defaultValue: "service",
  },
  company_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: "companies",
      key: "id",
    },
  },
  product_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: "products",
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
  }
}, {
    tableName: "product_services",
    timestamps: false,  
});

module.exports = ProductService;
    