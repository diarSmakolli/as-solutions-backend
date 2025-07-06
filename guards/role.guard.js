const logger = require("../logger/logger");

/**
 * Simple role-based access control guard
 * @param {...string} allowedRoles - List of roles that can access the route
 * @returns {Function} Express middleware function
 */
const roleGuard = (...allowedRoles) => {
  return async (req, res, next) => {
    try {
      // Check if user is authenticated
      if (!req.account) {
        logger.warn("roleGuard: No account found in request");
        return res.status(401).json({
          status: "error",
          statusCode: 401,
          message: "Authentication required.",
        });
      }

      const userRole = req.account.role;

      // Check if user has required role
      if (!allowedRoles.includes(userRole)) {
        logger.warn(
          `roleGuard: Access denied. User role '${userRole}' not in allowed roles: [${allowedRoles.join(
            ", "
          )}]`
        );
        return res.status(403).json({
          status: "error",
          statusCode: 403,
          message: "Insufficient permissions to access this resource.",
        });
      }

      // Log successful access
      logger.info(
        `roleGuard: Access granted to user '${req.account.email}' with role '${userRole}'`
      );

      next();
    } catch (error) {
      logger.error(`roleGuard: Error checking permissions: ${error.message}`);
      return res.status(500).json({
        status: "error",
        statusCode: 500,
        message: "Internal server error during permission check.",
      });
    }
  };
};

module.exports = roleGuard;
