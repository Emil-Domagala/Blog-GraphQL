import { UserModel as User } from '../models/user.js';
import { PostModel as Post } from '../models/post.js';
import validator from 'validator';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { deleteOldImage } from '../util/file.js';
dotenv.config();

const resolvers = {
  createUser: async function ({ userInput }, req) {
    const email = userInput.email;
    const name = userInput.name;
    const password = userInput.password;
    const errors = [];
    if (!validator.isEmail(email)) {
      errors.push({ message: 'Email is invalid' });
    }
    if (validator.isEmpty(password) || !validator.isLength(password, { min: 5 })) {
      errors.push({ message: 'Password too short!' });
    }
    if (errors.length > 0) {
      const error = new Error('Invalid input.');
      error.data = errors;
      error.code = 422;
      throw error;
    }

    const existingUser = await User.findOne({ email: email });
    if (existingUser) {
      const error = new Error('User exists already!');
      throw error;
    }
    const hashedPw = await bcrypt.hash(password, 12);
    const user = new User({ email, name, password: hashedPw });
    const result = await user.save();
    return {
      ...result._doc,
      _id: result._id.toString(),
    };
  },
  login: async function ({ email, password }, req) {
    const user = await User.findOne({ email: email });

    if (!user) {
      const error = new Error('User not found');
      error.code = 401;
      throw error;
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      const error = new Error('Invalid Password');
      error.code = 401;
      throw error;
    }

    const token = jwt.sign({ userId: user._id.toString(), email: user.email }, process.env.JWTSECRET, {
      expiresIn: '1h',
    });
    return { token, userId: user._id.toString() };
  },
  createPost: async function ({ postInput }, req) {
    if (!req.isAuth) {
      const error = new Error('Not authenticated.');
      error.code = 401;
      throw error;
    }
    const errors = [];
    if (validator.isEmpty(postInput.title) || !validator.isLength(postInput.title, { min: 5 })) {
      errors.push({ message: 'Title is invalid' });
    }
    if (validator.isEmpty(postInput.content) || !validator.isLength(postInput.content, { min: 5 })) {
      errors.push({ message: 'content is invalid' });
    }
    if (errors.length > 0) {
      const error = new Error('Invalid input.');
      error.data = errors;
      error.code = 422;
      throw error;
    }

    const user = await User.findById(req.userId);
    if (!user) {
      const error = new Error('User not found');
      error.data = errors;
      error.code = 401;
      throw error;
    }

    const post = new Post({
      title: postInput.title,
      content: postInput.content,
      imageUrl: postInput.imageUrl,
      creator: user,
    });

    const createdPost = await post.save();
    user.posts.push(createdPost);
    await user.save();
    return {
      ...createdPost._doc,
      _id: createdPost._id.toString(),
      createdAt: createdPost.createdAt.toISOString(),
      updatedAt: createdPost.updatedAt.toISOString(),
    };
  },
  posts: async function ({ page }, req) {
    if (!req.isAuth) {
      const error = new Error('Not authenticated.');
      error.code = 401;
      throw error;
    }
    if (!page) {
      page = 1;
    }
    const perPage = 2;

    const totalPosts = await Post.find().countDocuments();
    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .skip((page - 1) * perPage)
      .limit(perPage)
      .populate('creator');
    return {
      posts: posts.map((p) => {
        return {
          ...p._doc,
          _id: p._id.toString(),
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString(),
        };
      }),
      totalPosts,
    };
  },
  post: async function ({ postId }, req) {
    if (!req.isAuth) {
      const error = new Error('Not authenticated.');
      error.code = 401;
      throw error;
    }
    const post = await Post.findById(postId).populate('creator');
    if (!post) {
      const error = new Error('No post found');
      error.code = 404;
      throw error;
    }
    return {
      ...post._doc,
      _id: post._id.toString(),
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
    };
  },
  updatePost: async function ({ postId, postInput }, req) {
    if (!req.isAuth) {
      const error = new Error('Not authenticated.');
      error.code = 401;
      throw error;
    }

    const post = await Post.findById(postId).populate('creator');
    if (!post) {
      const error = new Error('No post found');
      error.code = 404;
      throw error;
    }
    if (post.creator._id.toString() !== req.userId.toString()) {
      const error = new Error('Not authorized.');
      error.code = 403;
      throw error;
    }

    const errors = [];
    if (validator.isEmpty(postInput.title) || !validator.isLength(postInput.title, { min: 5 })) {
      errors.push({ message: 'Title is invalid' });
    }
    if (validator.isEmpty(postInput.content) || !validator.isLength(postInput.content, { min: 5 })) {
      errors.push({ message: 'content is invalid' });
    }
    if (errors.length > 0) {
      const error = new Error('Invalid input.');
      error.data = errors;
      error.code = 422;
      throw error;
    }

    post.title = postInput.title;
    post.content = postInput.content;
    if (postInput.imageUrl !== 'undefined') {
      post.imageUrl = postInput.imageUrl;
    }
    const updatedPost = await post.save();

    return {
      ...updatedPost._doc,
      _id: updatedPost._id.toString(),
      createdAt: updatedPost.createdAt.toISOString(),
      updatedAt: updatedPost.updatedAt.toISOString(),
    };
  },
  deletePost: async function ({ postId }, req) {
    if (!req.isAuth) {
      const error = new Error('Not authenticated.');
      error.code = 401;
      throw error;
    }

    const post = await Post.findById(postId);
    if (!post) {
      const error = new Error('No post found');
      error.code = 404;
      throw error;
    }
    if (post.creator.toString() !== req.userId.toString()) {
      const error = new Error('Not authorized.');
      error.code = 403;
      throw error;
    }

    const user = await User.findById(req.userId);

    if (!user) {
      const error = new Error('User not found');
      error.code = 401;
      throw error;
    }

    deleteOldImage(post.imageUrl);
    user.posts.pull(postId);
    await user.save();
    await Post.findByIdAndDelete(postId);
    return true;
  },
  user: async function (args, req) {
    if (!req.isAuth) {
      const error = new Error('Not authenticated.');
      error.code = 401;
      throw error;
    }
    const user = await User.findById(req.userId);

    if (!user) {
      const error = new Error('User not found');
      error.code = 401;
      throw error;
    }

    return {
      ...user._doc,
      _id: user._id.toString(),
    };
  },
  updateStatus: async function ({ status }, req) {
    if (!req.isAuth) {
      const error = new Error('Not authenticated.');
      error.code = 401;
      throw error;
    }
    const user = await User.findById(req.userId);

    if (!user) {
      const error = new Error('User not found');
      error.code = 401;
      throw error;
    }

    user.status = status;

    const updatedUser = await user.save();

    return {
      ...updatedUser._doc,
      _id: updatedUser._id.toString(),
    };
  },
};

export default resolvers;
