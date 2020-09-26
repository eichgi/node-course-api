const User = require('./../models/user');
const bcrypt = require('bcrypt');
const validator = require('validator');
const jwt = require('jsonwebtoken');
const Post = require('./../models/post');
const {clearImage} = require('./../util/file');

module.exports = {
  createUser: async function (args, req) {
    const {email, password, name} = args.userInput;
    const errors = [];

    if (!validator.isEmail(email)) {
      errors.push({message: 'Invalid email'});
    }

    if (validator.isEmpty(password) || !validator.isLength(password, {min: 5})) {
      errors.push({message: 'Password must contains at least 5 characters'});
    }

    if (errors.length > 0) {
      const error = new Error('Invalid input');
      error.data = errors;
      error.code = 422;
      throw error;
    }

    const existingUser = await User.findOne({email});
    if (existingUser) {
      throw  new Error('User already registered');
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await new User({
      email,
      password: hashedPassword,
      name,
    }).save();

    return {...user._doc, _id: user._id.toString()};
  },
  login: async function ({email, password}) {
    const user = await User.findOne({email});

    if (!user) {
      const error = new Error('User not found');
      error.code = 401;
      throw error;
    }

    const check = await bcrypt.compare(password, user.password);
    if (!check) {
      const error = new Error('Invalid credentials');
      error.code = 401;
      throw error;
    }

    const token = jwt.sign({
        userId: user._id.toString(),
        email: user.email,
      }, process.env.JWT_SECRET_KEY,
      {expiresIn: '1h'}
    );

    return {token, userId: user._id.toString()};
  },
  createPost: async function ({postInput}, req) {
    if (!req.isAuth) {
      const error = new Error('Not authenticated');
      error.code = 401;
      throw error;
    }

    const errors = [];

    if (validator.isEmpty(postInput.title) || !validator.isLength(postInput.title, {min: 5})) {
      errors.push({message: 'Invalid title'});
    }

    if (validator.isEmpty(postInput.content) || !validator.isLength(postInput.content, {min: 5})) {
      errors.push({message: 'Invalid content'});
    }

    if (errors.length > 0) {
      const error = new Error('Invalid input');
      error.data = errors;
      error.code = 422;
      throw error;
    }

    const user = await User.findById(req.userId);
    if (!user) {
      const error = new Error('Invalid user');
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
    }
  },
  posts: async function ({page}, req) {
    if (!req.isAuth) {
      const error = new Error('Not authenticated');
      error.code = 401;
      throw error;
    }

    if (!page) {
      page = 1;
    }

    const perPage = 2;
    const totalPosts = await Post.find().countDocuments();
    const posts = await Post.find()
      .sort({createdAt: -1})
      .skip((page - 1) * perPage)
      .limit(perPage)
      .populate('creator');

    return {
      totalPosts,
      posts: posts.map(post => {
        return {
          ...post._doc,
          _id: post._id.toString(),
          createdAt: post.createdAt.toISOString(),
          updatedAt: post.updatedAt.toISOString(),
        };
      }),
    };
  },
  post: async function ({id}, req) {
    if (!req.isAuth) {
      const error = new Error('Not authenticated');
      error.code = 401;
      throw error;
    }

    const post = await Post.findById(id).populate('creator');
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
  updatePost: async function ({id, postInput}, req) {
    const errors = [];

    if (validator.isEmpty(postInput.title) || !validator.isLength(postInput.title, {min: 5})) {
      errors.push({message: 'Invalid title'});
    }

    if (validator.isEmpty(postInput.content) || !validator.isLength(postInput.content, {min: 5})) {
      errors.push({message: 'Invalid content'});
    }

    if (!req.isAuth) {
      const error = new Error('Not authenticated');
      error.code = 401;
      throw error;
    }

    const post = await Post.findById(id).populate('creator');
    if (!post) {
      const error = new Error('No post found');
      error.code = 404;
      throw error;
    }

    if (post.creator._id.toString() !== req.userId.toString()) {
      const error = new Error('Not authorized');
      error.code = 403;
      throw error;
    }

    if (errors.length > 0) {
      const error = new Error('Invalid input');
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
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
    }
  },
  deletePost: async function ({id}, req) {
    if (!req.isAuth) {
      const error = new Error('Not authenticated');
      error.code = 401;
      throw error;
    }

    const post = await Post.findById(id);
    if (!post) {
      const error = new Error('No post found');
      error.code = 404;
      throw error;
    }

    if (post.creator.toString() !== req.userId.toString()) {
      const error = new Error('Not authorized');
      error.code = 403;
      throw error;
    }

    try {
      clearImage(post.imageUrl);
      await Post.findByIdAndRemove(id);
      const user = User.findById(req.userId);
      user.posts.pull(id);
      await user.save();
      return true;
    } catch (error) {
      return false;
    }
  },
  user: async function (args, req) {
    if (!req.isAuth) {
      const error = new Error('Not authenticated');
      error.code = 401;
      throw error;
    }

    const user = await User.findById(req.userId);

    if (!user) {
      const error = new Error('No user found');
      error.code = 404;
      throw error;
    }

    return {
      ...user._doc,
      _id: user._id.toString(),
    };
  },
  updateStatus: async function ({status}, req) {
    if (!req.isAuth) {
      const error = new Error('Not authenticated');
      error.code = 401;
      throw error;
    }

    const user = await User.findById(req.userId);

    if (!user) {
      const error = new Error('No user found');
      error.code = 404;
      throw error;
    }

    user.status = status;
    await user.save();

    return {
      ...user._doc,
      _id: user._id.toString(),
    };
  },
};