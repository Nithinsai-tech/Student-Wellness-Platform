const express = require('express');
const Journal = require('../models/Journal');
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

// Get public journal entries (feelings wall)
router.get('/public', async (req, res) => {
  try {
    const { page = 1, limit = 20, mood, category } = req.query;
    const skip = (page - 1) * limit;
    
    const query = { 
      isPublic: true, 
      isModerated: false,
      moderationAction: { $ne: 'deleted' }
    };
    
    if (mood) query.mood = mood;
    if (category) query.category = category;
    
    const entries = await Journal.find(query)
      .populate('author', 'firstName lastName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Journal.countDocuments(query);
    
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
    console.error('Get public entries error:', error);
    res.status(500).json({ error: 'Failed to fetch entries' });
  }
});

// Get user's own journal entries
router.get('/my-entries', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;
    
    const entries = await Journal.find({ author: req.user.userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Journal.countDocuments({ author: req.user.userId });
    
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
    console.error('Get my entries error:', error);
    res.status(500).json({ error: 'Failed to fetch entries' });
  }
});

// Create new journal entry
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      content,
      mood,
      isAnonymous = true,
      isPublic = true,
      tags,
      category = 'general',
      activities,
      sleepHours,
      stressLevel,
      triggers,
      copingStrategies,
      effectiveness
    } = req.body;
    
    // AI Analysis (simple sentiment analysis)
    const aiAnalysis = analyzeSentiment(content);
    
    const entry = new Journal({
      author: req.user.userId,
      content,
      mood,
      isAnonymous,
      isPublic,
      tags: tags || [],
      category,
      activities: activities || [],
      sleepHours,
      stressLevel,
      triggers: triggers || [],
      copingStrategies: copingStrategies || [],
      effectiveness,
      aiAnalysis
    });
    
    await entry.save();
    
    res.status(201).json({
      message: 'Journal entry created successfully',
      entry
    });
  } catch (error) {
    console.error('Create entry error:', error);
    res.status(500).json({ error: 'Failed to create entry' });
  }
});

// Get specific journal entry
router.get('/:id', async (req, res) => {
  try {
    const entry = await Journal.findById(req.params.id)
      .populate('author', 'firstName lastName')
      .populate('reactions.user', 'firstName lastName')
      .populate('comments.user', 'firstName lastName');
    
    if (!entry) {
      return res.status(404).json({ error: 'Entry not found' });
    }
    
    res.json({ entry });
  } catch (error) {
    console.error('Get entry error:', error);
    res.status(500).json({ error: 'Failed to fetch entry' });
  }
});

// Update journal entry
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const entry = await Journal.findById(req.params.id);
    if (!entry) {
      return res.status(404).json({ error: 'Entry not found' });
    }
    
    // Only author can edit
    if (entry.author.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const updateFields = req.body;
    Object.keys(updateFields).forEach(key => {
      if (key !== 'author' && key !== '_id' && key !== 'reactions' && key !== 'comments') {
        entry[key] = updateFields[key];
      }
    });
    
    // Re-analyze sentiment if content changed
    if (updateFields.content) {
      entry.aiAnalysis = analyzeSentiment(updateFields.content);
    }
    
    await entry.save();
    
    res.json({
      message: 'Entry updated successfully',
      entry
    });
  } catch (error) {
    console.error('Update entry error:', error);
    res.status(500).json({ error: 'Failed to update entry' });
  }
});

// Delete journal entry
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const entry = await Journal.findById(req.params.id);
    if (!entry) {
      return res.status(404).json({ error: 'Entry not found' });
    }
    
    // Only author can delete
    if (entry.author.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    await Journal.findByIdAndDelete(req.params.id);
    
    res.json({ message: 'Entry deleted successfully' });
  } catch (error) {
    console.error('Delete entry error:', error);
    res.status(500).json({ error: 'Failed to delete entry' });
  }
});

// Add reaction to entry
router.post('/:id/react', authenticateToken, async (req, res) => {
  try {
    const { type } = req.body;
    
    const entry = await Journal.findById(req.params.id);
    if (!entry) {
      return res.status(404).json({ error: 'Entry not found' });
    }
    
    // Check if user already reacted
    const existingReaction = entry.reactions.find(
      r => r.user.toString() === req.user.userId
    );
    
    if (existingReaction) {
      // Update existing reaction
      existingReaction.type = type;
      existingReaction.createdAt = new Date();
    } else {
      // Add new reaction
      entry.reactions.push({
        user: req.user.userId,
        type,
        createdAt: new Date()
      });
    }
    
    await entry.save();
    
    res.json({
      message: 'Reaction added successfully',
      reactions: entry.reactions
    });
  } catch (error) {
    console.error('Add reaction error:', error);
    res.status(500).json({ error: 'Failed to add reaction' });
  }
});

