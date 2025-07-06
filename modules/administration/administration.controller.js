const administrationService = require("./administration.service");
const logger = require("../../logger/logger");
const Administration = require("./entities/administration.entity");

class AdministrationController {
  // create account on the platform
  async createAdministrationAccountExceptSupplier(req, res, next) {
    const accountData = req.body;
    const actorId = req.account.id;
    const { companyId } = req.body;
    try {
      const result =
        await administrationService.createAdministrationAccountExceptSupplier(
          accountData,
          actorId,
          companyId
        );

      return res.status(201).json({
        status: "success",
        statusCode: 201,
        message: "Account created successfully",
        data: result,
      });
    } catch (err) {
      logger.error(`createAdministrationAccountExceptSupplier: ${err.message}`);
      next(err);
    }
  }

  // login to the platform
  async loginToTheAccount(req, res, next) {
    const { email, password } = req.body;
    try {
      const result = await administrationService.loginToTheAccount(
        email,
        password,
        req,
        res
      );

      return res.status(200).json({
        status: "success",
        statusCode: 200,
        message: "Login successful.",
        data: result,
      });
    } catch (err) {
      logger.error(`loginToTheAccount: ${err.message}`);
      next(err);
    }
  }

  // get self info
  async getSelfInfo(req, res, next) {
    try {
      return res.status(200).json({
        status: "success",
        statusCode: 200,
        message: "Get self info successfully.",
        data: {
          account: req.account,
        },
      });
    } catch (err) {
      logger.error(`getSelfInfo: ${err.message}`);
      next(err);
    }
  }

  // sign out self
  async signOutSelf(req, res, next) {
    try {
      const result = await administrationService.signOutSelf(req, res);

      return res.status(200).json(result);
    } catch (err) {
      logger.error(`signOutSelf: ${err.message}`);
      next(err);
    }
  }

  // change self password
  async changeSelfPassword(req, res, next) {
    const accountId = req.account.id;
    const { currentPassword, newPassword, confirmPassword } = req.body;
    try {
      const result = await administrationService.changeSelfPassword(
        accountId,
        currentPassword,
        newPassword,
        confirmPassword
      );

      return res.status(200).json({
        status: "success",
        statusCode: 200,
        message: "Password changed successfully.",
        data: result,
      });
    } catch (err) {
      logger.error(`changeSelfPassword: ${err.message}`);
      next(err);
    }
  }

  // get self information
  async getSelfDetails(req, res, next) {
    const accountId = req.account.id;
    try {
      const result = await administrationService.getSelfDetails(accountId);

      return res.status(200).json({
        status: "success",
        statusCode: 200,
        data: result,
      });
    } catch (err) {
      logger.error(`getSelfDetails: ${err.message}`);
      next(err);
    }
  }

  // get self active sessions
  async getSelfActiveSessions(req, res, next) {
    const accountId = req.account.id;
    const { page, limit, sortBy, sortOrder } = req.query;
    try {
      const result = await administrationService.getSelfActiveSessions(
        accountId,
        page,
        limit,
        sortBy,
        sortOrder
      );

      return res.status(200).json(result);
    } catch (err) {
      logger.error(`getSelfActiveSessions: ${err.message}`);
      next(err);
    }
  }

  // get self activities
  async getSelfActivities(req, res, next) {
    const accountId = req.account.id;
    const { page, limit, sortBy, sortOrder } = req.query;
    try {
      const result = await administrationService.getSelfActivities(
        accountId,
        page,
        limit,
        sortBy,
        sortOrder
      );

      return res.status(200).json(result);
    } catch (err) {
      logger.error(`getSelfActivities: ${err.message}`);
      next(err);
    }
  }

  // terminate self active/online session
  async terminateOnlineDevice(req, res, next) {
    const accountId = req.account.id;
    const { sessionId } = req.params;
    try {
      const result = await administrationService.terminateOnlineDevice(
        accountId,
        sessionId
      );

      return res.status(200).json({
        status: "success",
        statusCode: 200,
        data: result,
      });
    } catch (err) {
      logger.error(`terminateOnlineDevice: ${err.message}`);
      next(err);
    }
  }

  // update self visible status
  async updateSelfVisibleStatus(req, res, next) {
    const accountId = req.account.id;
    const { newStatus } = req.body;
    try {
      const result = await administrationService.updateSelfVisibleStatus(
        accountId,
        newStatus
      );

      return res.status(200).json({
        status: "success",
        statusCode: 200,
        message: "Status updated.",
        data: result,
      });
    } catch (err) {
      logger.error(`updateSelfVisibleStatus: ${err.message}`);
      next(err);
    }
  }

