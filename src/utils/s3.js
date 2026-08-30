const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const crypto = require('crypto');

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

// Uploads a buffer to S3 under a folder (e.g. "expenses") and returns the public URL.
// Bucket policy restricts objects to being read only via this URL (see docs/06-security.md).
// Returns null (instead of throwing) if S3 isn't configured yet, so submitting an
// expense without AWS credentials set up doesn't hard-fail the whole request.
async function uploadToS3(buffer, originalName, contentType, folder) {
  if (!isS3Configured()) {
    console.warn('S3 is not configured (AWS_REGION/S3_BUCKET_NAME missing) — skipping receipt upload.');
    return null;
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
