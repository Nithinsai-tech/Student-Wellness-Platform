const mongoose = require('mongoose');

const resourceSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  content: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true,
    enum: [
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
    ]
  },
  type: {
    type: String,
    required: true,
    enum: ['article', 'video', 'guide', 'worksheet', 'meditation']
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  tags: [{
    type: String,
    trim: true
  }],
  mediaUrl: {
    type: String,
    default: ''
  },
  thumbnail: {
    type: String,
    default: ''
  },
  readingTime: {
    type: Number, // in minutes
    default: 5
  },
  difficulty: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced'],
    default: 'beginner'
  },
  isPublished: {
    type: Boolean,
    default: false
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  views: {
    type: Number,
    default: 0
  },
  likes: {
    type: Number,
    default: 0
  },
  bookmarks: {
    type: Number,
    default: 0
  },
  rating: {
    average: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    count: {
      type: Number,
      default: 0
    }
  },
  accessibility: {
    hasAudio: { type: Boolean, default: false },
    hasSubtitles: { type: Boolean, default: false },
    isScreenReaderFriendly: { type: Boolean, default: true }
  },
  targetAudience: {
    type: String,
    enum: ['all', 'undergraduate', 'graduate', 'international', 'first-year'],
    default: 'all'
  }
}, {
  timestamps: true
});

// Index for search functionality
resourceSchema.index({
  title: 'text',
  description: 'text',
  content: 'text',
  tags: 'text'
});

// Virtual for full URL
resourceSchema.virtual('fullMediaUrl').get(function() {
  if (this.mediaUrl && !this.mediaUrl.startsWith('http')) {
    return `${process.env.BASE_URL || 'http://localhost:3000'}/uploads/${this.mediaUrl}`;
  }
  return this.mediaUrl;
});

module.exports = mongoose.model('Resource', resourceSchema); 