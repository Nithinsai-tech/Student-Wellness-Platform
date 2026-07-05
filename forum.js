const express = require('express');
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

// Get all forum topics
router.get('/topics', async (req, res) => {
  try {
    // Placeholder for forum topics
    const topics = [
      {
        id: 1,
        title: 'Coping with Exam Stress',
        category: 'academic',
        author: 'Anonymous Student',
        replies: 15,
        views: 120,
        lastActivity: new Date(),
        isPinned: true
      },
      {
        id: 2,
        title: 'Building Healthy Relationships',
        category: 'relationships',
        author: 'Anonymous Student',
        replies: 8,
        views: 85,
        lastActivity: new Date(),
        isPinned: false
      }
    ];
    
    res.json({ topics });
  } catch (error) {
    console.error('Get topics error:', error);
    res.status(500).json({ error: 'Failed to fetch topics' });
  }
});

// Create new topic
router.post('/topics', authenticateToken, async (req, res) => {
  try {
    const { title, content, category } = req.body;
    
    // Placeholder for creating topic
    const topic = {
      id: Date.now(),
      title,
      content,
      category,
      author: 'Anonymous Student',
      replies: 0,
      views: 0,
      lastActivity: new Date(),
      isPinned: false
    };
    
    res.status(201).json({
      message: 'Topic created successfully',
      topic
    });
  } catch (error) {
    console.error('Create topic error:', error);
    res.status(500).json({ error: 'Failed to create topic' });
  }
});

module.exports = router; 