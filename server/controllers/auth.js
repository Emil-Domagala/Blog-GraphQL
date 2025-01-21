import { UserModel as User } from '../models/user.js';
import bcrypt from 'bcrypt';
import { validationResult } from 'express-validator';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

const catchError = (err, next) => {
  if (!err.statusCode) {
    err.statusCode = 500;
    next(err);
  }
};

export const signupUser = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const error = new Error('Validation failed, entred data is incorrect');
      error.statusCode = 422;
      error.data = errors.array();
      throw error;
    }

    const email = req.body.email;
    const name = req.body.name;
    const password = req.body.password;

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = new User({
      email,
      name,
      password: hashedPassword,
    });

    const result = await user.save();
    res.status(201).json({
      message: 'User created',
      userId: result._id,
    });
  } catch (err) {
    catchError(err, next);
  }
};

export const loginUser = async (req, res, next) => {
  const email = req.body.email;
  const password = req.body.password;

  try {
    const user = await User.findOne({ email: email });
    if (!user) {
      const error = new Error('A user could not be found');
      error.statusCode = 401;
      throw error;
    }
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      const error = new Error('Wrong password');
      error.statusCode = 401;
      throw error;
    }
    const token = jwt.sign({ userId: user._id.toString(), email: user.email }, process.env.JWTSECRET, {
      expiresIn: '1h',
    });
    return res.status(200).json({ token, userId: user._id.toString() });
  } catch (err) {
    catchError(err, next);
  }
};

export const updateStatus = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const error = new Error('Validation failed, entred data is incorrect');
      error.statusCode = 422;
      throw error;
    }

    const status = req.body.status;

    const user = await User.findById(req.userId);
    if (!user) {
      const error = new Error('A user could not be found');
      error.statusCode = 401;
      throw error;
    }
    user.status = status;
    const updatedUser = await user.save();

    return res.status(200).json({ status: updatedUser.status });
  } catch (err) {
    catchError(err, next);
  }
};

export const getStatus = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      const error = new Error('A user could not be found');
      error.statusCode = 401;
      throw error;
    }
    return res.status(200).json({ status: user.status });
  } catch (err) {
    catchError(err, next);
  }
};
