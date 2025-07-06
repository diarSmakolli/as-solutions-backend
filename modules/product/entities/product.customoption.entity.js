const { DataTypes } = require('sequelize');
const sequelize = require('../../../configurations/db');

const ProductCustomOption = sequelize.define('ProductCustomOption', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
    },
    product_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'products',
            key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
    },
    option_name: {
        type: DataTypes.STRING(255),
        allowNull: false,
    },
    option_type: {
        type: DataTypes.ENUM('text', 'textarea', 'select', 'radio', 'checkbox', 'file', 'date', 'number'),
        defaultValue: 'text',
        allowNull: false,
    },
    is_required: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false,
    },
    sort_order: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: false,
    },
    placeholder_text: {
        type: DataTypes.STRING(500),
        allowNull: true,
    },
    help_text: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    validation_rules: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: {},
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        allowNull: false,
    },
    affects_price: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false,
    },
    price_modifier_type: {
        type: DataTypes.ENUM('fixed', 'percentage'),
        defaultValue: 'fixed',
        allowNull: true,
    },
    base_price_modifier: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.00,
        allowNull: true,
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
    tableName: 'product_custom_options',
    timestamps: false,
    indexes: [
        {
            fields: ['product_id']
        },
        {
            fields: ['sort_order']
        },
        {
            fields: ['is_active']
        }
    ]
});

module.exports = ProductCustomOption;