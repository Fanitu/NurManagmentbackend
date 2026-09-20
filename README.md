🍽️ Restaurant Management System — Backend

A RESTful backend for a restaurant management system, built with Node.js, Express.js, MongoDB, and Mongoose.

The backend provides authenticated APIs for managing restaurant orders, order-list/menu data, running costs, monthly expenses, administrative operations, and user access.

🚀 Overview

This project is the backend/API layer of a full-stack Restaurant Management System.

It is designed around a modular Express architecture with separate:

- Routes
- Controllers
- Models
- Middleware
- Configuration
- Utility functions

The API uses JWT-based authentication and role-based authorization to protect restaurant management operations.

✨ Core Capabilities

🔐 Authentication & Authorization

- JWT-based authentication
- Protected API routes
- Role-based authorization
- Admin-only operations where required
- Password hashing with "bcryptjs"
- User existence verification during authentication
- Token expiry and signature verification

📦 Order Management

The API supports the restaurant order workflow, including:

- Creating orders
- Retrieving today's orders
- Retrieving all orders for authorized administrators
- Updating orders
- Deleting orders
- Request validation
- Order-specific rate limiting

The order routes use authentication middleware and validation before reaching the controllers.

📋 Order List Management

The backend provides protected operations for managing order-list data:

- Retrieve order-list items
- Create items
- Update items
- Delete items
- Admin-only modification of order-list data
- Input validation

💰 Running Cost Management

The API supports:

- Creating running-cost records
- Retrieving running costs
- Protected access
- Input validation
- Admin authorization for retrieving all running costs

📊 Expense & Administrative Operations

The backend includes dedicated route modules for administrative and monthly-expense functionality, keeping these responsibilities separated from the order APIs.

🏗️ Backend Architecture

NurManagmentbackend/
│
├── config/
│   └── Database / application configuration
│
├── controllers/
│   └── Business logic
│
├── middleware/
│   ├── auth.js
│   ├── security.js
│   └── validate.js
│
├── models/
│   └── Mongoose data models
│
├── routes/
│   ├── authRoutes.js
│   ├── orderRoutes.js
│   ├── orderListRoutes.js
│   ├── runningCostRoutes.js
│   ├── monthlyExpenseRoutes.js
│   └── adminRoutes.js
│
├── utils/
│   └── Utility functions
│
├── seedAdmin.js
├── server.js
├── package.json
└── README.md

The repository currently follows this separated route/controller/model/middleware structure.

🛠️ Technology Stack

Backend

- Node.js
- Express.js
- MongoDB
- Mongoose
- JWT
- bcryptjs
- dotenv

Security

- Helmet
- express-rate-limit
- express-mongo-sanitize
- express-validator
- xss-clean
- hpp
- CORS

Development

- Nodemon

These dependencies are currently defined in the project's "package.json".

🛡️ Security & Production Hardening

Security was treated as a dedicated layer of the application rather than relying only on authentication.

Helmet

Adds security-related HTTP headers to responses to help protect against common browser-based attacks.

Rate Limiting

Different limits are applied to different operations:

- Login: 10 failed attempts per 15 minutes per IP
- Order submission: 60 requests per minute per IP
- General requests: 200 requests per minute per IP

MongoDB Injection Protection

Request data is sanitized to prevent malicious MongoDB operators such as "$gt" from being injected into authentication or database queries.

XSS Protection

String inputs are sanitized to reduce the risk of storing executable HTML or JavaScript in application data.

HTTP Parameter Pollution Protection

Duplicate query parameters are handled consistently to prevent parameter-pollution abuse.

Request Size Limiting

JSON request bodies are limited to 10 KB to reduce the risk of unnecessarily large payloads consuming server resources.

Input Validation

The application validates incoming data including:

- Required fields
- String lengths
- Numeric ranges
- MongoDB ObjectIds
- Date formats
- Supported Ethiopian/Amharic characters in applicable name fields

Hardened Authentication

Authentication includes:

1. JWT signature verification
2. Token expiry checking
3. Database verification that the user still exists
4. Case-insensitive role checking
5. Generic authentication errors that avoid exposing user existence

CORS Hardening

The backend uses an explicitly configured client origin instead of falling back to a wildcard origin.

Production Error Handling

In production, clients receive generic error responses while detailed stack traces remain on the server side.

🧪 Security Testing

The project includes manual security tests for:

- Login rate limiting
- MongoDB injection attempts
- XSS payload sanitization
- Oversized request payloads

Example:

curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"name":"admin","password":{"$gt":""}}'

The expected behavior is validation/rejection rather than successful authentication.

⚙️ Getting Started

1. Clone the repository

git clone https://github.com/Fanitu/NurManagmentbackend.git
cd NurManagmentbackend

2. Install dependencies

npm install

3. Configure environment variables

Create a ".env" file locally.

Do not commit production secrets.

Typical configuration includes:

NODE_ENV=development
CLIENT_ORIGIN=http://localhost:5173

Add the database and authentication configuration required by the application.

4. Start development server

npm run dev

5. Start production server

npm start

The available "dev" and "start" scripts are defined in "package.json".

🔗 Related Frontend

Frontend repository:

https://github.com/Fanitu/NurManagmentFrontend

Live frontend:

https://nur-managment-frontend.vercel.app/

The frontend repository is a React/Vite application and is deployed through Vercel.

💡 Engineering Highlights

This project demonstrates practical backend engineering including:

- REST API design
- MVC-style separation of responsibilities
- JWT authentication
- Role-based authorization
- MongoDB/Mongoose data management
- Input validation
- API security hardening
- Rate limiting
- CORS configuration
- Error handling
- Environment-based configuration
- Modular route/controller organization

📌 Project Status

This backend is part of a full-stack Restaurant Management System.

For portfolio purposes, the repository demonstrates the backend architecture and security practices used to build a production-oriented business application.

👨‍💻 Author

Fanuel Bahta

Full-Stack Web Developer

GitHub: https://github.com/Fanitu