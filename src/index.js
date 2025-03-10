import dotenv from "dotenv";

import mongoose from "mongoose";
import { DB_NAME } from "./constants.js";
import connectDB from "./db/dbconnect.js";
import app from "./app.js"


dotenv.config(
    {
        path: "./.env"
    }
);


connectDB().then(() => {
    app.listen(process.env.PORT || 8000, () => {
        console.log(`Server running on port ${process.env.PORT || 8000}`);
    })
    app.on('error', (error) => {
        console.error(`Error: ${error.message
            }`);
    })
}).catch((error) => {
    console.error(`Error: ${error.message}`);
    process.exit(1);
});