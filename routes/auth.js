const express = require('express');
const {check} = require('express-validator');
const authController = require('./../controllers/auth');
const User = require('./../models/user');
const isAuth = require('./../middleware/auth');

const router = express.Router();

router.put('/signup', [
  check('email')
    .isEmail()
    .withMessage('Please enter a valid email')
    .custom((value, {req}) => {
      return User.findOne({email: value})
        .then(user => {
          if (user) {
            return Promise.reject('The email is already registered')
          }
        })
        .catch(error => {
          console.log(error);
        })
    }).normalizeEmail(),
  check('password')
    .trim()
    .isLength({min: 5}),
  check('name')
    .trim()
    .not()
    .isEmpty(),
], authController.signup);

router.get('/status', isAuth, authController.getUserStatus);

router.post('/login', authController.login);

module.exports = router;