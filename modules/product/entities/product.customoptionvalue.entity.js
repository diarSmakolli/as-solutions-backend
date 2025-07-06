const { DataTypes } = require('sequelize');
const sequelize = require('../../../configurations/db');

const ProductCustomOptionValue = sequelize.define('ProductCustomOptionValue', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
    },
    custom_option_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'product_custom_options',
            key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
    },
    option_value: {
        type: DataTypes.STRING(500),
        allowNull: false,
    },
    display_name: {
        type: DataTypes.STRING(255),
        allowNull: true,
    },
    sort_order: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: false,
    },
    is_default: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false,
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        allowNull: false,
    },
    // Enhanced pricing per value
    price_modifier: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.00,
        allowNull: false,
    },
    price_modifier_type: {
        type: DataTypes.ENUM('fixed', 'percentage'),
        defaultValue: 'fixed',
        allowNull: false,
    },
    // Image support for each value
    image_url: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    image_alt_text: {
        type: DataTypes.STRING(255),
        allowNull: true,
    },
    // Additional data for complex configurations
    additional_data: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: {},
    },
    // Stock management per value (optional)
    stock_quantity: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    is_in_stock: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
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
}, {
    tableName: 'product_custom_option_values',
    timestamps: false,
    indexes: [
        {
            fields: ['custom_option_id']
        },
        {
            fields: ['sort_order']
        },
        {
            fields: ['is_active']
        },
        {
            fields: ['is_default']
        },
        {
            fields: ['is_in_stock']
        }
    ]
});

module.exports = ProductCustomOptionValue;