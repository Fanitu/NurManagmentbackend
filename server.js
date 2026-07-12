require('dotenv').config();
console.log("DEBUG: is process.env.MONGO_URI defined", !!process.env.MONGO_URI); 
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const authRoutes = require('./routes/authRoutes');
const orderRoutes = require('./routes/orderRoutes');
const orderListRoutes = require('./routes/orderListRoutes');
const runningCostRoutes = require('./routes/runningCostRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();

connectDB();

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || '*',
  })
);
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/orderlist', orderListRoutes);
app.use('/api/running-cost', runningCostRoutes);
app.use('/api/admin', adminRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// centralized error handler (catches anything thrown synchronously in routes)
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ message: 'Something went wrong on the server' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`OMS backend running on port ${PORT}`);
});
