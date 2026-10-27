import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

@Injectable()
export class StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicUrl: string;

  constructor(config: ConfigService) {
    this.bucket = config.getOrThrow<string>('S3_BUCKET_NAME');
    this.publicUrl = config
      .getOrThrow<string>('S3_PUBLIC_URL')
      .replace(/\/+$/, '');

    this.client = new S3Client({
      region: config.get<string>('S3_REGION', 'auto'),
      endpoint: config.getOrThrow<string>('S3_ENDPOINT'),
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.getOrThrow<string>('S3_ACCESS_KEY'),
        secretAccessKey: config.getOrThrow<string>('S3_SECRET_KEY'),
      },
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  }

  async upload(params: {
    key: string;
    body: Buffer;
    contentType: string;
    originalName?: string;
  }): Promise<string> {
    const isInline = params.contentType.startsWith('image/');
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: params.key,
        Body: params.body,
        ContentType: params.contentType,
        CacheControl: 'public, max-age=31536000, immutable',
        // Non-images download instead of rendering in the browser (XSS safety)
        ContentDisposition: isInline
          ? 'inline'
          : `attachment; filename*=UTF-8''${encodeURIComponent(params.originalName ?? 'file')}`,
      }),
    );
    return `${this.publicUrl}/${params.key}`;
  }
}
