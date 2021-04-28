const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');

const authRoute = require('./routes/userRoutes.js');
const postRoute = require('./routes/postRoute.js');
const AppError = require('./utils/appErrorHandler.js');
const globalErrorHandler = require('./controllers/errorController');

const app = express();

//Middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

app.use(express.json());
app.use(helmet());
app.use(express.urlencoded({ extended: false }));

app.use(function (req, res, next) {
  console.log(req.headers);
  next();
});

// loading Routes
app.use('/api/v1/user', authRoute);
app.use('/api/v1/blog', postRoute);

app.all('*', (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server`, 404));
});

app.use(globalErrorHandler);
module.exports = app;