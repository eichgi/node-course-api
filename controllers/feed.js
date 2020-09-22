const fs = require('fs');
const path = require('path');
const {validationResult} = require('express-validator');

const User = require('../models/user');
const Post = require('./../models/post');

exports.getPosts = async (req, res, next) => {
  const currentPage = req.query.page || 1;
  const perPage = 2;

  try {
    const totalItems = await Post.find().countDocuments();
    const posts = await Post.find().skip((currentPage - 1) * perPage).limit(perPage);

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

exports.updatePost = (req, res, next) => {
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

  Post.findById(postId)
    .then(post => {
      if (!post) {
        const error = new Error('The post doesn\'t exists');
        error.statusCode = 404;
        throw error;
      }

      if (imageUrl !== post.imageUrl) {
        clearImage(post.imageUrl);
      }

      if (post.creator.toString() !== req.userId) {
        const error = new Error('Unauthorized');
        error.statusCode = 403;
        throw error;
      }

      post.title = title;
      post.content = content;
      post.imageUrl = imageUrl;
      return post.save();
    })
    .then(response => {
      res.status(200).json({
        message: 'Post updated',
        post: response,
      });
    })
    .catch(error => {
      if (!error.statusCode) {
        error.statusCode = 500;
      }

      next(error);
    });
}

exports.createPost = (req, res, next) => {
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
  let creator;

  const post = new Post({
    title,
    content,
    imageUrl,
    creator: req.userId,
  });

  post.save()
    .then(post => {
      return User.findById(req.userId);
    })
    .then(user => {
      creator = user;
      user.posts.push(post);
      return user.save();
    })
    .then(response => {
      res.status(201).json({
        message: 'Post created succesfully!',
        post,
        creator: {_id: creator._id, name: creator.name},
      });
    })
    .catch(error => {
      if (!error.statusCode) {
        error.statusCode = 500;
      }

      next(error);
    })
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

exports.deletePost = (req, res, next) => {
  const {postId} = req.params;

  Post.findById(postId)
    .then(post => {
      //Check logged in user
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

      return Post.findByIdAndRemove(postId);
    })
    .then(response => {
      return User.findById(req.userId);
    })
    .then(user => {
      user.posts.pull(postId);
      return user.save();
    })
    .then(response => {
      res.status(200).json({message: 'Post deleted successfully'});
    })
    .catch(error => {
      if (!error.statusCode) {
        error.statusCode = 500;
      }

      next(error);
    });
}

const clearImage = (filePath) => {
  filePath = path.join(__dirname, '..', filePath);
  fs.unlink(filePath, error => {
    console.log(error);
  });
}