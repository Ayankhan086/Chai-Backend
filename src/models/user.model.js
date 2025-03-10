import mongoose, { Schema } from "mongoose";
import jwt from "jsonwebtoken"
import bcrypt from "bcrypt"

const UserSchema = new Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        index: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    fullname: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        index: true
    },
    avatar: {
        type: String, // cloudinary url
        required: true,
    },
    coverimage: {
        type: String // cloudinary url
    },
    watchHistory: [
        {
            type: Schema.Types.ObjectId,
            ref: 'Video'
        }
    ],
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: 6,
    },
    refreshToken: {
        type: String
    }
},
    {
        timestamps: true
    }
)

UserSchema.pre("save", async function (next) {
    if(!this.isModified("password"))
    {
        return next();
    }
    this.password = bcrypt.hash(this.password, 10)
    next();
})


UserSchema.methods.isPasswordCorrect = async function 
(password){
    return await bcrypt.compare(password, this.password)
}

UserSchema.methods.generateAccessToken = function () {
    jwt.sign(
        {
           _id: this._id,
           email: this.email,
           username: this.username,
           fullname: this.fullname
        },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn: process.env.ACCESS_TOKEN_EXPIRY
        }
    )
}
UserSchema.methods.generateRefreshToken = function () {
    jwt.sign(
        {
           _id: this._id,
           email: this.email,
           username: this.username,
           fullname: this.fullname
        },
        process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn: process.env.REFRESH_TOKEN_EXPIRY
        }
    )
}


const user = mongoose.model('User', UserSchema);

export default user;