const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const multer = require('multer');

dotenv.config();

const feedRoutes = require('./routes/feed');
const authRoutes = require('./routes/auth');
const bodyParser = require('body-parser');

const app = express();

const fileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'images');
  },
  filename: (req, file, cb) => {
    cb(null, new Date().toISOString() + '-' + file.originalname);
  },
});
const fileFilter = (req, file, cb) => {
  console.log(file.mimetype);
  if (['image/png', 'image/jpg', 'image/jpeg'].includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(null, false);
  }
};

app.use(bodyParser.json());
app.use(multer({storage: fileStorage, fileFilter,}).single('image'));
app.use('/images', express.static(path.join(__dirname + '/images')));
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

app.use('/feed', feedRoutes);
app.use('/auth', authRoutes);
app.use((error, req, res, next) => {
  console.log(error);

  const status = error.statusCode || 500;
  const message = error.message;
  const data = error.data;

  res.status(status).json({message, data});
});
mongoose.connect(process.env.MONGODB_URI)
  .then(response => {
    app.listen(8080);
  })
  .catch(error => {
    console.log(error);
  });