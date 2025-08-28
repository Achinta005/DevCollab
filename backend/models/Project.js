const mongoose = require("mongoose");

const ProjectSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    collaborators: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        role: {
            type: String,
            enum: ['owner', 'editor', 'viewer', 'commenter'],
            default: 'viewer'
        },
        permissions: [{
            type: String,
            enum: ['read', 'write', 'delete', 'manage_collaborators', 'manage_settings']
        }],
        joinedAt: { type: Date, default: Date.now }
    }],
    files: [{
        path: { type: String },
        content: { type: String, default: '' },
        language: { type: String, default: 'javascript' },
        lastModified: { type: Date, default: Date.now },
        modifiedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }
    }],
    settings: {
        visibility: {
            type: String,
            enum: ['private', 'public', 'unlisted'],
            default: 'private'
        },
        allowedLanguages: [{ type: String }],
        maxCollaborators: { type: Number, default: 10 }
    },
    inviteCode: { type: String, unique: true, sparse: true }, // For joining via code
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, {
    timestamps: true
});

// Indexes
ProjectSchema.index({ owner: 1 });
ProjectSchema.index({ 'collaborators.user': 1 });
ProjectSchema.index({ inviteCode: 1 });
ProjectSchema.index({ name: 'text', description: 'text' });

// Generate unique invite code
ProjectSchema.methods.generateInviteCode = function() {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    this.inviteCode = code;
    return code;
};

module.exports = mongoose.model('Project', ProjectSchema);