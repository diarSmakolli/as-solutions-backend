const express = require('express');
const router = express.Router();
const AdministrationController = require('./administration.controller');
const authGuard = require('../../guards/auth.guard');
const roleGuard = require('../../guards/role.guard');

// API routes
router.post('/create-account', authGuard, roleGuard('global-administrator', 'administrator'), AdministrationController.createAdministrationAccountExceptSupplier);
router.post('/login-account', AdministrationController.loginToTheAccount);
router.get('/self', authGuard, AdministrationController.getSelfInfo);
router.post('/sign-out', AdministrationController.signOutSelf);
router.put('/change-password', authGuard, AdministrationController.changeSelfPassword);
router.get('/detailed-information', authGuard, AdministrationController.getSelfDetails);
router.get('/self-active-sessions', authGuard, AdministrationController.getSelfActiveSessions);
router.get('/self-activities', authGuard, AdministrationController.getSelfActivities);
router.delete('/terminate-session/:sessionId', authGuard, AdministrationController.terminateOnlineDevice);
router.put('/update-visible-status', authGuard, AdministrationController.updateSelfVisibleStatus);
router.put('/update-preferred-name', authGuard, AdministrationController.updatePreferredName);
// ADMIN ROUTES
router.get('/all-accounts', authGuard, roleGuard('global-administrator', 'administrator'), AdministrationController.getAllUsersList);
router.put('/update-account-details/:accountId', authGuard, roleGuard('global-administrator', 'administrator'), AdministrationController.editUserDetails);
router.post('/lock-account/:accountId', authGuard, roleGuard('global-administrator', 'administrator'), AdministrationController.lockAccountOfUserAsAdministrator);
router.post('/unlock-account/:accountId', authGuard, roleGuard('global-administrator', 'administrator'), AdministrationController.unlockAccountOfUserAsAdministrator);
router.post('/verify-account/:accountId', authGuard, roleGuard('global-administrator', 'administrator'), AdministrationController.verifyAccountOfUserAsAdministrator);
router.post('/unverify-account/:accountId', authGuard, roleGuard('global-administrator', 'administrator'), AdministrationController.unVerifyAccountOfUserAsAdministrator);
router.post('/mark-suspicious/:accountId', authGuard, roleGuard('global-administrator', 'administrator'), AdministrationController.markAccountAsSuspiciousAsAdministrator);
router.post('/clear-suspicious/:accountId', authGuard, roleGuard('global-administrator', 'administrator'), AdministrationController.clearSuspiciousMarkOnAccountAsAdministrator);
router.post('/deactivate-account/:accountId', authGuard,roleGuard('global-administrator', 'administrator'),  AdministrationController.deactivateAccountAsAdministrator);
router.post('/activate-account/:accountId', authGuard, roleGuard('global-administrator', 'administrator'), AdministrationController.activateAccountAsAdministrator);
router.put('/reset-password/:accountId', authGuard, roleGuard('global-administrator', 'administrator'), AdministrationController.resetPasswordOfUserAsAdministrator);
router.get('/user-details/:accountId', authGuard, roleGuard('global-administrator', 'administrator'), AdministrationController.getDetailedInfomationOfUserAsAdministrator);
router.get('/user-sessions/:accountId', authGuard, roleGuard('global-administrator', 'administrator'), AdministrationController.getSessionsOfUserAsAdministrator);
router.get('/user-activities/:accountId', authGuard, roleGuard('global-administrator', 'administrator'), AdministrationController.getActivitiesOfUserAsAdministrator);
router.put('/user-details/:accountId/assign-company/:companyId', authGuard, roleGuard('global-administrator', 'administrator'), AdministrationController.assignCompanyToUser);

module.exports = router;