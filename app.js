/**
 * @fileoverview This file sets up an Express server with API versioning,
 * request parsing (JSON and URL-encoded), error handling, and dynamic route registration.
 * It includes detailed error logging and environment-specific behavior.
 *
 * @module server
 * @requires express
 * @requires dotenv
 * @requires http-errors
 * @requires ./environment
 * @requires ./api/versionManager
 */

const express = require('express');
// const bodyParser = require('body-parser');
const createError = require('http-errors');
const dotenv = require('dotenv');
dotenv.config(); // Load environment variables
const path = require('path');

// ======= LOG DIRECTORY SETUP =======
const fs = require('fs');
const logDir = path.join(__dirname, 'logs'); // ensures correct path regardless of working directory
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

/** 
 * Load custom environment configuration 
 * @const {Object}
 */
const env = require('./environment');

const app = express();

// Parse JSON bodies (for API clients)


// Parse URL-encoded bodies (for Twilio webhooks and forms)
app.use(express.json());
app.use(express.urlencoded({ extended: false })); // <--- REQUIRED
// app.use(bodyParser.json());
// app.use(bodyParser.urlencoded({ extended: true }));

// Optionally: log all requests in development
// console.log(process.env.NODE_ENV);

/**
 * Versioning middleware - dynamically loads API versions
 * @const {Function} getVersion - Loads a specific API version module
 * @const {Function} getLatestVersion - Loads the latest version module
 */
const { getVersion, getLatestVersion } = require('./api/versionManager');

// API Versioning
const API_VERSION = process.env.API_VERSION || 'v1';
app.use('/api', getVersion(API_VERSION));
app.use('/api/latest', getLatestVersion());
app.use('/api/v1', getVersion('v1'));

// 404 Route Handler
/**
 * Catch-all route for unmatched API endpoints.
 * Creates a 404 error and forwards it to the error handler.
 */
app.use((req, res, next) => {
    next(createError(404, 'Route Not found'));
});

// Error Handling Middleware
/**
 * Centralized error handler
 * @param {Error} err - Error object thrown
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {Function} next - Express next middleware function
 */
app.use((err, req, res, next) => {
    const statusCode = err.status || 500;

    const response = {
        success: false,
        status: statusCode,
        message: 'Internal server error',
        timestamp: new Date().toISOString()
    };

    // Log detailed error info
    console.error('Error Details:', {
        path: req.path,
        method: req.method,
        statusCode,
        errorName: err.name,
        errorMessage: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });

    // Customize error messages based on error type
    switch (err.name) {
        case 'MongooseError':
            response.message = 'Database connection error. Please try again later.';
            break;
        case 'JsonWebTokenError':
            response.status = 401;
            response.message = 'Invalid or expired token. Please log in again.';
            break;
        case 'ValidationError':
            response.status = 400;
            response.message = 'Validation failed';
            response.errors = err.errors;
            break;
        case 'CastError':
            response.status = 400;
            response.message = 'Invalid data format';
            break;
        case 'MongoServerError':
            if (err.code === 11000) {
                response.status = 409;
                response.message = 'Duplicate entry found';
            }
            break;
    }

    // Merge custom error details if available
    if (typeof err.message === 'object') {
        Object.assign(response, err.message);
    } else if (err.message) {
        response.message = err.message;
    }

    // Remove stack trace for production
    if (process.env.NODE_ENV !== 'development') {
        delete response.stack;
    }

    // Send error response
    res.status(response.status).json(response);
});

// Start the server
/**
 * Starts the server on the configured port
 * @listens port
 */
app.listen(env.port, () => {
    console.log(`Server running on port ${env.port}`);
});