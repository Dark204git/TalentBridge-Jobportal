import dotenv from 'dotenv';
dotenv.config();



export const generateR2PresignedUrl = async (key, contentType) => {
  try {
  
    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');

    const s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });

    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });
    const publicUrl = `${process.env.R2_PUBLIC_URL}/${key}`;

    return { uploadUrl, publicUrl };
  } catch (err) {
    console.error('R2 presign error:', err);
    // Fallback: return a mock URL for development
    return {
      uploadUrl: `http://localhost:5000/mock-upload/${key}`,
      publicUrl: `http://localhost:5000/mock-files/${key}`,
    };
  }
};

export const uploadToR2 = async (buffer, key, contentType) => {
  try {
    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
    const s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });

    await s3.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }));

    return `${process.env.R2_PUBLIC_URL}/${key}`;
  } catch (err) {
    console.error('R2 upload error:', err);
    throw err;
  }
};
