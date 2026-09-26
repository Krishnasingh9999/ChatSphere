import mongoose from "mongoose";

const connectDb = async() =>{
  const url = process.env.MONGO_URI;

  if (!url) {
    console.log("⚠️ MONGO_URI is not defined. User service starting in In-Memory fallback mode.");
    return;
  }
  try {
    await mongoose.connect(url, {
      dbName: "ChatAppMicroserviceApp",
      serverSelectionTimeoutMS: 2000,
    });
    console.log("✅ connected to mongodb");
  } catch (error) {
    console.log("⚠️ MongoDB Connection failed. User service starting in In-Memory fallback mode.", error);
  }
}

export default connectDb;