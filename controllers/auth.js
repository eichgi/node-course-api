const dotenv = require('dotenv');
const User = require('./../models/user');
const bcrypt = require('bcrypt');
const {validationResult} = require('express-validator');
const jwt = require('jsonwebtoken');

dotenv.config();

exports.signup = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const error = new Error('Validation failed');
    error.statusCode = 422;
    error.data = errors.array();
    throw error;
  }

  const {email, password, name} = req.body;

  bcrypt.hash(password, 12)
    .then(hashedPassword => {
      const user = new User({
        email,
        password: hashedPassword,
        name,
      });
      return user.save();
    })
    .then(user => {
      return res.status(201).json({message: 'User created', userId: user._id});
    })
    .catch(error => {
      if (!error.statusCode) {
        error.statusCode = 500;
      }
      next(error);
    });
};

exports.login = (req, res, next) => {
  const {email, password} = req.body;
  let loadedUser;

  User.findOne({email})
    .then(user => {
      if (!user) {
        const error = new Error('Invalid credentials (email)');
        error.statusCode = 401;
        error.data = [];
        throw error;
      }

      loadedUser = user;
      return bcrypt.compare(password, user.password);
    })
    .then(response => {
      if (!response) {
        const error = new Error('Invalid credentials (password)');
        error.statusCode = 401;
        error.data = [];
        throw error;
      }

      const token = jwt.sign({
        email: loadedUser.email,
        userId: loadedUser._id.toString(),
      }, process.env.JWT_SECRET_KEY, {
        expiresIn: '1h'
      });

      return res.status(200).json({token, userId: loadedUser._id.toString()});
    })
    .catch(error => {
      if (!error.statusCode) {
        error.statusCode = 500;
      }
      next(error);
    });
}

exports.getUserStatus = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      const error = new Error('User not found.');
      error.statusCode = 404;
      throw error;
    }
    res.status(200).json({ status: user.status });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};