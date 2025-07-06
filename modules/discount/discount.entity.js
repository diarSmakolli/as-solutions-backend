const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require("../../../configurations/db");

const Discount = sequelize.define(
  "discounts",
  {
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
    discount_type: {
      type: DataTypes.ENUM(
        "amount_off_products",
        "buy_x_get_y",
        "amount_off_order",
        "free_shipping"
      ),
      allowNull: false,
    },
    method: {
      type: DataTypes.ENUM("automatic", "discount_code"),
      defaultValue: "automatic",
    },
    code: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
      comment: "Discount code for manual application",
    },
    value_type: {
      type: DataTypes.ENUM("percentage", "fixed"),
      allowNull: false,
      defaultValue: "percentage",
      comment: "Type of discount value (percentage or fixed amount)",
    },
    value: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: "Discount value (percentage or fixed amount)",
      defaultValue: 0.0,
    },
    applies_to: {
      type: DataTypes.ENUM("products", "order"),
      allowNull: false,
      defaultValue: "order",
    },
    target_product_ids: {
      type: DataTypes.ARRAY(DataTypes.UUID),
      allowNull: true,
      comment: "Array of product IDs to which the discount applies",
    },
    buy_x_get_y_config: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Configuration for "Buy X Get Y" discounts',
      // Structure:
      // {
      //   customer_buys: {
      //     type: 'minimum_quantity' | 'minimum_purchase_amount',
      //     value: number,
      //     product_ids: [uuid] (if minimum_quantity)
      //   },
      //   customer_gets: {
      //     quantity: number,
      //     product_ids: [uuid],
      //     discount_type: 'percentage' | 'amount_off_each' | 'free'
      //     discount_value: number (if not free)
      //   }
      // }
    },
    minimum_requirements: {
        type: DataTypes.JSONB,
        allowNull: true,
        comment: "Minimum requirements for the discount to apply",
    // Structure:
    // {
    //   type: 'no_minimum' | 'minimum_purchase_amount' | 'minimum_quantity_items',
    //   value: number
    // }
    },
    maximum_discount_uses: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
        comment: "Maximum number of times the discount can be used",
    },
    current_usage_count: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0,
    },
    start_date: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    end_date: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: "End date for the discount validity",
    },
    status: {
        type: DataTypes.ENUM('draft', 'active', 'expired', 'disabled'),
        allowNull: false,
        defaultValue: 'draft',
    },
    products_affected_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Number of products currently affected (for amount_off_products)'
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
    tableName: "discounts",
    timestamps: false,
  }
);

module.exports = Discount;
