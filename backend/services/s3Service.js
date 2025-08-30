const { 
    S3Client, 
    PutObjectCommand, 
    GetObjectCommand, 
    DeleteObjectCommand,
    HeadObjectCommand 
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

class S3Service {
    constructor() {
        this.s3Client = new S3Client({
           region: process.env.AWS_REGION || "eu-north-1", // fallback
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
            },
            endpoint: "https://s3.eu-north-1.amazonaws.com" // optional, ensures no redirect
        });
        
        this.bucketName = process.env.S3_BUCKET_NAME;
        
        if (!this.bucketName) {
            throw new Error('S3_BUCKET_NAME environment variable is required');
        }
    }

    // Generate organized S3 key path
    generateS3Key(userId, projectId, originalFileName) {
        const fileExtension = path.extname(originalFileName);
        const uniqueId = uuidv4();
        const timestamp = Date.now();
        
        // Create organized folder structure: users/userId/projects/projectId/files/uniqueId_timestamp.ext
        return `users/${userId}/projects/${projectId}/files/${uniqueId}_${timestamp}${fileExtension}`;
    }

    // Upload file to S3
    async uploadFile(fileBuffer, s3Key, mimeType, metadata = {}) {
        try {
            const command = new PutObjectCommand({
                Bucket: this.bucketName,
                Key: s3Key,
                Body: fileBuffer,
                ContentType: mimeType,
                Metadata: {
                    uploadedAt: new Date().toISOString(),
                    ...metadata
                }
            });

            const result = await this.s3Client.send(command);
            
            return {
                success: true,
                s3Key,
                etag: result.ETag,
                location: `https://${this.bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`
            };
        } catch (error) {
            console.error('S3 upload error:', error);
            throw new Error(`Failed to upload file to S3: ${error.message}`);
        }
    }

    // Generate signed download URL
    async getDownloadUrl(s3Key, expiresIn = 3600) {
        try {
            const command = new GetObjectCommand({
                Bucket: this.bucketName,
                Key: s3Key
            });

            return await getSignedUrl(this.s3Client, command, { expiresIn });
        } catch (error) {
            console.error('Error generating download URL:', error);
            throw new Error(`Failed to generate download URL: ${error.message}`);
        }
    }

    // Delete file from S3
    async deleteFile(s3Key) {
        try {
            const command = new DeleteObjectCommand({
                Bucket: this.bucketName,
                Key: s3Key
            });

            await this.s3Client.send(command);
            return { success: true };
        } catch (error) {
            console.error('S3 delete error:', error);
            // Don't throw error if file doesn't exist
            if (error.name === 'NoSuchKey') {
                return { success: true, message: 'File already deleted' };
            }
            throw new Error(`Failed to delete file from S3: ${error.message}`);
        }
    }

    // Check if file exists
    async fileExists(s3Key) {
        try {
            const command = new HeadObjectCommand({
                Bucket: this.bucketName,
                Key: s3Key
            });

            await this.s3Client.send(command);
            return true;
        } catch (error) {
            if (error.name === 'NotFound' || error.name === 'NoSuchKey') {
                return false;
            }
            throw error;
        }
    }

    // Validate file before upload
    validateFile(file, maxSizeBytes = null) {
        const maxSize = maxSizeBytes || (parseInt(process.env.MAX_FILE_SIZE_MB) || 50) * 1024 * 1024;
        
        // Check file size
        if (file.size > maxSize) {
            throw new Error(`File size (${this.formatFileSize(file.size)}) exceeds maximum allowed size (${this.formatFileSize(maxSize)})`);
        }

        // Allowed file types
        const allowedMimeTypes = [
            // Images
            'image/jpeg', 'image/png', 'image/gif', 'image/svg+xml', 'image/webp',
            // Documents
            'application/pdf', 'text/plain', 
            'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            // Code files
            'text/javascript', 'application/javascript', 'text/html', 'text/css',
            'application/json', 'text/xml', 'application/xml',
            // Archives
            'application/zip', 'application/x-rar-compressed'
        ];

        // Check MIME type
        if (!allowedMimeTypes.includes(file.mimetype)) {
            throw new Error(`File type '${file.mimetype}' is not allowed`);
        }

        return true;
    }

    // Format file size for display
    formatFileSize(bytes) {
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        if (bytes === 0) return '0 Bytes';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }

    // Get MIME type category
    getMimeTypeCategory(mimeType) {
        if (mimeType.startsWith('image/')) return 'image';
        if (mimeType.includes('pdf') || 
            mimeType.includes('document') || 
            mimeType.includes('text') ||
            mimeType.includes('spreadsheet') ||
            mimeType.includes('presentation')) return 'document';
        if (mimeType.includes('javascript') || 
            mimeType.includes('json') ||
            mimeType.includes('xml') ||
            mimeType.includes('html') ||
            mimeType.includes('css')) return 'code';
        if (mimeType.includes('zip') || 
            mimeType.includes('rar') ||
            mimeType.includes('tar')) return 'archive';
        return 'other';
    }
}

module.exports = new S3Service();