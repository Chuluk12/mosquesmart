import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';

@Injectable()
export class ObjectStorageService {
  private readonly bucket = process.env.S3_BUCKET || 'mosquesmart';
  private readonly enabled = Boolean(process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY);
  private readonly client = this.enabled
    ? new S3Client({
        endpoint: process.env.S3_ENDPOINT || 'https://bucket.gte.co.id',
        region: process.env.S3_REGION || 'us-east-1',
        forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false',
        credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID!, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY! },
      })
    : null;

  isEnabled() { return this.enabled; }

  async put(key: string, body: Buffer, contentType: string) {
    if (!this.client) throw new ServiceUnavailableException('S3 storage is not configured');
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }));
  }

  async get(key: string) {
    if (!this.client) throw new ServiceUnavailableException('S3 storage is not configured');
    return this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async remove(key: string) {
    if (this.client) await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async exists(key: string) {
    if (!this.client) return false;
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch (err) {
      if ((err as { name?: string }).name === 'NotFound' || (err as { name?: string }).name === 'NoSuchKey') return false;
      throw err;
    }
  }
}
