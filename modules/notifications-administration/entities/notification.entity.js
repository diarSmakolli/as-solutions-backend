const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require("../../../configurations/db");

const Notification = sequelize.define("notifications_administration", {
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
    importance: {
        type: DataTypes.ENUM("low", "medium", "high"),
        allowNull: false,
        defaultValue: "medium",
    },
    is_read: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: false,
    },
    link: {
        type: DataTypes.STRING, 
        allowNull: true,
    },
    link_uuid: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    link_type: {
        type: DataTypes.STRING, // product, user, order etc.
        allowNull: true
    },
    requester_id:  {
        type: DataTypes.STRING,
        allowNull: true,
    },
    administration_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "administrations",
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
    tableName: "notifications_administration",
    timestamps: false,
  }
);

module.exports = Notification;
