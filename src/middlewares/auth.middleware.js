import User from "../models/user.model.js";
import ApiError from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asynchandler.js";
import jwt from "jsonwebtoken"


const verifyjwt = asyncHandler(async (req, res, next) => {
   

        const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ","")

        ;
        
    
        if(!token){
            throw new ApiError(401, "Unauthorized request")
        }
    
        const decodedToken = await jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)

        const user = await User.findById(decodedToken?._id).select("-password -refreshToken")
        
    
        if(!user){
            throw new ApiError(402, "Invalid Access Token")
        }
    
        req.user = user

    
        next();

    

})

export default verifyjwt