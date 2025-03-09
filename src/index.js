import dotenv from "dotenv";

import mongoose from "mongoose";
import { DB_NAME } from "./constants.js";
import connectDB from "./db/dbconnect.js";

dotenv.config(
    {
        path: "./env"
    }
);


connectDB();