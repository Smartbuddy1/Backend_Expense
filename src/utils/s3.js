const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function isS3Configured() {
  return !!(process.env.AWS_REGION && process.env.S3_BUCKET_NAME);
}

let s3Client = null;
function getClient() {
  if (!s3Client) {
    s3Client = new S3Client({ region: process.env.AWS_REGION });
  }
  return s3Client;
}

const UPLOADS_ROOT = path.join(__dirname, '..', '..', 'uploads');

// Saves the file to the local disk under uploads/<folder>/, served back out by
// the /uploads static route in index.js. Used automatically whenever S3 isn't
// configured, so receipt uploads work in local dev without AWS — switches over
// to S3 with zero code changes the moment AWS_REGION/S3_BUCKET_NAME are set.
function uploadToLocalDisk(buffer, originalName, folder, baseUrl) {
  const ext = (originalName.split('.').pop() || 'bin').toLowerCase();
  const filename = `${crypto.randomUUID()}.${ext}`;
  const dir = path.join(UPLOADS_ROOT, folder);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, filename), buffer);
  return `${baseUrl}/uploads/${folder}/${filename}`;
}

// Uploads a buffer to S3 under a folder (e.g. "expenses") and returns the public URL.
// Bucket policy restricts objects to being read only via this URL (see docs/06-security.md).
// Falls back to local disk storage (see above) when S3 isn't configured yet, so
// submitting an expense without AWS credentials set up still saves the photo
// somewhere real instead of silently dropping it.
async function uploadToS3(buffer, originalName, contentType, folder, baseUrl) {
  if (!isS3Configured()) {
    return uploadToLocalDisk(buffer, originalName, folder, baseUrl);
  }

  const ext = (originalName.split('.').pop() || 'bin').toLowerCase();
  const key = `${folder}/${crypto.randomUUID()}.${ext}`;

  await getClient().send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }));

  return `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
}

module.exports = { uploadToS3, isS3Configured };
