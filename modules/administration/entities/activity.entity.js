const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require("../../../configurations/db");

const Activity = sequelize.define('activities', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false
    },
    type: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    action: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    action_type: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    summary: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    context: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    link: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    reference_id: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    current_time: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    administration_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'administrations',
            key: 'id',
        }
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
    tableName: 'activities',
    timestamps: false
});

module.exports = Activity;