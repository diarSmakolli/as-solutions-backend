const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require("../../../configurations/db");

const DiscountUsage = sequelize.define(
  "discount_usages",
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: Sequelize.UUIDV4,
      allowNull: false,
    },
    discount_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "discounts",
        key: "id",
      },
    },
    customer_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "customers",
        key: "id",
      },
    },
    order_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "orders",
        key: "id",
      },
    },
    cart_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "carts",
        key: "id",
      },
    },
    discount_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    usage_details: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: "Details about how discount was applied",
    },
    used_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: Sequelize.NOW,
    },
    company_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "companies",
        key: "id",
      },
    },
  },
  {
    tableName: "discount_usages",
    timestamps: false,
  }
);

module.exports = DiscountUsage;
