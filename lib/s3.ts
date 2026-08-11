// S3 / Supabase / Cloudflare R2 Upload Utility
// Para ativar, você precisará adicionar as variáveis de ambiente:
// AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION e S3_BUCKET_NAME

import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
  // Se usar Cloudflare R2 ou Supabase Storage, adicione endpoint:
  // endpoint: process.env.S3_ENDPOINT, 
});

const BUCKET = process.env.S3_BUCKET_NAME || 'meu-cashflow-app';

/**
 * Gera uma URL pré-assinada para que o CLIENTE (navegador/celular)
 * possa fazer upload direto do arquivo em base64/binário para a Nuvem,
 * sem passar pelo nosso servidor Next.js, evitando consumo de RAM e Timeout (Vercel).
 */
export async function getUploadUrl(fileName: string, contentType: string) {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: `uploads/${fileName}`,
    ContentType: contentType,
  });

  // URL expira em 5 minutos
  const url = await getSignedUrl(s3, command, { expiresIn: 300 });
  return { 
    uploadUrl: url,
    fileUrl: `https://${BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/uploads/${fileName}` // ou sua CDN customizada
  };
}
