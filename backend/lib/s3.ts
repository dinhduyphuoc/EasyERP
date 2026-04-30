import { randomUUID } from "node:crypto";
import { extname } from "node:path";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { BadRequestError } from "@/common";

const AWS_REGION = process.env.AWS_REGION;
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID ?? process.env.AWS_ACCESS_KEY;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY ?? process.env.AWS_SECRET_KEY;
const AWS_S3_BUCKET = process.env.AWS_S3_BUCKET;

const ensureAwsConfig = () => {
  if (!AWS_REGION || !AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY || !AWS_S3_BUCKET) {
    throw new BadRequestError("AWS S3 configuration is missing");
  }
};

const createS3Client = () => {
  ensureAwsConfig();

  return new S3Client({
    region: AWS_REGION,
    credentials: {
      accessKeyId: AWS_ACCESS_KEY_ID!,
      secretAccessKey: AWS_SECRET_ACCESS_KEY!,
    },
  });
};

const getFileExtension = (fileName: string, mimeType: string) => {
  const extensionFromName = extname(fileName).toLowerCase();

  if (extensionFromName) {
    return extensionFromName;
  }

  if (mimeType === "image/jpeg") {
    return ".jpg";
  }

  if (mimeType === "image/png") {
    return ".png";
  }

  if (mimeType === "image/webp") {
    return ".webp";
  }

  if (mimeType === "image/gif") {
    return ".gif";
  }

  return "";
};

const buildObjectUrl = (key: string) => {
  ensureAwsConfig();
  return `https://${AWS_S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${key}`;
};

const getManagedS3KeyFromUrl = (url: string) => {
  ensureAwsConfig();

  try {
    const parsedUrl = new URL(url);
    const expectedHost = `${AWS_S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com`;

    if (parsedUrl.hostname !== expectedHost) {
      return null;
    }

    const key = parsedUrl.pathname.replace(/^\/+/, "");
    return key.length > 0 ? key : null;
  } catch {
    return null;
  }
};

export const uploadProductImageToS3 = async (input: {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
}) => {
  ensureAwsConfig();

  if (!input.buffer.length) {
    throw new BadRequestError("Uploaded file is empty");
  }

  const extension = getFileExtension(input.fileName, input.mimeType);
  const objectKey = `products/${new Date().toISOString().slice(0, 10)}/${randomUUID()}${extension}`;
  const client = createS3Client();

  await client.send(
    new PutObjectCommand({
      Bucket: AWS_S3_BUCKET,
      Key: objectKey,
      Body: input.buffer,
      ContentType: input.mimeType,
    }),
  );

  return {
    key: objectKey,
    image_url: buildObjectUrl(objectKey),
  };
};

export const getManagedProductImageBufferFromUrl = async (imageUrl: string) => {
  const key = getManagedS3KeyFromUrl(imageUrl);

  if (!key) {
    throw new BadRequestError("image_url must reference a managed product image");
  }

  const client = createS3Client();
  const response = await client.send(
    new GetObjectCommand({
      Bucket: AWS_S3_BUCKET,
      Key: key,
    }),
  );

  if (!response.Body) {
    throw new BadRequestError("Managed product image could not be read");
  }

  const bytes = await response.Body.transformToByteArray();
  return {
    key,
    buffer: Buffer.from(bytes),
    mimeType: response.ContentType ?? "image/png",
  };
};

export const deleteManagedProductImageFromS3 = async (imageUrl: string | null | undefined) => {
  if (!imageUrl) {
    return false;
  }

  const key = getManagedS3KeyFromUrl(imageUrl);

  if (!key) {
    return false;
  }

  const client = createS3Client();
  await client.send(
    new DeleteObjectCommand({
      Bucket: AWS_S3_BUCKET,
      Key: key,
    }),
  );

  return true;
};
