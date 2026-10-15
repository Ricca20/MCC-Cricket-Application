// Central error handler: log the detail, return a generic message
const notFound = (req, res) => {
  res.status(404).json({ message: 'Not found' });
};

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  if (err.name === 'CastError') {
    return res.status(400).json({ message: 'Invalid ID' });
  }
  if (err.name === 'ValidationError') {
    return res.status(400).json({ message: 'Invalid data' });
  }
  if (err.code === 11000) {
    return res.status(409).json({ message: 'That record already exists' });
  }
  if (err.type === 'entity.parse.failed' || err.type === 'entity.too.large') {
    return res.status(err.status || 400).json({ message: 'Invalid request body' });
  }
  const status = err.status && err.status < 500 ? err.status : 500;
  if (status >= 500) console.error(err);
  res.status(status).json({
    message: err.expose ? err.message : 'Something went wrong'
  });
};

// Throw from a controller to send a specific 4xx message
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.expose = true;
  }
}

module.exports = { notFound, errorHandler, HttpError };
