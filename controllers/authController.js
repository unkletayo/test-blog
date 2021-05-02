const crypto = require('crypto');
const expressAsyncHandler = require('express-async-handler');
const User = require('../models/userModel');
const AppError = require('../utils/appErrorHandler');
const sendEmail = require('../utils/email');
const generateToken = require('../utils/generateToken');

const createSendToken = (user, statusCode, res) => {
   // log the user in
   const token = generateToken(user._id);

   res.status(statusCode).json({ status: 'success', token, data: {user} });
}


exports.signup = expressAsyncHandler(async (req, res, next) => {
  const { email, password, firstName, lastName, passwordConfirm } = req.body;

  const existingUser = await User.findOne({ email });

  if (existingUser) {
    return next(
      new AppError('User already exists, please create a new account', 404)
    );
  }

  const newUser = await User.create({
    firstName,
    lastName,
    email,
    password,
    passwordConfirm,
    registeredAt: new Date().toISOString(),
  });


  createSendToken(newUser, 201, res)
});


exports.login = expressAsyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  const existingUser = await User.findOne({ email }).select('+password');

  if (!existingUser) return next(new AppError('User does not exist', 404));

  const isPasswordCorrect =
    existingUser && (await existingUser.matchPassword(password));

  if (!isPasswordCorrect) return next(new AppError('Incorrect password', 401));

  const token = generateToken(existingUser._id);

  res.status(200).json({ message: 'success', token });
});


exports.getUserPost = expressAsyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const result = await User.findById(id).populate('posts');

  res.status(201).json({
    message: 'success',
    data: { post: result },
  });
});

exports.forgotPassword = expressAsyncHandler(async (req, res, next) => {
  // 1) Get user based on POSTed email
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(new AppError('There is no user with email address.', 404));
  }

  // 2) Generate the random reset token
  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  // 3) Send it to user's email
  const resetURL = `${req.protocol}://${req.get(
    'host'
  )}/api/v1/users/resetPassword/${resetToken}`;

  const message = `Forgot your password? Submit a PATCH request with your new password and passwordConfirm to: ${resetURL}.\nIf you didn't forget your password, please ignore this email!`;

  try {
    await sendEmail({
      email: user.email,
      subject: 'Your password reset token (valid for 10 min)',
      message,
    });

    res.status(200).json({
      status: 'success',
      message: 'Token sent to email!',
    });
  } catch (err) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return next(
      new AppError('There was an error sending the email. Try again later!'),
      500
    );
  }
});

exports.resetPassword = expressAsyncHandler(async (req, res, next) => {
  // Get user based on token
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });

  // if token has not expired and there is a user set the new password
  if (!user) {
    return next(new AppError('Token is invalid or has expired', 400));
  }
  user.password = req.body.password;
  user.passwordConfirm = req.body.password;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  // update changePasswordAt property for the user
  await user.save();

  // log the user in
  const token = generateToken(user._id);

  res.status(201).json({ status: 'success', token });
});

exports.updatePassword = expressAsyncHandler(async (req, res, next) => {
  // 1) Get user from collection
  const user = await User.findById(req.user.id).select('+password');
  console.log(user)
  // // 2) Check if POSTed current password is correct
  // if (!(await user.correctPassword(req.body.passwordCurrent, user.password))) {
  //   return next(new AppError('Your current password is wrong.', 401));
  // }

  // // 3) If so, update password
  // user.password = req.body.password;
  // user.passwordConfirm = req.body.passwordConfirm;
  // await user.save();
  // // User.findByIdAndUpdate will NOT work as intended!

  // // 4) Log user in, send JWT
  // createSendToken(user, 200, res);
});

// export const requestPassowrdReset = async (req, res) => {
//   const {email} = req.body;

//   const existingUser = await UserModel.f indOne({email});
//   if (!existingUser) return res.status(404).json({ message: "User doesn't exist" });

//   let token = await TokenModel.findOne({userId: existingUser._id})
//   if(token) await token.deleteOne();
//   let resetToken = crypto.randomBytes(32).toString("hex")
//   const hash = await bcrypt.hash(resetToken,Number(bcryptSalt))

//   const newToken = await TokenModel.create({
//     userId: existingUser._id,
//     token: hash,
//     createdAt: Date.now()
//   })

//   const link = `${clientURL}/passwordReset?token=${resetToken}&id=${user._id}`;
// }
