import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

type PublicObjectInput = {
  key: string;
  body: Buffer;
  contentType: string;
};

type StoredPublicObject = {
  url: string;
  key: string;
  provider: "s3" | "vercel_blob";
};

function s3Config() {
  const endpoint = process.env.S3_ENDPOINT?.trim();
  const accessKeyId = process.env.S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY?.trim();
  const bucket = process.env.S3_BUCKET?.trim();
  const publicUrl = process.env.S3_PUBLIC_URL?.trim().replace(/\/$/, "");

  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket || !publicUrl) return null;
  return {
    endpoint,
    accessKeyId,
    secretAccessKey,
    bucket,
    publicUrl,
    region: process.env.S3_REGION?.trim() || "ru-1",
  };
}

function publicObjectUrl(baseUrl: string, key: string) {
  return `${baseUrl}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

/**
 * Stores a public file in the configured Russian S3-compatible storage.
 * Vercel Blob remains as a fallback while the production migration is in progress.
 */
export async function putPublicObject(input: PublicObjectInput): Promise<StoredPublicObject | null> {
  const config = s3Config();
  if (config) {
    const client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== "false",
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
    await client.send(new PutObjectCommand({
      Bucket: config.bucket,
      Key: input.key,
      Body: input.body,
      ContentType: input.contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }));
    return {
      url: publicObjectUrl(config.publicUrl, input.key),
      key: input.key,
      provider: "s3",
    };
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
  const { put } = await import("@vercel/blob");
  const blob = await put(input.key, input.body, {
    access: "public",
    contentType: input.contentType,
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });
  return { url: blob.url, key: blob.pathname, provider: "vercel_blob" };
}
