const notificationService = require("./notification.service");
const logger = require("../../logger/logger");

class NotificationController {
  // create notification
  async createNotification(req, res, next) {
    try {
      const result = await notificationService.createNotification(req.body);

      return res.status(201).json({
        status: "success",
        statusCode: 201,
        message: "Notification created successfully",
        data: result,
      });
    } catch (err) {
      logger.error(`createNotification: ${err.message}`);
      next(err);
    }
  }

  // get all notifications self
  async getAllNotificationsSelf(req, res, next) {
    const accountId = req.account.id;
    const page = req.query.page || 1;
    const limit = req.query.limit || 10;
    try {
      const result = await notificationService.getAllNotificationsSelf(
        accountId,
        page,
        limit
      );

      return res.status(200).json({
        status: "success",
        statusCode: 200,
        data: result,
      });
    } catch (err) {
      logger.error(`createNotification: ${err.message}`);
      next(err);
    }
  }

  // count of notifications self
  async countUnReadNotificationsSelf(req, res, next) {
    const accountId = req.account.id;
    try {
      const result = await notificationService.countUnReadNotificationsSelf(
        accountId
      );

      return res.status(200).json({
        status: "success",
        statusCode: 200,
        unread: result,
      });
    } catch (err) {
      logger.error(`countUnReadNotificationsSelf: ${err.message}`);
      next(err);
    }
  }

  // mark notification as read
  async markNotificationSelfAsRead(req, res, next) {
    const accountId = req.account.id;
    const { notificationId } = req.params;
    try {
      const result = await notificationService.markNotificationSelfAsRead(
        notificationId,
        accountId
      );

      return res.status(200).json({
        status: "success",
        statusCode: 200,
        message: "Notification marked as read successfully.",
        data: result,
      });
    } catch (err) {
      logger.error(`markNotificationSelfAsRead: ${err.message}`);
      next(err);
    }
  }

  // mark all notifications as read
  async markAllNotificatinsSelfAsRead(req, res, next) {
    const accountId = req.account.id;
    try {
      const result = await notificationService.markAllNotificatinsSelfAsRead(
        accountId
      );

      return res.status(200).json({
        status: "success",
        statusCode: 200,
        message: "All notifications marked as read successfully.",
        data: result,
      });
    } catch (err) {
      logger.error(`markAllNotificatinsSelfAsRead: ${err.message}`);
      next(err);
    }
  }

  // delete self notification
  async deleteNotificationSelf(req, res, next) {
    const accountId = req.account.id;
    const { notificationId } = req.params;
    try {
      const result = await notificationService.deleteNotificationSelf(
        accountId,
        notificationId
      );

      return res.status(200).json(result);
    } catch (err) {
      logger.error(`deleteNotificationSelf: ${err.message}`);
      next(err);
    }
  }


  
}

module.exports = new NotificationController();
