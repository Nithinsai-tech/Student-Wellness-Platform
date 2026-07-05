const express = require('express');
const Resource = require('../models/Resource');
const User = require('../models/User');
const router = express.Router();

// Middleware to check authentication
const authenticateToken = (req, res, next) => {
  const token = req.session.token || req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  const jwt = require('jsonwebtoken');
  jwt.verify(token, process.env.JWT_SECRET || 'mental-health-secret', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Get all published resources
router.get('/', async (req, res) => {
  try {
    const { category, type, search, page = 1, limit = 10 } = req.query;
    
    const query = { isPublished: true };
    
    if (category) query.category = category;
    if (type) query.type = type;
    if (search) {
      query.$text = { $search: search };
    }
    
    const skip = (page - 1) * limit;
    
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
    console.error('Get resources error:', error);
    res.status(500).json({ error: 'Failed to fetch resources' });
  }
});

// Get featured resources
router.get('/featured', async (req, res) => {
  try {
    const resources = await Resource.find({ 
      isPublished: true, 
      isFeatured: true 
    })
    .populate('author', 'firstName lastName')
    .sort({ createdAt: -1 })
    .limit(6);
    
    res.json({ resources });
  } catch (error) {
    console.error('Get featured resources error:', error);
    res.status(500).json({ error: 'Failed to fetch featured resources' });
  }
});

// Get resource by ID
router.get('/:id', async (req, res) => {
  try {
    const resource = await Resource.findById(req.params.id)
      .populate('author', 'firstName lastName');
    
    if (!resource) {
      return res.status(404).json({ error: 'Resource not found' });
    }
    
    // Increment views
    resource.views += 1;
    await resource.save();
    
    res.json({ resource });
  } catch (error) {
    console.error('Get resource error:', error);
    res.status(500).json({ error: 'Failed to fetch resource' });
  }
});

// Create new resource (admin/counselor only)
router.post('/', authenticateToken, async (req, res) => {
  try {
    if (!['admin', 'counselor'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const {
      title,
      description,
      content,
      category,
      type,
      tags,
      mediaUrl,
      thumbnail,
      readingTime,
      difficulty,
      targetAudience,
      accessibility
    } = req.body;
    
    const resource = new Resource({
      title,
      description,
      content,
      category,
      type,
      author: req.user.userId,
      tags: tags || [],
      mediaUrl: mediaUrl || '',
      thumbnail: thumbnail || '',
      readingTime: readingTime || 5,
      difficulty: difficulty || 'beginner',
      targetAudience: targetAudience || 'all',
      accessibility: accessibility || {
        hasAudio: false,
        hasSubtitles: false,
        isScreenReaderFriendly: true
      }
    });
    
    await resource.save();
    
    res.status(201).json({
      message: 'Resource created successfully',
      resource
    });
  } catch (error) {
    console.error('Create resource error:', error);
    res.status(500).json({ error: 'Failed to create resource' });
  }
});

// Update resource (admin/counselor only)
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    if (!['admin', 'counselor'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const resource = await Resource.findById(req.params.id);
    if (!resource) {
      return res.status(404).json({ error: 'Resource not found' });
    }
    
    // Only author or admin can edit
    if (resource.author.toString() !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const updateFields = req.body;
    Object.keys(updateFields).forEach(key => {
      if (key !== 'author' && key !== '_id') {
        resource[key] = updateFields[key];
      }
    });
    
    await resource.save();
    
    res.json({
      message: 'Resource updated successfully',
      resource
    });
  } catch (error) {
    console.error('Update resource error:', error);
    res.status(500).json({ error: 'Failed to update resource' });
  }
});

// Delete resource (admin/counselor only)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    if (!['admin', 'counselor'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const resource = await Resource.findById(req.params.id);
    if (!resource) {
      return res.status(404).json({ error: 'Resource not found' });
    }
    
    // Only author or admin can delete
    if (resource.author.toString() !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    await Resource.findByIdAndDelete(req.params.id);
    
    res.json({ message: 'Resource deleted successfully' });
  } catch (error) {
    console.error('Delete resource error:', error);
    res.status(500).json({ error: 'Failed to delete resource' });
  }
});

// Like/unlike resource
router.post('/:id/like', authenticateToken, async (req, res) => {
  try {
    const resource = await Resource.findById(req.params.id);
    if (!resource) {
      return res.status(404).json({ error: 'Resource not found' });
    }
    
    // Simple like increment (in a real app, you'd track individual likes)
    resource.likes += 1;
    await resource.save();
    
    res.json({ message: 'Resource liked', likes: resource.likes });
  } catch (error) {
    console.error('Like resource error:', error);
    res.status(500).json({ error: 'Failed to like resource' });
  }
});

// Get resource categories
router.get('/categories/list', async (req, res) => {
  try {
    const categories = [
      'stress-management',
      'anxiety',
      'depression',
      'motivation',
      'mindfulness',
      'study-skills',
      'relationships',
      'self-care',
      'crisis-support',
      'general-wellness'
    ];
    
    res.json({ categories });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Get resources by category
router.get('/category/:category', async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;
    
    const resources = await Resource.find({
      category: req.params.category,
      isPublished: true
    })
    .populate('author', 'firstName lastName')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));
    
    const total = await Resource.countDocuments({
      category: req.params.category,
      isPublished: true
    });
    
    res.json({
      resources,
      category: req.params.category,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        hasNext: skip + resources.length < total,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Get resources by category error:', error);
    res.status(500).json({ error: 'Failed to fetch resources' });
  }
});

module.exports = router; 