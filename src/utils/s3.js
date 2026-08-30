const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const crypto = require('crypto');

const s3 = new S3Client({ region: process.env.AWS_REGION });

// Uploads a buffer to S3 under a folder (e.g. "expenses") and returns the public URL.
// Bucket policy restricts objects to being read only via this URL (see docs/06-security.md).
async function uploadToS3(buffer, originalName, contentType, folder) {
  const ext = (originalName.split('.').pop() || 'bin').toLowerCase();
  const key = `${folder}/${crypto.randomUUID()}.${ext}`;

  await s3.send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }));

  return `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
}

module.exports = { uploadToS3 };
