const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {

  const mongoUrl = process.env.MONGO_URI;
  try {
    const conn = await mongoose.connect(mongoUrl);
    console.log(`MongoDB connected: ${conn.connection.host}`);
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  }
};

module.exports = connectDB;