  // update self preferred name
  async updatePreferredName(req, res, next) {
    const accountId = req.account.id;
    const { newPreferredName } = req.body;
    try {
      const result = await administrationService.updatePreferredName(
        accountId,
        newPreferredName
      );

      return res.status(200).json({
        status: "success",
        statusCode: 200,
        message: "Preferred name updated.",
        data: result,
      });
    } catch (err) {
      logger.error(`updatePreferredName: ${err.message}`);
      next(err);
    }
  }

  // get users list
  async getAllUsersList(req, res, next) {
    try {
      const { page, limit, sortBy, sortOrder, search, ...potentialFilters } =
        req.query;

      const filters = {};

      if (potentialFilters.role) {
        filters.role = potentialFilters.role;
      }

      if (potentialFilters.is_inactive !== undefined) {
        filters.is_inactive = potentialFilters.is_inactive === "true";
      }
      if (potentialFilters.is_suspicious !== undefined) {
        filters.is_suspicious = potentialFilters.is_suspicious === "true";
      }
      if (potentialFilters.is_verified !== undefined) {
        filters.is_verified = potentialFilters.is_verified === "true";
      }
      if (potentialFilters.is_locked !== undefined) {
        filters.is_locked = potentialFilters.is_locked === "true";
      }

      const result = await administrationService.getAllUsersList(
        page,
        limit,
        filters,
        sortBy,
        sortOrder,
        search
      );

      return res.status(200).json({
        status: "success",
        statusCode: 200,
        data: result,
      });
    } catch (err) {
      logger.error(`getAllUsersList: ${err.message}`);
      next(err);
    }
  }

  // edit account information
  async editUserDetails(req, res, next) {
    const { accountId } = req.params;
    const userDetails = req.body;
    const actorId = req.account.id;
    try {
      const result = await administrationService.editUserDetails(
        accountId,
        userDetails,
        actorId
      );

      return res.status(200).json({
        status: "success",
        statusCode: 200,
        message: "Account details updated successfully.",
        data: result,
      });
    } catch (err) {
      logger.error(`editUserDetails: ${err.message}`);
      next(err);
    }
  }

  // lock account of a user as administrator
  async lockAccountOfUserAsAdministrator(req, res, next) {
    const { accountId } = req.params;
    const actorId = req.account.id;
    try {
      const result =
        await administrationService.lockAccountOfUserAsAdministrator(
          accountId,
          actorId
        );

      return res.status(200).json({
        status: "success",
        statusCode: 200,
        message: "Account locked successfully.",
        data: result,
      });
    } catch (err) {
      logger.error(`lockAccountOfUserAsAdministrator: ${err.message}`);
      next(err);
    }
  }

  // unlock account of a user as administrator
  async unlockAccountOfUserAsAdministrator(req, res, next) {
    const { accountId } = req.params;
    const actorId = req.account.id;
    try {
      const result =
        await administrationService.unlockAccountOfUserAsAdministrator(
          accountId,
          actorId
        );

      return res.status(200).json({
        status: "success",
        statusCode: 200,
        message: "Account unlocked successfully.",
        data: result,
      });
    } catch (err) {
      logger.error(`unlockAccountOfUserAsAdministrator: ${err.message}`);
      next(err);
    }
  }

  // verify account of a user as administrator
  async verifyAccountOfUserAsAdministrator(req, res, next) {
    const { accountId } = req.params;
    const actorId = req.account.id;
    try {
      const result =
        await administrationService.verifyAccountOfUserAsAdministrator(
          accountId,
          actorId
        );

      return res.status(200).json({
        status: "success",
        statusCode: 200,
        message: "Account verified successfully.",
        data: result,
      });
    } catch (err) {
      logger.error(`verifyAccountOfUserAsAdministrator: ${err.message}`);
      next(err);
    }
  }

  // unverify account of a user as administrator
  async unVerifyAccountOfUserAsAdministrator(req, res, next) {
    const { accountId } = req.params;
    const actorId = req.account.id;
    try {
      const result =
        await administrationService.unVerifyAccountOfUserAsAdministrator(
          accountId,
          actorId
        );

      return res.status(200).json({
        status: "success",
        statusCode: 200,
        message: "Account unverified successfully.",
        data: result,
      });
    } catch (err) {
      logger.error(`unVerifyAccountOfUserAsAdministrator: ${err.message}`);
      next(err);
    }
  }

  // mark account as suspicious as administrator
  async markAccountAsSuspiciousAsAdministrator(req, res, next) {
    const { accountId } = req.params;
    const actorId = req.account.id;
    try {
      const result =
        await administrationService.markAccountAsSuspicious(
          accountId,
          actorId
        );

      return res.status(200).json({
        status: "success",
        statusCode: 200,
        message: "Account marked as suspicious successfully.",
        data: result,
      });
    } catch (err) {
      logger.error(`markAccountAsSuspiciousAsAdministrator: ${err.message}`);
      next(err);
    }
  }

