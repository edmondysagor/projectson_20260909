import { Router } from 'express';
import multer from 'multer';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import path from 'path';
import crypto from 'crypto';

const router = Router();

// Configure multer to store file in memory
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// Configure S3 Client for Cloudflare R2
const s3Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

router.post('/', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Generate a unique filename
    const ext = path.extname(file.originalname);
    const randomName = crypto.randomBytes(16).toString('hex');
    const filename = `uploads/${randomName}${ext}`;

    // Upload to Cloudflare R2
    const bucketName = process.env.R2_BUCKET_NAME!;
    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: filename,
        Body: file.buffer,
        ContentType: file.mimetype,
      })
    );

    // Construct the public URL safely, handling potential trailing slashes in env var
    const baseUrl = process.env.R2_PUBLIC_URL!.replace(/\/$/, '');
    const publicUrl = `${baseUrl}/${filename}`;

    res.status(200).json({ url: publicUrl });
  } catch (error) {
    console.error('Error uploading file to R2:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

router.delete('/', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'No URL provided' });
    }

    // Extract the filename from the public URL robustly
    const publicUrlPrefix = process.env.R2_PUBLIC_URL!;
    if (!url.startsWith(publicUrlPrefix)) {
      return res.status(400).json({ error: 'Invalid URL for this bucket' });
    }

    // Parse the URL and get the pathname, removing the leading slash
    const parsedUrl = new URL(url);
    const key = parsedUrl.pathname.substring(1); // e.g. "uploads/xxx.png"

    const bucketName = process.env.R2_BUCKET_NAME!;
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: bucketName,
        Key: key,
      })
    );

    res.status(200).json({ message: 'File deleted successfully' });
  } catch (error) {
    console.error('Error deleting file from R2:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

export default router;
