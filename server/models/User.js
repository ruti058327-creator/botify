const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
  fullName: {
    type: String
  },
  idNumber: {
    type: String
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  phone: {
    type: String
  },
  businessName: {
    type: String
  },
  username: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  profileImage: {
    type: String,
    default: ''
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  plan: {
    type: String,
    default: 'בסיסי'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.statics.comparePassword = function (candidatePassword, passwordHash) {
  return bcrypt.compare(candidatePassword, passwordHash);
};

userSchema.set('toJSON', {
  transform(document, returnedObject) {
    delete returnedObject.password;
    delete returnedObject.__v;
    return returnedObject;
  }
});

module.exports = mongoose.model('User', userSchema);