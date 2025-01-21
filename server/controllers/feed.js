import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'url';
import { validationResult } from 'express-validator';
import { PostModel as Post } from '../models/post.js';
import { UserModel as User } from '../models/user.js';
import { socketConfig as io } from '../socket.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const catchError = (err, next) => {
  if (!err.statusCode) {
    err.statusCode = 500;
    next(err);
  }
};

const deleteOldImage = (filePath) => {
  filePath = path.join(__dirname, '..', filePath);
  fs.unlink(filePath, (err) => console.log(err));
};

export const getPosts = async (req, res, next) => {
  const currentPage = req.query.page || 1;
  const perPage = 2;

  try {
    const totalItems = await Post.find().countDocuments();

    const posts = await Post.find()
      .populate('creator')
      .sort({ createdAt: -1 })
      .skip((currentPage - 1) * perPage)
      .limit(perPage);

    res.status(200).json({ message: 'Fetched posts successgully', posts, totalItems });
  } catch (err) {
    catchError(err, next);
  }
};

export const postPost = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const error = new Error('Validation failed, entred data is incorrect');
      error.statusCode = 422;
      throw error;
    }
    if (!req.file) {
      const error = new Error('No image provided');
      error.statusCode = 422;
      throw error;
    }

    const imageUrl = req.file.path;
    const title = req.body.title;
    const content = req.body.content;

    const post = new Post({
      title,
      content,
      creator: req.userId,
      imageUrl,
    });

    const postData = await post.save();
    const user = await User.findById(req.userId);
    user.posts.push(post);
    const creator = await user.save();
    io.getIo().emit('posts', {
      action: 'create',
      post: { ...postData._doc, creator: { _id: req.userId, name: user.name } },
    });
    res.status(201).json({
      message: 'Post created',
      post: postData,
      creator: { _id: creator._id, name: creator.name },
    });
  } catch (err) {
    catchError(err, next);
  }
};

export const getPost = async (req, res, next) => {
  const postId = req.params.postId;
  try {
    const post = await Post.findById(postId);
    if (!post) {
      const error = new Error('Could not find post.');
      error.statusCode = 404;
      throw error;
    }
    return res.status(200).json({ message: 'Post fetched', post });
  } catch (err) {
    catchError(err, next);
  }
};

export const updatePost = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const error = new Error('Validation failed, entred data is incorrect');
      error.statusCode = 422;
      throw error;
    }

    let imageUrl = req.body.image;
    const title = req.body.title;
    const content = req.body.content;
    const postId = req.params.postId;
    if (req.file) {
      imageUrl = req.file.path;
    }
    if (!imageUrl) {
      const error = new Error('No file picked');
      error.statusCode = 422;
      throw error;
    }

    const post = await Post.findById(postId).populate('creator');
    if (!post) {
      const error = new Error('Could not find post.');
      error.statusCode = 404;
      throw error;
    }
    if (post.creator._id.toString() !== req.userId) {
      const error = new Error('Not authorized!');
      error.statusCode = 403;
      throw error;
    }
    if (imageUrl !== post.imageUrl) {
      deleteOldImage(post.imageUrl);
    }
    post.set({ imageUrl, title, content });
    const result = await post.save();

    io.getIo().emit('posts', {
      action: 'update',
      post: result,
    });

    return res.status(200).json({ message: 'post updated', post: result });
  } catch (err) {
    catchError(err, next);
  }
};

export const deletePost = async (req, res, next) => {
  const postId = req.params.postId;

  try {
    const post = await Post.findById(postId);
    if (!post) {
      const error = new Error('Could not find post.');
      error.statusCode = 404;
      throw error;
    }
    if (post.creator.toString() !== req.userId) {
      const error = new Error('Not authorized!');
      error.statusCode = 403;
      throw error;
    }
    const user = await User.findById(req.userId);

    user.posts.pull(postId);
    await user.save();
    await Post.findByIdAndDelete(postId);
    deleteOldImage(post.imageUrl);
    io.getIo().emit('posts', {
      action: 'delete',
      post: postId,
    });
    return res.status(200).json({ message: 'post deleted successfully' });
  } catch (err) {
    catchError(err, next);
  }
};