// Add comment to entry
router.post('/:id/comment', authenticateToken, async (req, res) => {
  try {
    const { content, isAnonymous = true } = req.body;
    
    const entry = await Journal.findById(req.params.id);
    if (!entry) {
      return res.status(404).json({ error: 'Entry not found' });
    }
    
    entry.comments.push({
      user: req.user.userId,
      content,
      isAnonymous,
      createdAt: new Date()
    });
    
    await entry.save();
    
    res.json({
      message: 'Comment added successfully',
      comments: entry.comments
    });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

// Flag entry
router.post('/:id/flag', authenticateToken, async (req, res) => {
  try {
    const { reason } = req.body;
    
    const entry = await Journal.findById(req.params.id);
    if (!entry) {
      return res.status(404).json({ error: 'Entry not found' });
    }
    
    // Check if user already flagged
    const existingFlag = entry.flaggedBy.find(
      f => f.user.toString() === req.user.userId
    );
    
    if (existingFlag) {
      return res.status(400).json({ error: 'Entry already flagged by you' });
    }
    
    entry.flaggedBy.push({
      user: req.user.userId,
      reason,
      createdAt: new Date()
    });
    
    // Mark as flagged if enough flags
    if (entry.flaggedBy.length >= 3) {
      entry.isFlagged = true;
      entry.flagReason = reason;
    }
    
    await entry.save();
    
    res.json({ message: 'Entry flagged successfully' });
  } catch (error) {
    console.error('Flag entry error:', error);
    res.status(500).json({ error: 'Failed to flag entry' });
  }
});

// Get journal statistics
router.get('/stats/overview', authenticateToken, async (req, res) => {
  try {
    const stats = await Journal.aggregate([
      { $match: { author: require('mongoose').Types.ObjectId(req.user.userId) } },
      {
        $group: {
          _id: '$mood',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);
    
    const totalEntries = await Journal.countDocuments({ author: req.user.userId });
    const publicEntries = await Journal.countDocuments({ 
      author: req.user.userId, 
      isPublic: true 
    });
    
    res.json({
      moodStats: stats,
      totalEntries,
      publicEntries,
      privateEntries: totalEntries - publicEntries
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Simple sentiment analysis function
function analyzeSentiment(content) {
  const positiveWords = ['happy', 'good', 'great', 'excellent', 'wonderful', 'amazing', 'love', 'joy', 'excited', 'grateful'];
  const negativeWords = ['sad', 'bad', 'terrible', 'awful', 'hate', 'angry', 'depressed', 'anxious', 'stressed', 'hopeless'];
  const crisisWords = ['suicide', 'kill myself', 'end it all', 'no reason to live', 'better off dead'];
  
  const lowerContent = content.toLowerCase();
  let positiveCount = 0;
  let negativeCount = 0;
  let crisisCount = 0;
  
  positiveWords.forEach(word => {
    if (lowerContent.includes(word)) positiveCount++;
  });
  
  negativeWords.forEach(word => {
    if (lowerContent.includes(word)) negativeCount++;
  });
  
  crisisWords.forEach(word => {
    if (lowerContent.includes(word)) crisisCount++;
  });
  
  let sentiment = 'neutral';
  if (positiveCount > negativeCount) sentiment = 'positive';
  else if (negativeCount > positiveCount) sentiment = 'negative';
  
  let riskScore = 0;
  if (crisisCount > 0) riskScore = 90;
  else if (negativeCount > positiveCount * 2) riskScore = 70;
  else if (negativeCount > positiveCount) riskScore = 40;
  
  const suggestions = [];
  if (crisisCount > 0) {
    suggestions.push('Please reach out to a mental health professional immediately');
    suggestions.push('Call a crisis helpline for immediate support');
  } else if (riskScore > 50) {
    suggestions.push('Consider talking to a counselor or trusted friend');
    suggestions.push('Try some self-care activities');
  }
  
  return {
    sentiment,
    keywords: [...new Set([...positiveWords.filter(w => lowerContent.includes(w)), ...negativeWords.filter(w => lowerContent.includes(w))])],
    riskScore,
    suggestions
  };
}

module.exports = router; 