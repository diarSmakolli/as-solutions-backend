const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require("../../../configurations/db");

const Session = sequelize.define('sessions', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false
    },
    token_hash: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    device_type: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    device_info: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    browser: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    os: {
        type: DataTypes.STRING,
        allowNull: true
    },
    ip_address: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    expired_at: {
        type: DataTypes.DATE,
        allowNull: false,
    },
    administration_id: {
        type: DataTypes.UUID,
        allowNull: false,
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
    tableName: 'sessions',
    timestamps: false
});

module.exports = Session;