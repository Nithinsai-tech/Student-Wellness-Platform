const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware to authenticate JWT token
const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

        if (!token) {
            return res.status(401).json({ message: 'Access token required' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
        const user = await User.findById(decoded.userId).select('-password');
        
        if (!user) {
            return res.status(401).json({ message: 'Invalid token' });
        }

        req.user = user;
        next();
    } catch (error) {
        return res.status(403).json({ message: 'Invalid token' });
    }
};

// Middleware to check if user is admin
const authenticateAdmin = async (req, res, next) => {
    try {
        await authenticateToken(req, res, () => {});
        
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Admin access required' });
        }
        
        next();
    } catch (error) {
        return res.status(403).json({ message: 'Access denied' });
    }
};

// Middleware to check if user is counselor or admin
const authenticateCounselor = async (req, res, next) => {
    try {
        await authenticateToken(req, res, () => {});
        
        if (req.user.role !== 'counselor' && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Counselor or admin access required' });
        }
        
        next();
    } catch (error) {
        return res.status(403).json({ message: 'Access denied' });
    }
};

// Middleware to check if user is authenticated (session-based)
const requireAuth = (req, res, next) => {
    if (req.session && req.session.userId) {
        return next();
    }
    return res.status(401).json({ message: 'Authentication required' });
};

// Middleware to check if user is admin (session-based)
const requireAdmin = (req, res, next) => {
    if (req.session && req.session.userId && req.session.role === 'admin') {
        return next();
    }
    return res.status(403).json({ message: 'Admin access required' });
};

module.exports = {
    authenticateToken,
    authenticateAdmin,
    authenticateCounselor,
    requireAuth,
    requireAdmin
}; 