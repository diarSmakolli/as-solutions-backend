const express = require('express');
const router = express.Router();
const NotificationController = require('./notification.controller');
const authGuard = require('../../guards/auth.guard');

// API ROUTES
router.post('/create-notification', NotificationController.createNotification);
router.get('/self/get-all-notifications', authGuard, NotificationController.getAllNotificationsSelf);
router.get('/self/unread-count', authGuard, NotificationController.countUnReadNotificationsSelf);
router.put('/self/read-notification/:notificationId', authGuard, NotificationController.markNotificationSelfAsRead);
router.put('/self/read-all-notifications', authGuard, NotificationController.markAllNotificatinsSelfAsRead);
router.delete('/self/delete-notification/:notificationId', authGuard, NotificationController.deleteNotificationSelf);


module.exports = router;