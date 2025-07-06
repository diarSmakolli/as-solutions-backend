const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require('../../configurations/db');

const Tax = sequelize.define("taxes", {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: Sequelize.UUIDV4,
      allowNull: false,
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    rate: {
        type: DataTypes.FLOAT,
        allowNull: false,
    },
    is_inactive: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false,
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
    tableName: "taxes",
    timestamps: false,
  }
);

module.exports = Tax;
