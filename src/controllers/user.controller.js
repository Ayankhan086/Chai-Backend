import { asyncHandler } from '../utils/asynchandler.js';
import ApiError from '../utils/ApiError.js';
import User from '../models/user.model.js';
import uploadOnCloudinary from '../utils/cloudinary.js';
import ApiResponse from '../utils/ApiResponse.js';
import jwt from "jsonwebtoken"
import mongoose from 'mongoose';

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

    if (!incomingrefreshToken) {
        throw new ApiError(400, "Unauthorized Request")
    }

    const options = {
        httpOnly: true,
        secure: true
    }

    const decodedToken = await jwt.verify(incomingrefreshToken, process.env.REFRESH_TOKEN_SECRET, options)

    if (!decodedToken) {
        throw new ApiError(401, "Invalid refresh token")
    }

    const user = User.findById(decodedToken?._id)

    if (!user) {
        throw new ApiError(401, "Invalid refresh token")
    }

    if (incomingrefreshToken !== user.refreshToken) {
        throw new ApiError(401, " Refresh token is used ")
    }

    const { accessToken, newrefreshToken } = await generateAccessTokenAndRefreshToken(user._id)


    return res.status(200).cookie("accessToken", accessToken, options).cookie("refreshToken", newrefreshToken, options).json(
        new ApiResponse(
            200,
            { accessToken, refreshToken: newrefreshToken },
            "Access Token refreshed"
        )
    )

})

const changeCurrentPassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body;

    const user = await User.findById(req.user?._id)
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    if (!isPasswordCorrect) {
        throw new ApiError(400, "Invalid Old Password");
    }

    user.password = newPassword;
    await user.save({ validateBeforeSave: false })

    return refreshAccessToken.status(200).json(new ApiResponse(200, "Password Changed Successfully."))

})

const getCurrentUser = asyncHandler(async (req, res) => {
    return res.status(200).json(200, req.user, "Current User Fetched Successfully")
})

const updateAccountDetails = asyncHandler(async (req, res) => {
    const { fullname, email } = req.body;

    if (!fullname || !email) {
        throw new ApiError(401, "All fields required.")
    }

    const user = User.findByIdAndUpdate(

        req.user?._id,
        {
            $set: {
                fullname: fullname,
                email: email
            }
        },
        { new: true }
    ).select("-password");

    return res.status(200).json(new ApiResponse(200, user, "Account Details Updated Successfully"))
})

const updateUserAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = req.file?.path;

    if (!avatarLocalPath) {
        throw new ApiError(402, "Avatar File is missing")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if (!avatar) {
        throw new ApiError(402, "Error while uploading avatar")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                avatar: avatar.url
            }
        },
        { new: true }
    ).select("-password");

    return res.status(200).json(new ApiResponse(200, user, "Account Avatar Updated Successfully"))

})

const updateUserCoverImage = asyncHandler(async (req, res) => {
    const coverimageLocalPath = req.file?.path;

    if (!coverimageLocalPath) {
        throw new ApiError(402, "Avatar File is missing")
    }

    const coverImage = await uploadOnCloudinary(coverimageLocalPath)

    if (!coverImage) {
        throw new ApiError(402, "Error while uploading avatar")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                coverimage: coverImage.url
            }
        },
        { new: true }
    ).select("-password");

    return res.status(200).json(new ApiResponse(200, user, "Account CoverImage Updated Successfully"))

})

const getUserChannelProfile = asyncHandler(async (req, res) => {
    const { username } = req.params

    if (!username?.trim()) {
        throw new ApiError(400, "Username is missing")
    }

    const channel = await User.aggregate([
        {
            $match: {
                username: username?.toLowerCase()
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedto"
            }
        },
        {
            $addFields: {
                subscribersCount: {
                    $size: "$subscribers"
                },
                channelsSubscribedtoCount: {
                    $size: "$subscribedto"
                },
                isSubscribed: {
                    $condition: {
                        if: { $in: [req.user?._id, "$subscribers.subscriber"] },
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                fullname: 1,
                username: 1,
                subscribersCount: 1,
                channelsSubscribedtoCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverimage: 1,
                email: 1
            }
        }
    ])

    console.log(channel);

    if (!channel?.length) {
        throw new ApiError(404, "Channel does not exist")
    }

    return res
        .status(200)
        .json(new ApiResponse(200, channel[0], "User channel fetched successfully"))
})

const getWatcHistory = asyncHandler(async (req, res) => {
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        fullname: 1,
                                        username: 1,
                                        avatar: 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields: {
                            owner: {
                                $first: "$owner"
                            }
                        }
                    }
                ]

            }
        }
    ])
    

    return res.status(200).json(new ApiResponse(200, user[0].watchHistory, "Watch History fetched Successfully"))
})

export default {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    getUserChannelProfile,
    updateUserAvatar,
    updateUserCoverImage,
    getWatcHistory
}