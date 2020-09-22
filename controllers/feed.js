const fs = require('fs');
const path = require('path');
const {validationResult} = require('express-validator');
const io = require('./../socket');

const User = require('../models/user');
const Post = require('./../models/post');

exports.getPosts = async (req, res, next) => {
  const currentPage = req.query.page || 1;
  const perPage = 2;

  try {
    const totalItems = await Post.find().countDocuments();
    const posts = await Post.find().populate('creator').sort({createdAt: -1}).skip((currentPage - 1) * perPage).limit(perPage);

    res.status(200).json({
      message: 'Fetched posts successfully',
      posts,
      totalItems,
    });
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

exports.updatePost = async (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const error = new Error('Validation failed');
    error.statusCode = 422;
    throw error;
  }

  const {title, content} = req.body;
  const {postId} = req.params;
  let imageUrl = req.body.image;

  if (req.file) {
    imageUrl = req.file.path;
  }

  if (!imageUrl) {
    const error = new Error('No file');
    error.statusCode = 422;
    throw error;
  }

  try {
    const post = await Post.findById(postId).populate('creator');

    if (!post) {
      const error = new Error('The post doesn\'t exists');
      error.statusCode = 404;
      throw error;
    }

    if (imageUrl !== post.imageUrl) {
      clearImage(post.imageUrl);
    }

    if (post.creator._id.toString() !== req.userId) {
      const error = new Error('Unauthorized');
      error.statusCode = 403;
      throw error;
    }

    post.title = title;
    post.content = content;
    post.imageUrl = imageUrl;
    const response = await post.save();

    io.getIO().emit('posts', {
      action: 'update',
      post: response,
    });

    res.status(200).json({
      message: 'Post updated',
      post: response,
    });
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }

    next(error);
  }
}

exports.createPost = async (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const error = new Error('Validation failed');
    error.statusCode = 422;
    throw error;
  }

  if (!req.file) {
    const error = new Error('No image provided');
    error.statusCode = 422;
    throw error;
  }

  const imageUrl = req.file.path;

  const {title, content} = req.body;

  const post = new Post({
    title,
    content,
    imageUrl,
    creator: req.userId,
  });

  try {
    await post.save();
    const user = await User.findById(req.userId);
    user.posts.push(post);
    await user.save();

    io.getIO().emit('posts', {
      action: 'create',
      post: {
        ...post._doc,
        creator: {_id: req.userId},
        name: user.name,
      },
    });

    res.status(201).json({
      message: 'Post created succesfully!',
      post,
      creator: {_id: user._id, name: user.name},
    });
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }

    next(error);
  }
};

exports.getPost = (req, res, next) => {
  const {postId} = req.params;

  Post.findById(postId)
    .then(post => {
      if (!post) {
        const error = new Error('The post doesn\'t exists');
        error.statusCode = 404;
        throw error;
      }

      res.status(200).json({message: 'Post fetched', post});
    })
    .catch(error => {
      if (!error.statusCode) {
        error.statusCode = 500;
      }

      next(error);
    });
}

exports.deletePost = async (req, res, next) => {
  const {postId} = req.params;
  try {
    const post = await Post.findById(postId);

    if (!post) {
      const error = new Error('The post doesn\'t exists');
      error.statusCode = 404;
      throw error;
    }

    if (post.creator.toString() !== req.userId) {
      const error = new Error('Unauthorized');
      error.statusCode = 403;
      throw error;
    }

    clearImage(post.imageUrl);

    await Post.findByIdAndRemove(postId);

    const user = await User.findById(req.userId);
    user.posts.pull(postId);
    await user.save();

    io.getIO().emit('posts', {
      action: 'delete',
      post: postId,
    });

    res.status(200).json({message: 'Post deleted successfully'});
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }

    next(error);
  }

}

const clearImage = (filePath) => {
  filePath = path.join(__dirname, '..', filePath);
  fs.unlink(filePath, error => {
    console.log(error);
  });
}