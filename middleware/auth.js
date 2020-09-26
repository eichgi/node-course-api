const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  const authHeader = req.get('Authorization');
  if (!authHeader) {
    /*const error = new Error('Not authenticated');
    error.statusCode = 401;
    throw error;*/
    req.isAuth = false;
    return next();
  }

  const token = authHeader.split(' ')[1];
  let decodedToken;

  try {
    decodedToken = jwt.verify(token, process.env.JWT_SECRET_KEY);
  } catch (error) {
    /*error.statusCode = 500;
    throw error;*/
    req.isAuth = false;
    return next();
  }

  if (!decodedToken) {
    /*const error = new Error('Unauthenticated');
    error.statusCode = 401;
    throw error;*/
    req.isAuth = false;
    return next();
  }

  req.userId = decodedToken.userId;
  req.isAuth = true;
  next();
};