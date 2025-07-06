const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require("../../../configurations/db");

const Company = sequelize.define('companies', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false
    },
    business_name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    market_name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    type_of_business: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    number_unique_identifier: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    number_of_business: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    fiscal_number: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    data_of_registration: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    city: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    country: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    address: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    postal_code: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    phone_number: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    is_verified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false,
    },
    contact_person: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    contact_person_email: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    contact_person_phone: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    is_inactive: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false,
    },
    employees_count: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    is_on_top_list: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false,
    },
    logo_url: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    website_url: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    total_orders: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: false,
    },
    average_rating: {
        type: DataTypes.FLOAT,
        defaultValue: 0,
        allowNull: false,
    },
    return_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: false,
    },
    notes_internal: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    flagged_reason: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    is_flagged: {
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
    }
}, {
    tableName: 'companies',
    timestamps: false
});

module.exports = Company;