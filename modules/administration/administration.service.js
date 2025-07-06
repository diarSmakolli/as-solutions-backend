const {
  Administration,
  Session,
  Activity,
  Company,
} = require("../../configurations/associations");
const logger = require("../../logger/logger");
const geoip = require("geoip-lite");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { Op } = require("sequelize");
const bcrypt = require("bcrypt");

// Constants
const CONSTANTS = {
  ROLES: {
    GLOBAL_ADMINISTRATOR: "global-administrator",
    ADMINISTRATOR: "administrator",
    SUPPLIER: "supplier",
    EMPLOYEE: "employee",
  },
  ACTIVITY_TYPES: {
    CREATE: "Create",
    MODIFY: "Modify",
    AUTHENTICATE: "Authentication",
    TERMINATE: "Terminate",
    LOCK: "Lock",
    UNLOCK: "UnLock",
    VERIFY: "Verify",
    UNVERIFY: "Unverify",
    RESET: "reset",
    ASSIGN: "Assign",
  },
  DEVICE_TYPES: {
    DESKTOP: "Desktop",
    MOBILE: "Mobile",
    TABLET: "Tablet",
    UNKNOWN: "Unknown",
  },
  BCRYPT_ROUNDS: 10,
  SESSION_EXPIRY: 60 * 60 * 24 * 1000, // 1 day
  PASSWORD_REQUIREMENTS: {
    MIN_LENGTH: 8,
    REGEX: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
  },
};

class AdministrationService {
  constructor() {
    this.logger = logger;
  }

  // ============ VALIDATION HELPERS ============

  validateUUID(value, fieldName = "ID") {
    if (!value || !this.isValidUUID(value)) {
      throw {
        status: "error",
        statusCode: 400,
        message: `Invalid ${fieldName} format`,
      };
    }
  }

  validateRequiredFields(data, requiredFields) {
    const missingFields = [];

    for (const field of requiredFields) {
      if (
        !data[field] ||
        (typeof data[field] === "string" && data[field].trim() === "")
      ) {
        missingFields.push(field.replace("_", " "));
      }
    }

    if (missingFields.length > 0) {
      throw {
        status: "error",
        statusCode: 400,
        message: `Please provide all required fields: ${missingFields.join(
          ", "
        )}.`,
      };
    }
  }

  validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw {
        status: "error",
        statusCode: 400,
        message: "Please provide a valid email address",
      };
    }
  }

  validatePassword(password) {
    if (password.length < CONSTANTS.PASSWORD_REQUIREMENTS.MIN_LENGTH) {
      throw {
        status: "error",
        statusCode: 400,
        message: `Password must be at least ${CONSTANTS.PASSWORD_REQUIREMENTS.MIN_LENGTH} characters long`,
      };
    }

    if (!CONSTANTS.PASSWORD_REQUIREMENTS.REGEX.test(password)) {
      throw {
        status: "error",
        statusCode: 400,
        message:
          "Password must contain at least one uppercase letter, one lowercase letter, one number and one special character",
      };
    }
  }

  validateRole(role) {
    const validRoles = Object.values(CONSTANTS.ROLES);
    if (!validRoles.includes(role)) {
      throw {
        status: "error",
        statusCode: 400,
        message: `Invalid role. Valid roles are: ${validRoles.join(", ")}`,
      };
    }
  }

  isValidUUID(value) {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(value);
  }

  async hashPassword(password) {
    try {
      return await bcrypt.hash(password, CONSTANTS.BCRYPT_ROUNDS);
    } catch (error) {
      this.logger.error("Password hashing failed:", error);
      throw {
        status: "error",
        statusCode: 500,
        message: "Password processing failed",
      };
    }
  }

  sanitizeString(str) {
    return typeof str === "string" ? str.trim() : str;
  }

  extractClientIP(req) {
    return (
      req.headers["x-forwarded-for"]?.split(",")[0] ||
      req.connection?.remoteAddress ||
      req.socket?.remoteAddress
    ); // Keeping original fallback IP
  }

  async findAccountById(accountId, includeInactive = false) {
    if (!accountId) {
      this.requestFailure();
    }

    this.validateUUID(accountId, "Account ID");

    const whereClause = { id: accountId };
    if (!includeInactive) {
      whereClause.is_inactive = false;
    }

    const account = await Administration.findOne({ where: whereClause });

    if (!account) {
      throw {
        status: "error",
        statusCode: 404,
        message: "No account has been found in our records.",
      };
    }

    return account;
  }

  async createActivityLog(
    type,
    action,
    actionType,
    summary,
    accountId,
    referenceId = null
  ) {
    try {
      if (!type) {
        throw {
          status: "error",
          statusCode: 400,
          message: "Activity type is required.",
        };
      }

      if (!action) {
        throw {
          status: "error",
          statusCode: 400,
          message: "Action is required.",
        };
      }

      return await Activity.create({
        type,
        action,
        action_type: actionType,
        summary,
        context: "administration",
        link: "administration-details",
        reference_id: referenceId,
        current_time: new Date(),
        administration_id: accountId,
        created_at: new Date(),
        updated_at: new Date(),
      });
    } catch (error) {
      this.logger.error("Activity logging failed:", error);
    }
  }

  requestFailure() {
    throw {
      status: "error",
      statusCode: 400,
      message: "Request has been failed, please try again later.",
    };
  }

  // ============ MAIN SERVICE METHODS ============

  // Create a new user
  async createAdministrationAccountExceptSupplier(administrationData, actorId) {
    try {
      if (!administrationData) {
        this.requestFailure();
      }

      // Validate required fields
      this.validateRequiredFields(administrationData, [
        "first_name",
        "last_name",
        "email",
        "password",
      ]);

      // Validate email format
      this.validateEmail(administrationData.email);

      // Validate password strength
      this.validatePassword(administrationData.password);

      // Validate role if provided
      if (administrationData.role) {
        this.validateRole(administrationData.role);
      }

      // Check for existing account
      const existingAccount = await Administration.findOne({
        where: {
          email: administrationData.email,
        },
      });

      if (existingAccount) {
        throw {
          status: "error",
          statusCode: 400,
          message: "Account already exists. Please try with another email.",
        };
      }

      // Validate actor if provided
      let actor = null;
      if (actorId) {
        actor = await this.findAccountById(actorId);
      }

      const hashedPassword = await this.hashPassword(
        administrationData.password
      );

      const newAccount = await Administration.create({
        first_name: this.sanitizeString(administrationData.first_name),
        last_name: this.sanitizeString(administrationData.last_name),
        email: this.sanitizeString(administrationData.email),
        password: hashedPassword,
        role: administrationData.role,
        is_inactive: false,
        is_suspicious: false,
        is_verified: false,
        is_locked: false,
        incorrect_times_sign_in: 0,
        is_blocked_sign_in: false,
        last_login_time: null,
        last_seen_time: null,
        last_edit_time: null,
        last_delete_time: null,
        last_login_ip: null,
        last_login_location: null,
        level: 1,
        preferred_name: `${this.sanitizeString(
          administrationData.first_name
        )} ${this.sanitizeString(administrationData.last_name)}`,
        phone_number: this.sanitizeString(administrationData.phone_number),
        visible_status: "Active",
        has_two_factor_enabled: false,
        two_factor_code: null,
        two_factor_code_expiry: null,
        note: this.sanitizeString(administrationData.note),
        company_id: administrationData.company_id || null,
        created_at: new Date().getTime(),
        updated_at: new Date().getTime(),
      });

      if (actor) {
        await this.createActivityLog(
          CONSTANTS.ACTIVITY_TYPES.CREATE,
          "Create account",
          "administration",
          `Account ${administrationData.first_name} ${administrationData.last_name} has been created`,
          actor.id,
          newAccount.id
        );
      }

      await newAccount.save();

      this.logger.info(`New account created: ${newAccount.email}`);
      return newAccount;
    } catch (error) {
      this.logger.error("Account creation failed:", error);
      throw error;
    }
  }

  // Login to the account
  async loginToTheAccount(email, password, req, res) {
    try {
      if (!email || !password) {
        throw {
          status: "error",
          statusCode: 400,
          message: "Please enter email and password.",
        };
      }

      const account = await Administration.findOne({
        where: {
          email: email,
          is_inactive: false,
          is_locked: false,
          is_blocked_sign_in: false,
        },
      });

      if (!account) {
        throw {
          status: "error",
          statusCode: 400,
          message: "Invalid email or password.",
        };
      }

      const is_password_valid = await bcrypt.compare(
        password,
        account.password
      );

      if (!is_password_valid) {
        account.incorrect_times_sign_in += 1;
        await account.save();
        throw {
          status: "error",
          statusCode: 400,
          message: "Invalid email or password.",
        };
      }

      if (
        account.incorrect_times_sign_in >
        process.env.INCORRECT_TIMES_BLOCK_SIGN_IN
      ) {
        account.is_locked = true;
        await account.save();
        throw {
          status: "error",
          statusCode: 400,
          message:
            "Your account is locked due to incorrect attempts, please contact the administration.",
        };
      }

      const current_ip = this.extractClientIP(req);

      let device_details;
      try {
        device_details = await this.parseUserAgent(req.headers["user-agent"]);
      } catch (error) {
        device_details = {
          device_type: CONSTANTS.DEVICE_TYPES.UNKNOWN,
          browser: "Unknown",
          browser_version: "Unknown",
          os: "Unknown",
          device_info: "Unknown Device",
        };
      }

      const geo = geoip.lookup(current_ip);

      account.last_login_time = new Date();
      account.last_login_ip = current_ip;
      account.last_login_location = geo
        ? `${geo.country}${geo.city}`
        : "Unknown";
      account.incorrect_times_sign_in = 0;

      const payload = {
        id: account.id,
        email: account.email,
        first_name: account.first_name,
        last_name: account.last_name,
        role: account.role,
      };

      const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: "24h",
      });

      // res.cookie("accessToken", accessToken, {
      //   httpOnly: true,
      //   secure: process.env.NODE_ENV === "production",
      //   sameSite: "strict",
      //   maxAge: CONSTANTS.SESSION_EXPIRY,
      // });

      res.cookie("accessToken", accessToken, {
        httpOnly: true,
        secure: true, // true in production
        sameSite: "none",
        maxAge: CONSTANTS.SESSION_EXPIRY,
        domain: ".onrender.com"
      });

      const tokenHash = crypto
        .createHash("sha256")
        .update(accessToken)
        .digest("hex");

      const newSession = await Session.create({
        token_hash: tokenHash,
        device_type: device_details.device_type,
        browser: device_details.browser,
        os: device_details.os,
        device_info: device_details.device_info,
        ip_address: current_ip,
        expired_at: new Date(Date.now() + CONSTANTS.SESSION_EXPIRY),
        administration_id: account.id,
        created_at: new Date(),
        updated_at: new Date(),
      });

      await this.createActivityLog(
        CONSTANTS.ACTIVITY_TYPES.AUTHENTICATE,
        "login",
        "authentication",
        `Account ${account.first_name} ${account.last_name} has been logged in`,
        account.id
      );

      await account.save();
      await newSession.save();

      this.logger.info(`Successful login: ${account.email}`);

      return {
        account,
        accessToken,
        newSession,
      };
    } catch (error) {
      this.logger.error("Login failed:", error);
      throw error;
    }
  }

  // Sign out self
  async signOutSelf(req, res) {
    try {
      const token = req.cookies["accessToken"];

      if (token) {
        const tokenHash = crypto
          .createHash("sha256")
          .update(token)
          .digest("hex");

        await Session.destroy({
          where: {
            token_hash: tokenHash,
          },
        });

        res.clearCookie("accessToken", {
          httpOnly: true,
          secure: true,
          sameSite: "none",
          domain: ".onrender.com"
        });
      }

      return {
        status: "success",
        statusCode: 200,
        message: "You have been signed out successfully",
      };
    } catch (error) {
      this.logger.error("Sign out failed:", error);
      throw error;
    }
  }

  // Change self password
  async changeSelfPassword(
    accountId,
    currentPassword,
    newPassword,
    confirmPassword
  ) {
    try {
      const account = await this.findAccountById(accountId);

      if (!currentPassword || !newPassword || !confirmPassword) {
        throw {
          status: "error",
          statusCode: 400,
          message:
            "Please provide a current and new password and confirm password",
        };
      }

      if (newPassword !== confirmPassword) {
        throw {
          status: "error",
          statusCode: 400,
          message: "New password and confirm password do not match",
        };
      }

      // Validate new password strength
      this.validatePassword(newPassword);

      const is_current_password_valid = await bcrypt.compare(
        currentPassword,
        account.password
      );

      if (!is_current_password_valid) {
        throw {
          status: "error",
          statusCode: 401,
          message: "Current password is incorrect",
        };
      }

      const hashedPassword = await this.hashPassword(newPassword);

      await this.createActivityLog(
        CONSTANTS.ACTIVITY_TYPES.MODIFY,
        "Modification of password",
        "Reset password",
        `Account ${account.email} has been changed their password.`,
        account.id
      );

      account.password = hashedPassword;
      await account.save();

      this.logger.info(`Password changed for account: ${account.email}`);
      return account;
    } catch (error) {
      this.logger.error("Password change failed:", error);
      throw error;
    }
  }

  // Get details of self user
  async getSelfDetails(accountId) {
    return await this.findAccountById(accountId);
  }

  // Get details of self active sessions
  async getSelfActiveSessions(
    accountId,
    page = 1,
    limit = 10,
    sortBy = "created_at",
    sortOrder = "DESC"
  ) {
    try {
      const account = await this.findAccountById(accountId);

      page = Math.max(1, parseInt(page));
      limit = Math.max(1, parseInt(limit));

      let sessions = await Session.findAndCountAll({
        where: {
          administration_id: account.id,
          expired_at: {
            [Op.gte]: new Date(),
          },
        },
        order: [[sortBy, sortOrder]],
        offset: (page - 1) * limit,
        limit: limit,
      });

      const total_items = sessions.count;
      const total_pages = Math.ceil(total_items / limit);
      sessions = sessions.rows;

      return {
        status: "success",
        statusCode: 200,
        data: {
          sessions,
          total_items,
          total_pages,
          current_page: page,
        },
      };
    } catch (error) {
      this.logger.error("Get self active sessions failed:", error);
      throw error;
    }
  }

  // Get self activities
  async getSelfActivities(
    accountId,
    page = 1,
    limit = 10,
    sortBy = "created_at",
    sortOrder = "DESC"
  ) {
    try {
      if (!accountId) {
        this.requestFailure();
      }

      if (!this.isValidUUID(accountId)) {
        this.requestFailure();
      }

      const account = await this.findAccountById(accountId);

      page = Math.max(1, parseInt(page));
      limit = Math.max(1, parseInt(limit));

      let activities = await Activity.findAndCountAll({
        where: {
          administration_id: account.id,
        },
        order: [[sortBy, sortOrder]],
        offset: (page - 1) * limit,
        limit: limit,
      });

      const total_items = activities.count;
      const total_pages = Math.ceil(total_items / limit);
      activities = activities.rows;

      return {
        status: "success",
        statusCode: 200,
        data: {
          activities,
          total_items,
          total_pages,
          current_page: page,
        },
      };
    } catch (error) {
      this.logger.error("Get self activities failed:", error);
      throw error;
    }
  }

  // Terminate online device
  async terminateOnlineDevice(accountId, sessionId) {
    try {
      if (
        !accountId ||
        !sessionId ||
        !this.isValidUUID(sessionId) ||
        !this.isValidUUID(accountId)
      ) {
        this.requestFailure();
      }

      const account = await this.findAccountById(accountId);
      this.validateUUID(sessionId, "Session ID");

      if (!account) {
        throw {
          status: "error",
          statusCode: 404,
          message: "Account does not found in our records.",
        };
      }

      const session = await Session.findOne({
        where: {
          id: sessionId,
          administration_id: account.id,
        },
      });

      if (!session) {
        throw {
          status: "error",
          statusCode: 404,
          message: "Session does not found in our records.",
        };
      }

      await this.createActivityLog(
        CONSTANTS.ACTIVITY_TYPES.TERMINATE,
        "Terminate session",
        "session",
        `${account.email} has terminated their session`,
        account.id
      );

      await session.destroy();

      return account;
    } catch (error) {
      this.logger.error("Terminate online device failed:", error);
      throw error;
    }
  }

  // Update self visible status
  async updateSelfVisibleStatus(accountId, newStatus) {
    try {
      if (!accountId || !this.isValidUUID(accountId)) {
        this.requestFailure();
      }

      const account = await this.findAccountById(accountId);

      if (!newStatus) {
        throw {
          status: "error",
          statusCode: 400,
          message: "Please provide a valid status",
        };
      }

      account.visible_status = newStatus;

      await this.createActivityLog(
        CONSTANTS.ACTIVITY_TYPES.MODIFY,
        "Change visible status",
        "change",
        `${account.email} has been changed their visible status to ${newStatus}`,
        account.id
      );

      await account.save();

      return account;
    } catch (error) {
      this.logger.error("Update self visible status failed:", error);
      throw error;
    }
  }

  // Update preferred name
  async updatePreferredName(accountId, newPreferredName) {
    try {
      if (!accountId || !this.isValidUUID(accountId)) {
        this.requestFailure();
      }

      const account = await this.findAccountById(accountId);

      if (!newPreferredName) {
        throw {
          status: "error",
          statusCode: 400,
          message: "Please provide a valid preferred name",
        };
      }

      account.preferred_name = this.sanitizeString(newPreferredName);

      await this.createActivityLog(
        CONSTANTS.ACTIVITY_TYPES.MODIFY,
        "Change preferred name",
        "user",
        `${account.email} has been changed their preferred name to ${newPreferredName}`,
        account.id
      );

      await account.save();

      return account;
    } catch (error) {
      this.logger.error("Update preferred name failed:", error);
      throw error;
    }
  }

  // ============ ADMINISTRATION ROUTES ============

  // Get all users list
  async getAllUsersList(
    page = 1,
    limit = 50,
    filters = {},
    sortBy = "created_at",
    sortOrder = "DESC",
    search = ""
  ) {
    try {
      page = Math.max(1, parseInt(page));
      limit = Math.max(1, parseInt(limit));

      const offset = (page - 1) * limit;
      const whereClause = { [Op.and]: [] };

      if (search) {
        whereClause[Op.and].push({
          [Op.or]: [
            { first_name: { [Op.like]: `%${search}%` } },
            { last_name: { [Op.like]: `%${search}%` } },
            { email: { [Op.like]: `%${search}%` } },
            { phone_number: { [Op.like]: `%${search}%` } },
            { preferred_name: { [Op.like]: `%${search}%` } },
          ],
        });
      }

      // Apply filters
      Object.keys(filters).forEach((key) => {
        if (filters[key] !== undefined && filters[key] !== null) {
          whereClause[Op.and].push({ [key]: filters[key] });
        }
      });

      const administrations = await Administration.findAndCountAll({
        where: whereClause,
        limit,
        offset,
        order: [[sortBy, sortOrder]],
      });

      // Format timestamps
      administrations.rows = administrations.rows.map((account) => {
        return {
          ...account.dataValues,
          created_at: account.created_at ? account.created_at.getTime() : null,
          updated_at: account.updated_at ? account.updated_at.getTime() : null,
          last_login_time: account.last_login_time
            ? account.last_login_time.getTime()
            : null,
          last_seen_time: account.last_seen_time
            ? account.last_seen_time.getTime()
            : null,
          last_edit_time: account.last_edit_time
            ? account.last_edit_time.getTime()
            : null,
          last_delete_time: account.last_delete_time
            ? account.last_delete_time.getTime()
            : null,
        };
      });

      return {
        total_items: administrations.count,
        current_page: page,
        total_pages: Math.ceil(administrations.count / limit),
        accounts: administrations.rows,
      };
    } catch (error) {
      this.logger.error("Get all users list failed:", error);
      throw error;
    }
  }

  // Edit user details
  async editUserDetails(accountId, userDetails, actorId) {
    try {
      if (!accountId || !this.isValidUUID(accountId)) {
        this.requestFailure();
      }

      if (!userDetails || Object.keys(userDetails).length === 0) {
        throw {
          status: "error",
          statusCode: 400,
          message: "Please provide user details to update.",
        };
      }

      const account = await this.findAccountById(accountId, true);
      const actor = await this.findAccountById(actorId);

      // Validate email if provided
      if (userDetails.email) {
        this.validateEmail(userDetails.email);
      }

      // Validate role if provided
      if (userDetails.role) {
        this.validateRole(userDetails.role);
      }

      // Update the account details
      await account.update({
        first_name: this.sanitizeString(userDetails.first_name),
        last_name: this.sanitizeString(userDetails.last_name),
        email: this.sanitizeString(userDetails.email),
        role: userDetails.role,
        level: userDetails.level,
        preferred_name: this.sanitizeString(userDetails.preferred_name),
        phone_number: this.sanitizeString(userDetails.phone_number),
        visible_status: userDetails.visible_status,
        company_id: userDetails.company_id || null,
        note: this.sanitizeString(userDetails.note),
      });

      await this.createActivityLog(
        CONSTANTS.ACTIVITY_TYPES.MODIFY,
        "Modify user details",
        "modify",
        `${actor.email} has modified details of ${account.email}`,
        actor.id || null,
        account.id
      );

      await account.save();

      return account;
    } catch (error) {
      this.logger.error("Edit user details failed:", error);
      throw error;
    }
  }

  // Lock account of a user as administrator
  async lockAccountOfUserAsAdministrator(accountId, actorId) {
    try {
      if (!accountId || !this.isValidUUID(accountId)) {
        this.requestFailure();
      }

      const account = await this.findAccountById(accountId, true);
      const actor = await this.findAccountById(actorId);

      account.is_locked = true;

      await this.createActivityLog(
        CONSTANTS.ACTIVITY_TYPES.LOCK,
        "Lock account",
        "lock",
        `${actor.email} has locked account of ${account.email}`,
        actor.id,
        account.id
      );

      await account.save();

      return account;
    } catch (error) {
      this.logger.error("Lock account failed:", error);
      throw error;
    }
  }

  // Unlock account of a user as administrator
  async unlockAccountOfUserAsAdministrator(accountId, actorId) {
    try {
      if (!accountId || !this.isValidUUID(accountId)) {
        this.requestFailure();
      }

      const account = await this.findAccountById(accountId, true);
      const actor = await this.findAccountById(actorId);

      account.is_locked = false;

      await this.createActivityLog(
        CONSTANTS.ACTIVITY_TYPES.UNLOCK,
        "Unlock account",
        "unlock",
        `${actor.email} has unlocked account of ${account.email}`,
        actor.id,
        account.id
      );

      await account.save();

      return account;
    } catch (error) {
      this.logger.error("Unlock account failed:", error);
      throw error;
    }
  }

  // Verify account of a user as administrator
  async verifyAccountOfUserAsAdministrator(accountId, actorId) {
    try {
      if (!accountId || !this.isValidUUID(accountId)) {
        this.requestFailure();
      }

      const account = await this.findAccountById(accountId, true);
      const actor = await this.findAccountById(actorId);

      account.is_verified = true;

      await this.createActivityLog(
        CONSTANTS.ACTIVITY_TYPES.VERIFY,
        "Verify account",
        "verify",
        `${actor.email} has verified account of ${account.email}`,
        actor.id,
        account.id
      );

      await account.save();

      return account;
    } catch (error) {
      this.logger.error("Verify account failed:", error);
      throw error;
    }
  }

  // Unverify account of a user as administrator
  async unVerifyAccountOfUserAsAdministrator(accountId, actorId) {
    try {
      if (!accountId || !this.isValidUUID(accountId)) {
        this.requestFailure();
      }

      const account = await this.findAccountById(accountId, true);
      const actor = await this.findAccountById(actorId);

      account.is_verified = false;

      await this.createActivityLog(
        CONSTANTS.ACTIVITY_TYPES.UNVERIFY,
        "Unverify account",
        "unverify",
        `${actor.email} has unverified account of ${account.email}`,
        actor.id,
        account.id
      );

      await account.save();

      return account;
    } catch (error) {
      this.logger.error("Unverify account failed:", error);
      throw error;
    }
  }

  // Reset password of a user as administrator
  async resetPasswordOfUserAsAdministrator(
    accountId,
    newPassword,
    confirmPassword,
    actorId
  ) {
    try {
      if (!accountId || !this.isValidUUID(accountId)) {
        this.requestFailure();
      }

      if (!newPassword || !confirmPassword) {
        throw {
          status: "error",
          statusCode: 400,
          message: "Please provide new password and confirm password.",
        };
      }

      if (newPassword !== confirmPassword) {
        throw {
          status: "error",
          statusCode: 400,
          message: "New password and confirm password do not match.",
        };
      }

      // Validate new password strength
      this.validatePassword(newPassword);

      const account = await this.findAccountById(accountId, true);
      const actor = await this.findAccountById(actorId);

      const hashedPassword = await this.hashPassword(newPassword);

      // Reset the password
      account.password = hashedPassword;
      account.incorrect_times_sign_in = 0;
      account.is_locked = false;
      account.is_blocked_sign_in = false;

      await this.createActivityLog(
        CONSTANTS.ACTIVITY_TYPES.RESET,
        "Reset password",
        "reset",
        `${actor.email} has reset password account of ${account.email}`,
        actor.id,
        account.id
      );

      await account.save();

      return account;
    } catch (error) {
      this.logger.error("Reset password failed:", error);
      throw error;
    }
  }

  // Get detailed information of user as administrator
  async getDetailedInfomationOfUserAsAdministrator(accountId) {
    try {
      if (!accountId || !this.isValidUUID(accountId)) {
        this.requestFailure();
      }

      this.validateUUID(accountId, "Account ID");

      const account = await Administration.findOne({
        where: {
          id: accountId,
          is_inactive: false,
        },
        include: [
          {
            model: Company,
            as: "company",
          },
        ],
      });

      if (!account) {
        throw {
          status: "error",
          statusCode: 404,
          message: "No account has been found in our records.",
        };
      }

      return account;
    } catch (error) {
      this.logger.error("Get detailed information failed:", error);
      throw error;
    }
  }

  // Get all sessions of user as administrator
  async getSessionsOfUserAsAdministrator(
    accountId,
    page = 1,
    limit = 10,
    sortBy = "created_at",
    sortOrder = "DESC"
  ) {
    try {
      if (!accountId || !this.isValidUUID(accountId)) {
        this.requestFailure();
      }

      const account = await this.findAccountById(accountId);

      page = Math.max(1, parseInt(page));
      limit = Math.max(1, parseInt(limit));

      const sessionsResult = await Session.findAndCountAll({
        where: {
          administration_id: account.id,
        },
        order: [[sortBy, sortOrder]],
        offset: (page - 1) * limit,
        limit: limit,
      });

      const totalItems = sessionsResult.count;
      const totalPages = Math.ceil(totalItems / limit);

      return {
        status: "success",
        statusCode: 200,
        data: {
          sessions: sessionsResult.rows,
          total_items: totalItems,
          total_pages: totalPages,
          current_page: page,
          items_per_page: limit,
        },
      };
    } catch (error) {
      this.logger.error("Get sessions of user failed:", error);
      throw error;
    }
  }

  // Get all activities of user as administrator
  async getActivitiesOfUserAsAdministrator(
    accountId,
    page = 1,
    limit = 10,
    sortBy = "created_at",
    sortOrder = "DESC",
    filters = {}
  ) {
    try {
      if (!accountId || !this.isValidUUID(accountId)) {
        this.requestFailure();
      }

      const account = await this.findAccountById(accountId);

      page = Math.max(1, parseInt(page));
      limit = Math.max(1, parseInt(limit));

      const whereClause = {
        administration_id: account.id,
      };

      // Apply additional filters if provided
      Object.keys(filters).forEach((key) => {
        if (filters[key] !== undefined && filters[key] !== null) {
          if (key === "from_date" && filters.to_date) {
            whereClause.created_at = {
              [Op.between]: [
                new Date(filters.from_date),
                new Date(filters.to_date),
              ],
            };
          } else if (key === "from_date") {
            whereClause.created_at = {
              [Op.gte]: new Date(filters.from_date),
            };
          } else if (key === "to_date") {
            whereClause.created_at = {
              [Op.lte]: new Date(filters.to_date),
            };
          } else if (key !== "to_date") {
            whereClause[key] = filters[key];
          }
        }
      });

      const activitiesResult = await Activity.findAndCountAll({
        where: whereClause,
        order: [[sortBy, sortOrder]],
        offset: (page - 1) * limit,
        limit: limit,
        include: [
          {
            model: Administration,
            as: "administration",
            required: false,
          },
        ],
      });

      const totalItems = activitiesResult.count;
      const totalPages = Math.ceil(totalItems / limit);

      const formattedActivities = activitiesResult.rows.map((activity) => {
        return {
          ...activity.dataValues,
          created_at: activity.created_at
            ? activity.created_at.getTime()
            : null,
          updated_at: activity.updated_at
            ? activity.updated_at.getTime()
            : null,
          current_time: activity.current_time
            ? activity.current_time.getTime()
            : null,
        };
      });

      return {
        status: "success",
        statusCode: 200,
        data: {
          activities: formattedActivities,
          total_items: totalItems,
          total_pages: totalPages,
          current_page: page,
          items_per_page: limit,
        },
      };
    } catch (error) {
      this.logger.error("Get activities of user failed:", error);
      throw error;
    }
  }

  // Assign the company to the user
  async assignCompanyToUser(accountId, companyId) {
    try {
      if (!accountId || !this.isValidUUID(accountId)) {
        this.requestFailure();
      }

      const account = await this.findAccountById(accountId);
      this.validateUUID(companyId, "Company ID");

      const company = await Company.findOne({
        where: {
          id: companyId,
          is_inactive: false,
        },
      });

      if (!company) {
        throw {
          status: "error",
          statusCode: 404,
          message: "No company has been found in our records.",
        };
      }

      account.company_id = companyId;

      await this.createActivityLog(
        CONSTANTS.ACTIVITY_TYPES.ASSIGN,
        "Assign company",
        "assign",
        `${account.email} has been assigned to ${company.name}`,
        account.id
      );

      await account.save();

      return account;
    } catch (error) {
      this.logger.error("Assign company to user failed:", error);
      throw error;
    }
  }

  // ============ USER AGENT PARSING ============

  async parseUserAgent(userAgent) {
    if (!userAgent) {
      return {
        device_type: CONSTANTS.DEVICE_TYPES.UNKNOWN,
        browser: "Unknown",
        browser_version: "Unknown",
        os: "Unknown",
        device_info: "Unknown Device",
      };
    }

    const ua = userAgent.toLowerCase();
    let device_type = CONSTANTS.DEVICE_TYPES.DESKTOP;
    let browser = "Unknown";
    let browser_version = "Unknown";
    let os = "Unknown";

    // Detect Device Type
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobile))/i.test(ua)) {
      device_type = CONSTANTS.DEVICE_TYPES.TABLET;
    } else if (
      /Mobile|iPhone|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
        ua
      )
    ) {
      device_type = CONSTANTS.DEVICE_TYPES.MOBILE;
    }

    // ...existing OS detection code...
    if (ua.includes("windows")) {
      os = ua.includes("windows phone") ? "Windows Phone" : "Windows";
      if (ua.includes("windows nt 10")) os += " 10";
      else if (ua.includes("windows nt 6.3")) os += " 8.1";
      else if (ua.includes("windows nt 6.2")) os += " 8";
      else if (ua.includes("windows nt 6.1")) os += " 7";
    } else if (ua.includes("macintosh") || ua.includes("mac os x")) {
      os = "macOS";
      const match = ua.match(/mac os x (\d+[._]\d+[._]\d+)/);
      if (match) {
        os += ` ${match[1].replace(/_/g, ".")}`;
      }
    } else if (ua.includes("android")) {
      os = "Android";
      const match = ua.match(/android (\d+(\.\d+)*)/);
      if (match) os += ` ${match[1]}`;
    } else if (
      ua.includes("ios") ||
      ua.includes("iphone") ||
      ua.includes("ipad")
    ) {
      os = "iOS";
      const match = ua.match(/os (\d+_\d+)/);
      if (match) os += ` ${match[1].replace(/_/g, ".")}`;
    } else if (ua.includes("linux")) {
      os = "Linux";
    }

    // ...existing browser detection code...
    if (ua.includes("firefox/")) {
      browser = "Firefox";
      const match = ua.match(/firefox\/(\d+(\.\d+)*)/);
      if (match) browser_version = match[1];
    } else if (ua.includes("edg/")) {
      browser = "Edge";
      const match = ua.match(/edg\/(\d+(\.\d+)*)/);
      if (match) browser_version = match[1];
    } else if (ua.includes("opr/") || ua.includes("opera/")) {
      browser = "Opera";
      const match = ua.match(/(?:opr|opera)\/(\d+(\.\d+)*)/);
      if (match) browser_version = match[1];
    } else if (ua.includes("chrome/")) {
      browser = "Chrome";
      const match = ua.match(/chrome\/(\d+(\.\d+)*)/);
      if (match) browser_version = match[1];
    } else if (ua.includes("safari/")) {
      browser = "Safari";
      const match = ua.match(/version\/(\d+(\.\d+)*)/);
      if (match) browser_version = match[1];
    }

    const device_info = `${browser} ${browser_version} on ${os} (${device_type})`;

    return {
      device_type,
      browser,
      browser_version,
      os,
      device_info,
    };
  }
}

module.exports = new AdministrationService();
