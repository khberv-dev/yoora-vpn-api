import { BadRequestException } from '@nestjs/common';
import { mkdirSync } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { diskStorage } from 'multer';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface.js';
import { MessageType } from '../enum/message-type.enum.js';
import { UPLOADS_ROOT } from '../../../shared/config/upload.config.js';

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

const CHAT_FILE_PATH_RE = new RegExp(
  `^${CHAT_FOLDER}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(\\.[a-z0-9]+)?$`,
);

export const isChatFilePath = (path: string) => CHAT_FILE_PATH_RE.test(path);

export const toChatFilePath = (filename: string) =>
  `${CHAT_FOLDER}/${filename}`;

export async function removeUploadedFile(file?: Express.Multer.File) {
  if (file) await unlink(file.path).catch(() => undefined);
}
