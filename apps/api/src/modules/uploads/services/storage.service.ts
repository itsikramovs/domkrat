import { randomUUID } from 'node:crypto';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client as MinioClient } from 'minio';

/**
 * MinIO-обёртка. Два endpoint:
 *  - internalClient — для сервер-сайд операций (bucket create / removeObject), быстрый по 127.0.0.1
 *  - publicClient — для presignedUrl, который пойдёт клиенту в браузер (host 192.168.1.8 / домен)
 *
 * В prod publicEndpoint должен указывать на domkrat-cdn.* или Cloudflare Tunnel.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private internalClient!: MinioClient;
  private publicClient!: MinioClient;
  private bucket!: string;
  private publicEndpoint!: string;
  private port!: number;
  private useSSL!: boolean;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    this.bucket = this.config.get<string>('MINIO_BUCKET', 'domkrat-uploads');
    this.publicEndpoint = this.config.get<string>('MINIO_PUBLIC_ENDPOINT', '192.168.1.8');
    this.port = Number(this.config.get<string>('MINIO_PORT', '9000'));
    this.useSSL = this.config.get<string>('MINIO_USE_SSL', 'false') === 'true';
    const accessKey = this.config.get<string>('MINIO_ACCESS_KEY')!;
    const secretKey = this.config.get<string>('MINIO_SECRET_KEY')!;
    const internalEndpoint = this.config.get<string>('MINIO_INTERNAL_ENDPOINT', 'localhost');
    // Внутренний клиент ходит к MinIO напрямую (127.0.0.1:9000, без TLS), а публичный —
    // через Cloudflare (cdn.<domain>:443, TLS). Поэтому порт/SSL у них разные. Если
    // MINIO_INTERNAL_PORT/SSL не заданы — fallback на публичные значения (dev single-host).
    const internalPort = Number(
      this.config.get<string>('MINIO_INTERNAL_PORT') ??
        this.config.get<string>('MINIO_PORT', '9000'),
    );
    const internalUseSSL =
      (this.config.get<string>('MINIO_INTERNAL_USE_SSL') ??
        this.config.get<string>('MINIO_USE_SSL', 'false')) === 'true';

    this.internalClient = new MinioClient({
      endPoint: internalEndpoint,
      port: internalPort,
      useSSL: internalUseSSL,
      accessKey,
      secretKey,
    });
    this.publicClient = new MinioClient({
      endPoint: this.publicEndpoint,
      port: this.port,
      useSSL: this.useSSL,
      accessKey,
      secretKey,
    });

    await this.ensureBucket();
  }

  private async ensureBucket(): Promise<void> {
    try {
      const exists = await this.internalClient.bucketExists(this.bucket);
      if (!exists) {
        await this.internalClient.makeBucket(this.bucket, 'us-east-1');
        this.logger.log(`Created bucket ${this.bucket}`);
      }
      // Публичная политика для product/* и banner/* — readable всем (картинки витрины)
      const policy = {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: { AWS: ['*'] },
            Action: ['s3:GetObject'],
            Resource: [
              `arn:aws:s3:::${this.bucket}/product/*`,
              `arn:aws:s3:::${this.bucket}/banner/*`,
            ],
          },
        ],
      };
      await this.internalClient.setBucketPolicy(this.bucket, JSON.stringify(policy));
    } catch (error) {
      this.logger.error(`Bucket init failed: ${(error as Error).message}`);
    }
  }

  /**
   * Генерирует presigned PUT-URL для загрузки.
   * Возвращает { uploadUrl, objectKey, publicUrl } — клиент PUT-ит на uploadUrl, затем
   * вызывает /merchant/products/:id/images с objectKey и publicUrl.
   */
  async presignProductImage(params: {
    productId: string;
    contentType: string;
    extension: string;
  }): Promise<{ uploadUrl: string; objectKey: string; publicUrl: string }> {
    const ext = params.extension.replace(/^\.+/, '').toLowerCase();
    const objectKey = `product/${params.productId}/${randomUUID()}.${ext}`;
    const uploadUrl = await this.publicClient.presignedPutObject(this.bucket, objectKey, 60 * 10);
    return {
      uploadUrl,
      objectKey,
      publicUrl: this.buildPublicUrl(objectKey),
    };
  }

  /** Presigned PUT-URL для загрузки изображения баннера (objectKey banner/<uuid>.<ext>). */
  async presignBannerImage(params: {
    contentType: string;
    extension: string;
  }): Promise<{ uploadUrl: string; objectKey: string; publicUrl: string }> {
    const ext = params.extension.replace(/^\.+/, '').toLowerCase();
    const objectKey = `banner/${randomUUID()}.${ext}`;
    const uploadUrl = await this.publicClient.presignedPutObject(this.bucket, objectKey, 60 * 10);
    return {
      uploadUrl,
      objectKey,
      publicUrl: this.buildPublicUrl(objectKey),
    };
  }

  buildPublicUrl(objectKey: string): string {
    const scheme = this.useSSL ? 'https' : 'http';
    return `${scheme}://${this.publicEndpoint}:${this.port}/${this.bucket}/${objectKey}`;
  }

  async removeObject(objectKey: string): Promise<void> {
    await this.internalClient.removeObject(this.bucket, objectKey);
  }

  /**
   * Извлекает objectKey из публичного URL (для удаления).
   * Возвращает null, если URL не указывает на наш bucket.
   */
  extractObjectKey(publicUrl: string): string | null {
    const prefix = `${this.useSSL ? 'https' : 'http'}://${this.publicEndpoint}:${this.port}/${this.bucket}/`;
    if (!publicUrl.startsWith(prefix)) return null;
    return publicUrl.slice(prefix.length);
  }
}
