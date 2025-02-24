import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinery } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const genrateAccessAndRefreshTokens = async(userId) =>{
  try {
    const user = await User.findById(userId)
    const accessToken = user.genrateAccessToken()
    const refreshToken = user.genrateRefreshToken()

    user.refreshToken = refreshToken
    await user.save({validateBeforeSave: false})

    return {accessToken, refreshToken}

  } catch (error) {
    throw new ApiError(500, "Something went wrong while generating tokens")
  }
}

const registerUser = asyncHandler(async (req, res) => {
  // get user details from ForntEnd
  // validate user details - not empty, valid email, password length
  // check if user already exists: email, username
  // check for images, check for avatar
  // upload them to cloudinary, avatar
  // create user object - create entry in db
  // remove password and refresh token field from response
  // check for user creation
  // return response

  const { fullName, username, email, password } = req.body;
  //console.log("email: ", email);

  // if (fullname === "") {
  //     throw new ApiError(400, "Full name is required")
  // }
  if (
    [fullName, email, username, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required");
  }

  const existedUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (existedUser) {
    throw new ApiError(400, "User with email or username already exists");
  }

  // console.log(req.files);

  const avatarLocalPath = req.files?.avatar[0]?.path;
  // const coverImageLocalPath = req.files?.coverImage[0]?.path;

  let coverImageLocalPath;
  if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
    coverImageLocalPath = req.files.coverImage[0].path
  }

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar is required");
  }

  const avatar = await uploadOnCloudinery(avatarLocalPath);
  const coverImage = await uploadOnCloudinery(coverImageLocalPath);

  if (!avatar) {
    throw new ApiError(400, "Avatar is required");
  }

  const user = await User.create({
    fullName,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    username: username.toLowerCase(),
  });

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    throw new ApiError(500, "something went wrong while creating user");
  }

  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "User created successfully"));
});

const loginUser = asyncHandler(async(req, res) => {
  //req body -> data
  // username or email
  // find the user
  // password check
  // generate access and refresh token
  // send cookie


  const {email, username, password} = req.body

  if (!username || !email) {
    throw new ApiError(400, "username or email is required")
  }

 const user = await User.findOne({
    $or: [{username}, {email}]
  })

  if (!user) {
    throw new ApiError(404, "User doesn't exist")
  }

  const isPasswordValid = await user.isPasswordCorrect(password)

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid user credentials")
  }

  const {accessToken, refreshToken} = await genrateAccessAndRefreshTokens(user._id)

  const loggedInUser = await User.findById(user._id).
  select("-password -refreshToken")

  const options = {
    httpOnly: true,
    secure: true
  }

  return res
  .status(200)
  .cookie("accessToken", accessToken, options) 
  .cookie("refreshToken", refreshToken, options)
  .json(
    new ApiResponse(
      200,
      {
        user: loggedInUser, accessToken, refreshToken
      },
      "User logged in successfully"
    )
  )
})

const logoutUser = asyncHandler(async(req, res) => {
  User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        refreshToken: undefined
      }
    },
    {
      new: true
    }
  )
  const options = {
    httpOnly: true,
    secure: true
  }

  return res
  .status(200)
  .clearCookie("accessToken", options)
  .clearCookie("refreshToken",options)
  .json(new ApiResponse(200, {}, "User Logged Out") )
})

export { 
  registerUser,
  loginUser,
  logoutUser
 };
