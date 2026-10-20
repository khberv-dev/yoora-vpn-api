import { Controller, Get, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { STATUS_CODES } from 'node:http';
import { FileService } from '../services/file.service.js';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import { User } from '../../user/entity/user.entity.js';
import {
  PUBLIC_PREFIX,
  UPLOADS_ROOT,
} from '../../../shared/config/upload.config.js';

@Controller(PUBLIC_PREFIX)
export class FileController {
  constructor(private readonly fileService: FileService) {}

  @Get('*path')
  async getFile(
    @CurrentUser() user: User,
    @Param('path') path: string | string[],
    @Res() res: Response,
  ) {
    const filePath = await this.fileService.resolve(
      user.id,
      Array.isArray(path) ? path.join('/') : path,
    );

    res.sendFile(
      filePath,
      { root: UPLOADS_ROOT, dotfiles: 'deny' },
      (error?: Error & { status?: number }) => {
        if (!error || res.headersSent) return;
        const statusCode = error.status ?? 404;
        res
          .status(statusCode)
          .json({ message: STATUS_CODES[statusCode], statusCode });
      },
    );
  }
}
