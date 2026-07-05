const express = require('express');
const User = require('../models/User');
const Resource = require('../models/Resource');
const Journal = require('../models/Journal');
const Mood = require('../models/Mood');
const router = express.Router();

// Middleware to check admin authentication
const authenticateAdmin = (req, res, next) => {
  const token = req.session.token || req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  const jwt = require('jsonwebtoken');
  jwt.verify(token, process.env.JWT_SECRET || 'mental-health-secret', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    req.user = user;
    next();
  });
};

// Get all users (admin only)
router.get('/users', authenticateAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, role, search } = req.query;
    const skip = (page - 1) * limit;
    
    const query = {};
    if (role) query.role = role;
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } }
      ];
    }
    
    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await User.countDocuments(query);
    
    res.json({
      users,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        hasNext: skip + users.length < total,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get user by ID (admin only)
router.get('/users/:id', authenticateAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Update user (admin only)
router.put('/users/:id', authenticateAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const updateFields = req.body;
    Object.keys(updateFields).forEach(key => {
      if (key !== 'password' && key !== '_id') {
        user[key] = updateFields[key];
      }
    });
    
    await user.save();
    
    res.json({
      message: 'User updated successfully',
      user: user.toJSON()
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete user (admin only)
router.delete('/users/:id', authenticateAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    await User.findByIdAndDelete(req.params.id);
    
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Get flagged journal entries (admin only)
router.get('/flagged-entries', authenticateAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;
    
    const entries = await Journal.find({ isFlagged: true })
      .populate('author', 'firstName lastName email')
      .populate('flaggedBy.user', 'firstName lastName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Journal.countDocuments({ isFlagged: true });
    
    res.json({
      entries,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        hasNext: skip + entries.length < total,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Get flagged entries error:', error);
    res.status(500).json({ error: 'Failed to fetch flagged entries' });
  }
});

// Moderate journal entry (admin only)
router.put('/moderate-entry/:id', authenticateAdmin, async (req, res) => {
  try {
    const { action, reason } = req.body;
    
    const entry = await Journal.findById(req.params.id);
    if (!entry) {
      return res.status(404).json({ error: 'Entry not found' });
    }
    
    entry.isModerated = true;
    entry.moderatedBy = req.user.userId;
    entry.moderationAction = action;
    
    if (action === 'deleted') {
      await Journal.findByIdAndDelete(req.params.id);
      return res.json({ message: 'Entry deleted successfully' });
    }
    
    await entry.save();
    
    res.json({
      message: 'Entry moderated successfully',
      entry
    });
  } catch (error) {
    console.error('Moderate entry error:', error);
    res.status(500).json({ error: 'Failed to moderate entry' });
  }
});

// Get platform statistics (admin only)
router.get('/stats', authenticateAdmin, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalStudents = await User.countDocuments({ role: 'student' });
    const totalCounselors = await User.countDocuments({ role: 'counselor' });
    const totalResources = await Resource.countDocuments();
    const totalJournalEntries = await Journal.countDocuments();
    const totalMoodEntries = await Mood.countDocuments();
    
    // Recent activity
    const recentUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('firstName lastName email role createdAt');
    
    const recentEntries = await Journal.find()
      .populate('author', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(5);
    
    // Mood trends
    const moodStats = await Mood.aggregate([
      {
        $group: {
          _id: '$mood',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);
    
    res.json({
      overview: {
        totalUsers,
        totalStudents,
        totalCounselors,
        totalResources,
        totalJournalEntries,
        totalMoodEntries
      },
      recentActivity: {
        users: recentUsers,
        entries: recentEntries
      },
      moodStats
    });
  } catch (error) {
    console.error('Get admin stats error:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Get resource management data (admin only)
router.get('/resources/manage', authenticateAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const skip = (page - 1) * limit;
    
    const query = {};
    if (status === 'published') query.isPublished = true;
    else if (status === 'draft') query.isPublished = false;
    
    const resources = await Resource.find(query)
      .populate('author', 'firstName lastName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Resource.countDocuments(query);
    
    res.json({
      resources,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        hasNext: skip + resources.length < total,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Get resources manage error:', error);
    res.status(500).json({ error: 'Failed to fetch resources' });
  }
});

// Publish/unpublish resource (admin only)
router.put('/resources/:id/publish', authenticateAdmin, async (req, res) => {
  try {
    const { isPublished } = req.body;
    
    const resource = await Resource.findById(req.params.id);
    if (!resource) {
      return res.status(404).json({ error: 'Resource not found' });
    }
    
    resource.isPublished = isPublished;
    await resource.save();
    
    res.json({
      message: `Resource ${isPublished ? 'published' : 'unpublished'} successfully`,
      resource
    });
  } catch (error) {
    console.error('Publish resource error:', error);
    res.status(500).json({ error: 'Failed to update resource status' });
  }
});

// Feature/unfeature resource (admin only)
router.put('/resources/:id/feature', authenticateAdmin, async (req, res) => {
  try {
    const { isFeatured } = req.body;
    
    const resource = await Resource.findById(req.params.id);
    if (!resource) {
      return res.status(404).json({ error: 'Resource not found' });
    }
    
    resource.isFeatured = isFeatured;
    await resource.save();
    
    res.json({
      message: `Resource ${isFeatured ? 'featured' : 'unfeatured'} successfully`,
      resource
    });
  } catch (error) {
    console.error('Feature resource error:', error);
    res.status(500).json({ error: 'Failed to update resource feature status' });
  }
});

module.exports = router; 