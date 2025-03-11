import { asyncHandler } from '../utils/asynchandler.js';
import ApiError from '../utils/ApiError.js';
import User from '../models/user.model.js';
import uploadOnCloudinary from '../utils/cloudinary.js';
import ApiResponse from '../utils/ApiResponse.js';
import jwt from "jsonwebtoken"

const registerUser = asyncHandler(async (req, res) => {

    // Get user details from frontend

    const { fullname, username, email, password } = req.body;



    //Validate user details - (not empty, valid email, password length)

    if (
        [fullname, username, email, password].some((field) => field?.trim() === "")
    ) {
        throw new ApiError(400, "Please fill in all fields");
    }

    //Check if user already exists

    const existedUser = await User.findOne({
        $or: [
            { username },
            { email }
        ]
    })

    if (existedUser) {
        throw new ApiError(409, "User already exists");
    }

    //Check for images, and avatar



    const avatarLocalPath = req.files?.avatar[0]?.path;
    const coverImageLocalPath = req.files?.coverimage[0]?.path;

    if (!avatarLocalPath) {
        throw new ApiError(400, "Please upload an avatar");
    }


    //upload them to cloudinary, avatar check

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);


    if (!avatar) {
        throw new ApiError(500, "Avatar is required");
    }

    //Create user object - create entry in DB with user details

    const user = await User.create({

        fullname,
        username: username.toLowerCase(),
        email,
        password,
        avatar: avatar.url,
        coverimage: coverImage.url

    })


    //Remove password and refreshToken from response

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    //Check for user creation 

    if (!createdUser) {
        throw new ApiError(500, "Something went wrong while registering user");
    }



    //return response

    return res.status(201).json(new ApiResponse(201, "User registered successfully", createdUser));

});


const generateAccessTokenAndRefreshToken = async (userId) => {

    try {

        const user = await User.findById(userId);
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });

        return { accessToken, refreshToken };

    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating tokens");
    }
}

const loginUser = asyncHandler(async (req, res) => {

    // Get user details from frontend

    const { email, username, password } = req.body;

    //Validate user details - (not empty, valid email, password length)

    if (!email && !username) {
        throw new ApiError(400, "Please provide email or username");
    }

    const user = await User.findOne({
        $or: [
            { email },
            { username }
        ]
    })

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    //Check if password is correct

    const validpassword = await user.isPasswordCorrect(password);

    if (!validpassword) {
        throw new ApiError(401, "Invalid User credentials");
    }

    //Generate access token

    const { accessToken, refreshToken } = await generateAccessTokenAndRefreshToken(user._id);

    const loggedInuser = await User.findById(user._id).select("-password -refreshToken");

    //return response

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
        .status(200)
        .cookie("refreshToken", refreshToken, options)
        .cookie("accessToken", accessToken, options)
        .json(new ApiResponse(200, "User logged in successfully", {
            user: loggedInuser, accessToken, refreshToken
        }));


});

const logoutUser = asyncHandler(async (req, res) => {
    const userId = req.user._id
    

    await User.findByIdAndUpdate(userId, {
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

    return res.status(200).clearCookie("accessToken", options).clearCookie("refreshToken", options).json(new ApiResponse(200, {}, "User logged Out"))

})

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingrefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if(!incomingrefreshToken){
        throw new ApiError(400, "Unauthorized Request")
    }

    const options = {
        httpOnly: true,
        secure: true
    } 

    const decodedToken = await jwt.verify(incomingrefreshToken,process.env.REFRESH_TOKEN_SECRET,options)

    if(!decodedToken){
        throw new ApiError(401, "Invalid refresh token")
    }

    const user = User.findById(decodedToken?._id)

    if(!user){
        throw new ApiError(401, "Invalid refresh token")
    }

    if(incomingrefreshToken !== user.refreshToken){
        throw new ApiError(401, " Refresh token is used ")
    }

    const {accessToken, newrefreshToken} = await generateAccessTokenAndRefreshToken(user._id)

    
    return res.status(200).cookie("accessToken",accessToken, options).cookie("refreshToken", newrefreshToken, options).json(
        new ApiResponse(
            200,
            {accessToken, refreshToken : newrefreshToken },
            "Access Token refreshed"
        )
    )

})

export { registerUser };
export { loginUser };
export { logoutUser };
export { refreshAccessToken };