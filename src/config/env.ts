import { plainToInstance } from 'class-transformer';
import { IsInt, IsString, IsUrl, Max, Min, validateSync } from 'class-validator';

class Environment {
  @IsString() DATABASE_URL!: string;
  @IsString() JWT_ACCESS_SECRET!: string;
  @IsString() JWT_ACCESS_TTL = '15m';
  @IsInt() @Min(1) @Max(365) REFRESH_TOKEN_TTL_DAYS = 30;
  @IsInt() @Min(4) @Max(15) BCRYPT_ROUNDS = 12;
  @IsUrl({ require_tld: false }) S3_ENDPOINT = 'http://localhost:9000';
  @IsString() S3_REGION = 'us-east-1';
  @IsString() S3_BUCKET = 'gincana-evidences';
  @IsString() S3_ACCESS_KEY!: string;
  @IsString() S3_SECRET_KEY!: string;
  @IsInt() @Min(60) @Max(3600) SIGNED_URL_TTL_SECONDS = 300;
  @IsInt() @Min(1024) UPLOAD_MAX_BYTES = 10_485_760;
  @IsInt() @Min(1) @Max(20) UPLOAD_MAX_FILES = 5;
}

export function validateEnvironment(config: Record<string, unknown>): Record<string, unknown> {
  const numericKeys = [
    'REFRESH_TOKEN_TTL_DAYS',
    'BCRYPT_ROUNDS',
    'SIGNED_URL_TTL_SECONDS',
    'UPLOAD_MAX_BYTES',
    'UPLOAD_MAX_FILES',
  ] as const;
  const normalized = { ...config };
  for (const key of numericKeys) {
    if (normalized[key] !== undefined) normalized[key] = Number(normalized[key]);
  }
  const parsed = plainToInstance(Environment, normalized, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(parsed, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw new Error(`Invalid environment: ${errors.map((error) => error.property).join(', ')}`);
  }
  return normalized;
}
