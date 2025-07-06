const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require("../../../configurations/db");

const ProductCategory = sequelize.define(
  "product_categories",
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: Sequelize.UUIDV4,
      allowNull: false,
    },
    product_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "products",
        key: "id",
      },
    },
    category_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "categories",
        key: "id",
      },
    },
    is_primary: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
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
    tableName: "product_categories",
    timestamps: false,
    indexes: [
      {
        unique: true,
        fields: ["product_id", "category_id"],
      },
    ],
  }
);

module.exports = ProductCategory;