const jwt = require("jsonwebtoken");
const { Administration, Session } = require("../configurations/associations");
const crypto = require("crypto");
const { Op } = require("sequelize");
const logger = require("../logger/logger");

const authGuard = async (req, res, next) => {
  const token = req.cookies["accessToken"];

  if (!token) {
    return res.status(403).json({
      status: "error",
      statusCode: 401,
      message: "Unauthorized.",
    });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const account = await Administration.findOne({
      where: {
        id: decoded.id,
        is_inactive: false,
        is_locked: false,
        is_blocked_sign_in: false,
      },
      attributes: {
        exclude: ["password"],
      },
    });

    if (!account) {
      return res.status(403).json({
        status: "error",
        statusCode: 401,
        message: "Unauthorized.",
      });
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const session = await Session.findOne({
      where: {
        token_hash: tokenHash,
        administration_id: account.id,
        expired_at: {
          [Op.gt]: Date.now(),
        },
      },
    });

    if (!session) {
      return res.status(403).json({
        status: "error",
        statusCode: 401,
        message: "Unauthorized.",
      });
    }
    
    req.account = account;
    req.tokenHash = tokenHash;
    next();
  } catch (err) {
    logger.error(`authGuard: ${err.message}`);
    next(err);
  }
};

module.exports = authGuard;
