const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require("../../../configurations/db");

const CompanyDocument = sequelize.define(
  "company_documents",
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: Sequelize.UUIDV4,
      allowNull: false,
    },
    document_name: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: "Name of the document",
    },
    file_url: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: "URL of the document file",
    },
    file_size: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Size of the document file in bytes",
    },
    uploaded_by: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: "ID of the user who uploaded the document",
    },
    tags: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      comment: "Tags associated with the document",
    },
    version: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "Version of the document",
    },
    expiration_date: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Expiration date of the document",
    },
    is_confidential: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false,
      comment: "Indicates if the document is confidential",
    },
    company_id: {
      type: DataTypes.UUID,
      allowNull: false,
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
    tableName: "company_documents",
    timestamps: false,
  }
);

module.exports = CompanyDocument;
