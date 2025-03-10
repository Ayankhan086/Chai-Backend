import  {asyncHandler}  from '../utils/asynchandler.js';
import  ApiError  from '../utils/ApiError.js';
import  User  from '../models/user.model.js';
import  uploadOnCloudinary  from '../utils/cloudinary.js';
import ApiResponse from '../utils/ApiResponse.js';

const registerUser = asyncHandler(async (req, res) => {

    // Get user details from frontend

    const { fullname, username, email, password } = req.body;
 
    
    
    //Validate user details - (not empty, valid email, password length)

    if (
        [fullname, username, email, password].some((field)=> field?.trim() === "")
    )
    {
        throw new ApiError(400, "Please fill in all fields");
    }

    //Check if user already exists

    const existedUser = User.findOne({ 
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
    const coverImageLocalPath = req.files?.coverImage[0]?.path;

    if(!avatarLocalPath )
    {
        throw new ApiError(400, "Please upload an avatar");
    }
    

    //upload them to cloudinary, avatar check

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if(!avatar){
        throw new ApiError(500, "Avatar is required");
    }

    //Create user object - create entry in DB with user details

    const user = await User.create({

        fullname,
        username : username.toLowerCase(),
        email,
        password,
        avatar: avatar.url,
        coverImage: coverImage?.url || ""
 
   })

   //Remove password and refreshToken from response

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    //Check for user creation 

    if(!createdUser){
        throw new ApiError(500, "Something went wrong while registering user");
    }

    //return response

    return res.status(201).json(new ApiResponse(201, "User registered successfully", createdUser));

});

export { registerUser };