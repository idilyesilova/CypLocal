const express = require('express');
const router = express.Router();
const regController = require('../controllers/registrationController');

router.post('/register', regController.registerToEvent);

module.exports = router;