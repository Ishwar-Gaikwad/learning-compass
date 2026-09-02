import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const profileSchema = new mongoose.Schema({
  bio: {
    type: String,
    trim: true,
    maxlength: [500, 'Bio cannot exceed 500 characters']
  },
  avatarUrl: {
    type: String,
    trim: true
  },
  gradeLevel: {
    type: String,
    trim: true
  }
}, { _id: false });

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'User name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters long'],
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  email: {
    type: String,
    required: [true, 'Email address is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [emailRegex, 'Please provide a valid email address']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters long'],
    select: false
  },
  role: {
    type: String,
    required: [true, 'User role is required'],
    enum: {
      values: ['teacher', 'student', 'admin'],
      message: '{VALUE} is not a valid role'
    },
    default: 'student'
  },
  profile: {
    type: profileSchema,
    default: () => ({})
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Secondary index for role filtering
userSchema.index({ role: 1 });

// Secure password hashing pre-save hook (async without callback argument in Mongoose)
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
});

// Helper method for candidate password verification
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

export const User = mongoose.model('User', userSchema);
