exports.getPosts = (req, res, next) => {
  res.status(200).json({
    posts: [{title: 'First Post', content: 'This is the first post'}],
  });
};

exports.createPost = (req, res, next) => {
  const {title, content} = req.body;
  console.log(title, content);
  res.status(201).json({
    message: 'Post created succesfully!',
    post: {
      id: new Date().toISOString(),
      title,
      content,
    }
  });
};