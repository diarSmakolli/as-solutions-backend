const fs = require("fs");
const path = require("path");
const { createLogger, format, transports } = require("winston");

const logDirectory = path.join(__dirname, "../logs");

if (!fs.existsSync(logDirectory)) {
  fs.mkdirSync(logDirectory);
}

const logger = createLogger({
  level: "info",
  format: format.combine(format.timestamp(), format.json()),
  transports: [
    new transports.Console(),
    new transports.File({
      filename: path.join(logDirectory, "error.log"),
      level: "error",
    }),
    new transports.File({
      filename: path.join(logDirectory, "warning.log"),
      level: "warning",
    }),
    new transports.File({ filename: path.join(logDirectory, "combined.log") }),
    new transports.File({
      filename: path.join(logDirectory, "info.log"),
      level: "info",
    }),
  ],
});

logger.exceptions.handle(
  new transports.File({ filename: path.join(logDirectory, "exceptions.log") })
);

logger.rejections.handle(
  new transports.File({ filename: path.join(logDirectory, "rejections.log") })
);

module.exports = logger;
