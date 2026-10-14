import { Request, Response, NextFunction } from 'express';

export const ALLOWED_PROOF_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
] as const;

export type AllowedProofMimeType = typeof ALLOWED_PROOF_MIME_TYPES[number];

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Detects the real MIME type from binary magic bytes to prevent spoofing.
 */
export function detectMimeTypeFromBuffer(buffer: Buffer): string | null {
  if (buffer.length < 4) return null;

  // PDF: %PDF (0x25, 0x50, 0x44, 0x46)
  if (
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  ) {
    return 'application/pdf';
  }

  // PNG: 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }

  // JPEG: 0xFF 0xD8 0xFF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  // WebP: RIFF....WEBP (offset 0: 'RIFF', offset 8: 'WEBP')
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'image/webp';
  }

  return null;
}

export interface ValidatedAttachment {
  filename: string;
  mime_type: string;
  buffer: Buffer;
  size: number;
}

/**
 * Validates file MIME type, magic bytes consistency, and file size.
 */
export function validateProofFile(
  declaredMimeType: string,
  buffer: Buffer,
  filename?: string
): ValidatedAttachment {
  const normalizedMime = declaredMimeType === 'image/jpg' ? 'image/jpeg' : declaredMimeType.toLowerCase().trim();

  if (!ALLOWED_PROOF_MIME_TYPES.includes(normalizedMime as AllowedProofMimeType)) {
    throw new Error(
      `Invalid MIME type '${declaredMimeType}'. Permitted MIME types for milestone proof attachments are: ${ALLOWED_PROOF_MIME_TYPES.join(', ')}.`
    );
  }

  if (buffer.length === 0) {
    throw new Error('Attachment file buffer is empty.');
  }

  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    throw new Error(
      `File size (${(buffer.length / (1024 * 1024)).toFixed(2)} MB) exceeds maximum allowed limit of 10 MB.`
    );
  }

  const detectedMime = detectMimeTypeFromBuffer(buffer);
  if (!detectedMime) {
    throw new Error(
      `MIME verification failed: Unrecognized or corrupted file format. Declared '${declaredMimeType}' does not match file signature.`
    );
  }

  if (detectedMime !== normalizedMime) {
    throw new Error(
      `MIME type spoofing detected: Declared MIME type '${declaredMimeType}' does not match real file signature '${detectedMime}'.`
    );
  }

  const cleanFilename = filename ? filename.replace(/[/\\]/g, '_').trim() : `proof_${Date.now()}`;

  return {
    filename: cleanFilename,
    mime_type: normalizedMime,
    buffer,
    size: buffer.length,
  };
}

/**
 * Express middleware to validate file upload MIME type in request body.
 */
export function validateProofUploadMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    const { attachment, attachments } = req.body;
    const itemsToValidate = attachments || (attachment ? [attachment] : []);

    if (itemsToValidate.length === 0) {
      return next();
    }

    for (const item of itemsToValidate) {
      if (!item.mime_type) {
        res.status(400).json({
          success: false,
          error: 'MIME type is required for each proof attachment.',
        });
        return;
      }

      if (!item.data) {
        res.status(400).json({
          success: false,
          error: 'Base64 file data is required for each proof attachment.',
        });
        return;
      }

      const buffer = Buffer.from(item.data, 'base64');
      const validated = validateProofFile(item.mime_type, buffer, item.filename);
      item.mime_type = validated.mime_type;
      item.size = validated.size;
      item.filename = validated.filename;
    }

    next();
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: err.message || 'File upload MIME type validation failed.',
    });
  }
}
