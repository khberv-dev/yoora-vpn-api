import { BadRequestException } from '@nestjs/common';
import { mkdirSync } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { diskStorage } from 'multer';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface.js';
import { MessageType } from '../enum/message-type.enum.js';

export const UPLOADS_ROOT = resolve('uploads');
export const CHAT_FOLDER = 'chat';
export const CHAT_FILE_MAX_BYTES = 500 * 1024 * 1024;

const chatDir = join(UPLOADS_ROOT, CHAT_FOLDER);
mkdirSync(chatDir, { recursive: true });

export function messageTypeForMime(mimetype: string): MessageType | null {
  if (mimetype.startsWith('image/')) return MessageType.PHOTO;
  if (mimetype.startsWith('video/')) return MessageType.VIDEO;
  return null;
}

export const chatFileOptions: MulterOptions = {
  storage: diskStorage({
    destination: chatDir,
    filename: (_req, file, cb) =>
      cb(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: CHAT_FILE_MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (messageTypeForMime(file.mimetype)) return cb(null, true);
    cb(
      new BadRequestException('Only photo and video files are allowed'),
      false,
    );
  },
};

export const toChatFilePath = (filename: string) =>
  `${CHAT_FOLDER}/${filename}`;

export const resolveUploadPath = (filePath: string) =>
  join(UPLOADS_ROOT, filePath);

export async function removeUploadedFile(file?: Express.Multer.File) {
  if (file) await unlink(file.path).catch(() => undefined);
}
