import jwt, { decode } from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

export const isAuth = async (req, res, next) => {
  const authHeader = req.get('Authorization');
  if (!authHeader) {
    const err = new Error('Not authenticated.');
    err.statusCode = 401;
    return next(err);
  }
  const token = req.get('Authorization').split(' ')[1];
  let decodedToken;
  try {
    decodedToken = jwt.verify(token, process.env.JWTSECRET);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      err.statusCode = 401;
      err.message = 'Token has expired. Please log in again.';
    } else {
      err.statusCode = 500;
      err.message = 'Failed to authenticate token.';
    }
    return next(err);
  }
  if (!decodedToken) {
    const err = new Error('Not authenticated.');
    err.statusCode = 401;
    return next(err);
  }
  req.userId = decodedToken.userId;
  next();
};
