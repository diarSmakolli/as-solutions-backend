const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require("../../../configurations/db");

const Administration = sequelize.define("administrations", {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: Sequelize.UUIDV4,
      allowNull: false,
    },
    first_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    last_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM(
        "global-administrator", // READ/WRITE
        "administrator", // READ/ WRITE
        "supplier", // READ/WRITE in supplier module
        "warehouse-employee", // READ/WRITE in warehouse module
        "customer-service", // READ/WRITE in customer service module
        "drivers" // READ/WRITE in drivers module
      ),
      allowNull: false,
      defaultValue: "administrator",
    },
    is_inactive: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false,
    },
    is_suspicious: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false,
    },
    is_verified: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false,
    },
    is_locked: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false,
    },
    incorrect_times_sign_in: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    is_blocked_sign_in: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false,
    },
    last_login_time: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    last_seen_time: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    last_edit_time: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    last_delete_time: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    last_login_ip: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    last_login_location: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    level: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    preferred_name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    phone_number: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    visible_status: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    has_two_factor_enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false,
    },
    two_factor_code: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    two_factor_code_expiry: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    note: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    company_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'companies',
        key: 'id'
      }
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
    tableName: "administrations",
    timestamps: false,
  }
);

module.exports = Administration;
