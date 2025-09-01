const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    firstname: { type: String, required: true },
    lastname: { type: String },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    profile: {
        avatar: { type: String },
        cloudinaryPublicId: { type: String }, // Cloudinary management
        bio: { type: String },
        skills: { type: String },
        experience: { type: String },
        github: { type: String },
        portfolio: { type: String },
        linkedin: { type: String },
    },
    preferences: {
        theme: { type: String, default: 'light' },
        notification: { type: Object, default: {} }
    },
    createdAt: { type: Date, default: Date.now },
    LastActive: { type: Date, default: Date.now }
}, {
    timestamps: true
});

// Virtual for full name
UserSchema.virtual('fullName').get(function() {
    return `${this.firstname || ''} ${this.lastname || ''}`.trim();
});

// Method to get public user data (excludes password)
UserSchema.methods.getPublicData = function() {
    return {
        id: this._id,
        username: this.username,
        firstname: this.firstname,
        lastname: this.lastname,
        fullName: this.fullName,
        email: this.email,
        profile: this.profile || {},
        preferences: this.preferences || {},
        createdAt: this.createdAt,
        LastActive: this.LastActive,
        updatedAt: this.updatedAt
    };
};

// Method to get minimal profile data (for public display)
UserSchema.methods.getMinimalProfile = function() {
    return {
        id: this._id,
        username: this.username,
        firstname: this.firstname,
        lastname: this.lastname,
        fullName: this.fullName,
        avatar: this.profile ? this.profile.avatar : null,
        bio: this.profile ? this.profile.bio : null
    };
};

// Method to update last active timestamp
UserSchema.methods.updateLastActive = function() {
    this.LastActive = new Date();
    return this.save();
};

// Static method to find user by username or email
UserSchema.statics.findByUsernameOrEmail = function(identifier) {
    return this.findOne({
        $or: [
            { username: identifier },
            { email: identifier }
        ]
    });
};

// Pre-save hook to hash password ONLY if it's not already hashed
UserSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    
    // Skip hashing if password is already hashed
    if (this.password.startsWith('$2b$')) return next();
    
    try {
        const hashedPassword = await bcrypt.hash(this.password, 12);
        this.password = hashedPassword;
        next();
    } catch (error) {
        next(error);
    }
});

// Method to check password
UserSchema.methods.comparePassword = async function(candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

// Pre-save hook to update LastActive on any save
UserSchema.pre('save', function(next) {
    if (!this.isNew && !this.isModified('LastActive')) {
        this.LastActive = new Date();
    }
    next();
});

// Ensure virtual fields are serialized
UserSchema.set('toJSON', {
    virtuals: true,
    transform: function(doc, ret) {
        delete ret.password;
        delete ret.__v;
        return ret;
    }
});

const User = mongoose.model("User", UserSchema);
module.exports = User;