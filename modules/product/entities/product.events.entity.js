const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require("../../../configurations/db");

const ProductEvent = sequelize.define("product_events", {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: Sequelize.UUIDV4,
    allowNull: false,
  },
  event_type: {
    type: DataTypes.ENUM(
        "view",
        "click",
        "add_to_cart",
        "remove_from_cart",
        "purchase",
        "wishlist_add",
        "wishlist_remove",
        "impression",
        "hover",
        "purchase_complete",
        "return_request",
        "search_result",
        "recommendation_view",
        "view_details",
        "image_view"
    ),
    allowNull: false,
    defaultValue: "impression",
  },
  session_id: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  customer_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  product_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: "products",
      key: "id",
    },
  },
  page_type: {
    type: DataTypes.ENUM(
        "homepage",
        "category_page",
        "search_results",
        "product_detail",
        "recommendations",
        "cart",
        "wishlist",
        "order_history",
        "email",
        "push_notification",
        "external_link",
        "advertisement",
        "social_media"
    ),
    allowNull: true,
    defaultValue: "homepage",
  },
  page_url: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  referrer_url: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  search_query: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  category_path: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  position_in_list: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  total_results: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  page_number: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },

  // Behaviour data
  time_spent: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  scroll_depth: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true, 
  },
  click_coordinates: {
    type: DataTypes.JSON, 
    allowNull: true,
  },
  viewport_size: {
    type: DataTypes.JSON, 
    allowNull: true,
  },
  
  // DEVICE INFO
  device_type: {
    type: DataTypes.ENUM(
        "desktop",
        "mobile",
        "other"
    ),
    allowNull: true,
    defaultValue: "other",
  },
  user_agent: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  ip_address: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  country_code: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  city: {
    type: DataTypes.STRING,
    allowNull: true,
  },

  // Marketing and Campaign Data
  campaign_id: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  campaign_source: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  campaign_medium: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  campaign_name: {
    type: DataTypes.STRING,
    allowNull: true,
  },

  // PRICING / BUY DATA
  price_add_to_cart: {
    type: DataTypes.DOUBLE,
    allowNull: true,
  },
  price_remove_from_cart: {
    type: DataTypes.DOUBLE,
    allowNull: true,
  },
  price_purchase_complete: {
    type: DataTypes.DOUBLE,
    allowNull: true,
  },
  price_return_request: {
    type: DataTypes.DOUBLE,
    allowNull: true,
  },
  price_add_to_wishlist: {
    type: DataTypes.DOUBLE,
    allowNull: true,
  },
  price_remove_from_wishlist: {
    type: DataTypes.DOUBLE,
    allowNull: true,
  },

  timestamp: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: Sequelize.NOW,
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
    tableName: "product_events",
    timestamps: false,  
});

module.exports = ProductEvent;
    