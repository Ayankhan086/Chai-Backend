import { Router } from "express";
import { logoutUser,
      registerUser, 
      changeCurrentPassword, 
      refreshAccessToken, 
      getCurrentUser, 
      updateUserAvatar, 
      updateUserCoverImage,
       getWatcHistory, 
       getUserChannelProfile } from "../controllers/user.controller.js";
import { loginUser } from "../controllers/user.controller.js";
import upload from "../middlewares/multer.middleware.js";
import  verifyjwt  from "../middlewares/auth.middleware.js"

const router = Router();

router.route("/register").post(
          upload.fields([
               {
                    name: "avatar",
                    maxCount: 1
               },
               {
                    name: "coverimage",
                    maxCount: 1
               }
          ]), registerUser)

router.route("/login").post(loginUser)

// secured routes

router.route("/logout").post(verifyjwt, logoutUser)
router.route("/refreshToken").post( refreshAccessToken )
router.route("/changed_password").post(verifyjwt, changeCurrentPassword)
router.route("/current-user").get(verifyjwt, getCurrentUser)
router.route("/update-account-details").patch(verifyjwt, updateAccountDetails)
router.route('/avatar').patch(verifyjwt, upload.single("avatar"), updateUserAvatar)
router.route("/coverimage").patch(verifyjwt, upload.single("/coverimage"), updateUserCoverImage)

router.route("/c/:username").get(verifyjwt, getUserChannelProfile)
router.route("/watchHistory").get(verifyjwt, getWatcHistory)

export default router;