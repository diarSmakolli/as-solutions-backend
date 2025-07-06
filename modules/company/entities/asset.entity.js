const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require("../../../configurations/db");

const Asset = sequelize.define(
  "company_assets",
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: Sequelize.UUIDV4,
      allowNull: false,
    },
    asset_tag: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    asset_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    status: {
        type: DataTypes.ENUM("active", "inactive", "pending", "verified"),
        allowNull: false,
        defaultValue: "active",
    },
    description: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    category: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    serial_number: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    model: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    location: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    company_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "companies",
        key: "id",
      },
    },
    images: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
      comment: "Array of image URLs or objects",
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
    tableName: "company_assets",
    timestamps: false,
  }
);

module.exports = Asset;