  // clear suspicious mark on account as administrator
  async clearSuspiciousMarkOnAccountAsAdministrator(req, res, next) {
    const { accountId } = req.params;
    const actorId = req.account.id;
    try {
      const result =
        await administrationService.clearSuspiciousMarkOnAccount(
          accountId,
          actorId
        );

      return res.status(200).json({
        status: "success",
        statusCode: 200,
        message: "Suspicious mark cleared successfully.",
        data: result,
      });
    } catch (err) {
      logger.error(
        `clearSuspiciousMarkOnAccountAsAdministrator: ${err.message}`
      );
      next(err);
    }
  }

  // deactivate account as administrator
  async deactivateAccountAsAdministrator(req, res, next) {
    const { accountId } = req.params;
    const actorId = req.account.id;
    try {
      const result =
        await administrationService.deactivateAccountAsAdministrator(
          accountId,
          actorId
        );

      return res.status(200).json({
        status: "success",
        statusCode: 200,
        message: "Account deactivated successfully.",
        data: result,
      });
    } catch (err) {
      logger.error(`deactivateAccountAsAdministrator: ${err.message}`);
      next(err);
    }
  }

  // activate account as administrator
  async activateAccountAsAdministrator(req, res, next) {
    const { accountId } = req.params;
    const actorId = req.account.id;
    try {
      const result =
        await administrationService.activateAccountAsAdministrator(
          accountId,
          actorId
        );

      return res.status(200).json({
        status: "success",
        statusCode: 200,
        message: "Account activated successfully.",
        data: result,
      });
    } catch (err) {
      logger.error(`activateAccountAsAdministrator: ${err.message}`);
      next(err);
    }
  }

  // reset password of a user as administrator
  async resetPasswordOfUserAsAdministrator(req, res, next) {
    const { accountId } = req.params;
    const { newPassword, confirmPassword } = req.body;
    const actorId = req.account.id;
    try {
      const result =
        await administrationService.resetPasswordOfUserAsAdministrator(
          accountId,
          newPassword,
          confirmPassword,
          actorId
        );

      return res.status(200).json({
        status: "success",
        statusCode: 200,
        message: "Password reset successfully.",
        data: result,
      });
    } catch (err) {
      logger.error(`verifyAccountOfUserAsAdministrator: ${err.message}`);
      next(err);
    }
  }

  // get detailed information of a user as administrator
  async getDetailedInfomationOfUserAsAdministrator(req, res, next) {
    const { accountId } = req.params;
    try {
      const result =
        await administrationService.getDetailedInfomationOfUserAsAdministrator(
          accountId
        );

      return res.status(200).json({
        status: "success",
        statusCode: 200,
        message: "User details retrieved successfully.",
        data: result,
      });
    } catch (err) {
      logger.error(
        `getDetailedInfomationOfUserAsAdministrator: ${err.message}`
      );
      next(err);
    }
  }

  // get all sessions of a user as administrator
  async getSessionsOfUserAsAdministrator(req, res, next) {
    const { accountId } = req.params;
    const {
      page = 1,
      limit = 10,
      sortBy = "created_at",
      sortOrder = "DESC",
    } = req.query;

    try {
      const result =
        await administrationService.getSessionsOfUserAsAdministrator(
          accountId,
          page,
          limit,
          sortBy,
          sortOrder
        );

      return res.status(200).json(result);
    } catch (err) {
      logger.error(`getSessionsOfUserAsAdministrator: ${err.message}`);
      next(err);
    }
  }

  // get all activities of a user as administrator
  async getActivitiesOfUserAsAdministrator(req, res, next) {
    const { accountId } = req.params;
    const {
      page = 1,
      limit = 10,
      sortBy = "created_at",
      sortOrder = "DESC",
      type,
      action,
      action_type,
      context,
      from_date,
      to_date,
    } = req.query;

    // Build filters object from query parameters
    const filters = {};
    if (type) filters.type = type;
    if (action) filters.action = action;
    if (action_type) filters.action_type = action_type;
    if (context) filters.context = context;
    if (from_date) filters.from_date = from_date;
    if (to_date) filters.to_date = to_date;

    try {
      const result =
        await administrationService.getActivitiesOfUserAsAdministrator(
          accountId,
          page,
          limit,
          sortBy,
          sortOrder,
          filters
        );

      return res.status(200).json(result);
    } catch (err) {
      logger.error(`getActivitiesOfUserAsAdministrator: ${err.message}`);
      next(err);
    }
  }

  async assignCompanyToUser(req, res, next) {
    const { accountId, companyId } = req.params;
    try {
      const result = await administrationService.assignCompanyToUser(
        accountId,
        companyId
      );

      return res.status(200).json({
        status: "success",
        statusCode: 200,
        message: "Company assigned successfully.",
        data: result,
      });
    } catch (err) {
      logger.error(`assignCompanyToUser: ${err.message}`);
      next(err);
    }
  }
}

module.exports = new AdministrationController();
