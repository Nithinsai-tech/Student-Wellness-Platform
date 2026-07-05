const express = require('express');
const Mood = require('../models/Mood');
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

// Log mood
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      mood,
      intensity = 5,
      timeOfDay,
      activities,
      sleepHours,
      stressLevel,
      energyLevel,
      socialInteraction,
      academicPressure,
      notes,
      triggers,
      copingStrategies,
      effectiveness
    } = req.body;
    
    const moodEntry = new Mood({
      user: req.user.userId,
      mood,
      intensity,
      timeOfDay,
      activities: activities || [],
      sleepHours,
      stressLevel,
      energyLevel,
      socialInteraction,
      academicPressure,
      notes,
      triggers: triggers || [],
      copingStrategies: copingStrategies || [],
      effectiveness
    });
    
    await moodEntry.save();
    
    res.status(201).json({
      message: 'Mood logged successfully',
      moodEntry
    });
  } catch (error) {
    console.error('Log mood error:', error);
    res.status(500).json({ error: 'Failed to log mood' });
  }
});

// Get mood history
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    
    const moods = await Mood.find({
      user: req.user.userId,
      date: { $gte: startDate }
    }).sort({ date: -1 });
    
    res.json({ moods });
  } catch (error) {
    console.error('Get mood history error:', error);
    res.status(500).json({ error: 'Failed to fetch mood history' });
  }
});

// Get mood statistics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    const endDate = new Date();
    
    const stats = await Mood.getMoodStats(req.user.userId, startDate, endDate);
    const trends = await Mood.getMoodTrends(req.user.userId, parseInt(days));
    
    res.json({
      stats,
      trends,
      period: { startDate, endDate, days: parseInt(days) }
    });
  } catch (error) {
    console.error('Get mood stats error:', error);
    res.status(500).json({ error: 'Failed to fetch mood statistics' });
  }
});

// Get today's mood
router.get('/today', authenticateToken, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const todayMoods = await Mood.find({
      user: req.user.userId,
      date: { $gte: today, $lt: tomorrow }
    }).sort({ date: -1 });
    
    res.json({ todayMoods });
  } catch (error) {
    console.error('Get today mood error:', error);
    res.status(500).json({ error: 'Failed to fetch today\'s mood' });
  }
});

// Update mood entry
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const moodEntry = await Mood.findById(req.params.id);
    if (!moodEntry) {
      return res.status(404).json({ error: 'Mood entry not found' });
    }
    
    if (moodEntry.user.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const updateFields = req.body;
    Object.keys(updateFields).forEach(key => {
      if (key !== 'user' && key !== '_id') {
        moodEntry[key] = updateFields[key];
      }
    });
    
    await moodEntry.save();
    
    res.json({
      message: 'Mood entry updated successfully',
      moodEntry
    });
  } catch (error) {
    console.error('Update mood error:', error);
    res.status(500).json({ error: 'Failed to update mood entry' });
  }
});

// Delete mood entry
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const moodEntry = await Mood.findById(req.params.id);
    if (!moodEntry) {
      return res.status(404).json({ error: 'Mood entry not found' });
    }
    
    if (moodEntry.user.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    await Mood.findByIdAndDelete(req.params.id);
    
    res.json({ message: 'Mood entry deleted successfully' });
  } catch (error) {
    console.error('Delete mood error:', error);
    res.status(500).json({ error: 'Failed to delete mood entry' });
  }
});

module.exports = router; 