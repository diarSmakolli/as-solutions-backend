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

// app.use(
//   cors({
//     origin: "https://as-frontend-snowy.vercel.app",
//     credentials: true,
//     methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
//     allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
//   })
// );

// const corsOptions = {
//   origin: function (origin, callback) {
//     // Allow requests with no origin (mobile apps, Postman, etc.)
//     if (!origin) return callback(null, true);
    
//     const allowedOrigins = [
//       'https://as-frontend-snowy.vercel.app',
//       'http://localhost:3000',
//       'http://localhost:3001',
//       'http://127.0.0.1:3000'
//     ];
    
//     if (allowedOrigins.includes(origin)) {
//       return callback(null, true);
//     }
    
//     // Log rejected origin for debugging
//     logger.warn(`CORS: Rejected origin: ${origin}`);
//     return callback(new Error('Not allowed by CORS'));
//   },
//   credentials: true, // CRITICAL: Enable credentials
//   methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
//   allowedHeaders: [
//     'Origin',
//     'X-Requested-With', 
//     'Content-Type',
//     'Accept',
//     'Authorization',
//     'Cache-Control',
//     'Cookie',
//     'Set-Cookie'
//   ],
//   exposedHeaders: [
//     'Set-Cookie',
//     'Authorization'
//   ],
//   optionsSuccessStatus: 200,
//   maxAge: 86400
// };

// app.use(cors(corsOptions));

// Handle preflight requests explicitly
// app.options('*', cors(corsOptions));

// Simple and safe CORS configuration
const corsOptions = {
  origin: ['https://as-frontend-snowy.vercel.app', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  exposedHeaders: ['Set-Cookie']
};

app.use(cors(corsOptions));

app.use(cookieParser());

app.use(bodyParser.json());
app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);
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
