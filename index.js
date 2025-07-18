const express = require("express");
const cookieParser = require("cookie-parser");
const dotenv = require("dotenv");
const cors = require("cors");
const { Sequelize } = require("sequelize");
const bodyParser = require("body-parser");
const path = require("path");
const logger = require("./logger/logger");
const { sequelize } = require("./configurations/associations");
const administrationRoute = require("./modules/administration/administration.route");
const notificationRoute = require("./modules/notifications-administration/notification.route");
const companyRoute = require("./modules/company/company.route");
const warehouseRoute = require("./modules/warehouse/warehouse.route");
const taxRoute = require("./modules/taxes/tax.route");
const categoryRoute = require("./modules/category/category.route");
const productRoute = require("./modules/product/product.route");

const app = express();
dotenv.config();

// Enhanced CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'https://as-frontend-snowy.vercel.app',
      'https://assolutionsfournitures.fr'
    ];
    
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    logger.warn(`CORS: Rejected origin: ${origin}`);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'Cookie',
    'Set-Cookie',
    'X-Requested-With',
    'Accept',
    'Origin'
  ],
  exposedHeaders: ['Set-Cookie'],
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));


// Cookie parser BEFORE routes
app.use(cookieParser());
// Body parsers
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

// API definitions
app.use("/api/administrations", administrationRoute);
app.use("/api/administrations/notifications", notificationRoute);
app.use("/api/companies", companyRoute);
app.use("/api/warehouses", warehouseRoute);
app.use("/api/taxes", taxRoute);
app.use("/api/categories", categoryRoute);
app.use("/api/products", productRoute);

// Global error handler
app.use((err, req, res, next) => {
  const status = err.statusCode || 500;
  const message = status === 500 ? process.env.ERROR_500_MESSAGE : err.message;

  res.status(status).json({
    status: "error",
    statusCode: status,
    message: message,
  });
});

// configure main server
async function init() {
  try {
    await sequelize.authenticate();
    logger.info("Database connected.");

    // await sequelize.sync({ alter: true });
    // logger.info("All models synchronized successfully.");

    const port = process.env.PORT || 8085;

    const expressServer = app.listen(port, () => {
      logger.info(`Application is running on port ${port}`);
    });

    const shutdown = (signal) => {
      logger.info(`${signal} signal received: closing servers`);
      expressServer.close(() => {
        logger.info("Application server closed");
      });

      setTimeout(() => {
        logger.error("Forcefully shutting down");
        process.exit(1);
      }, 10000);
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  } catch (err) {
    logger.error(`Failed to initialize server: ${err.message}`);
    process.exit(1);
  }
}

init();
