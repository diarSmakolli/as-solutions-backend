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
//     origin: process.env.CORS_ORIGIN,
//     credentials: true,
//   })
// );
// Enhanced CORS configuration for production
// const corsOptions = {
//   origin: function (origin, callback) {
//     // Allow requests with no origin (like mobile apps, Postman, etc.)
//     if (!origin) return callback(null, true);
    
//     // Get allowed origins from environment variable
//     const allowedOrigins = process.env.CORS_ORIGIN 
//       ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
//       : ['http://localhost:3000']; // Default for development
    
//     if (allowedOrigins.includes(origin)) {
//       callback(null, true);
//     } else {
//       logger.warn(`CORS: Origin ${origin} not allowed`);
//       callback(new Error('Not allowed by CORS'));
//     }
//   },
//   credentials: true, // Allow cookies and credentials
//   methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
//   allowedHeaders: [
//     'Origin',
//     'X-Requested-With',
//     'Content-Type',
//     'Accept',
//     'Authorization',
//     'Cache-Control',
//     'X-Access-Token'
//   ],
//   exposedHeaders: ['set-cookie'], // Expose cookies to frontend
//   maxAge: 86400 // Cache preflight requests for 24 hours
// };


// corsOptions
app.use(cors({
  origin: process.env.CORS_ORIGIN || "https://as-frontend-snowy.vercel.app/",
  credentials: true,
}));

app.use(function (req, res, next) {
    res.header('Access-Control-Allow-Origin', 'https://as-frontend-snowy.vercel.app/');
    res.header("Access-Control-Allow-Headers", "*");
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    next();
}); 

app.use(cookieParser());
app.use(bodyParser.json());
app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);
app.use(express.json());

// Security Middleware
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  // Log requests in development
  if (process.env.NODE_ENV === "development") {
    logger.info(
      `${req.method} ${req.path} - Origin: ${req.get("origin") || "No origin"}`
    );
  }

  next();
});


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

    await sequelize.sync({ alter: true });
    logger.info('All models synchronized successfully.');

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
