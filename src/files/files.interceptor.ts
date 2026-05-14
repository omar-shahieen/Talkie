/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { memoryStorage } from 'multer';
import { extname } from 'path';

import {
  MAX_FILE_SIZE_BYTES,
  ALLOWED_MIME_PREFIXES,
  ALLOWED_MIME_TYPES,
  DANGEROUS_EXTENSIONS,
  MAX_UPLOAD_FILES,
} from '../friends/upload.constant';
import { BadRequestException } from '../common/exceptions/domain.exception';

export const uploadFileInterceptorConfig = {
  storage: memoryStorage(),
  limits: {
    files: MAX_UPLOAD_FILES,
    fileSize: MAX_FILE_SIZE_BYTES,
  },
  fileFilter: (_req: any, file: any, cb: any): void => {
    const original = (file?.originalname as string | undefined) ?? '';
    if (DANGEROUS_EXTENSIONS.has(extname(original).toLowerCase())) {
      cb(
        new BadRequestException(
          `Blocked file extension: ${extname(original).toLowerCase()}`,
          {
            action: 'fileFilter',
            filename: original,
            extension: extname(original).toLowerCase(),
            reason: 'dangerous-extension',
          },
        ),
        false,
      );
      return;
    }

    const mimeType = (file?.mimetype as string | undefined) ?? '';
    const isAllowed =
      ALLOWED_MIME_PREFIXES.some((p) => mimeType.startsWith(p)) ||
      ALLOWED_MIME_TYPES.has(mimeType);

    if (!isAllowed) {
      cb(
        new BadRequestException(`Unsupported file type: ${mimeType}`, {
          action: 'fileFilter',
          filename: original,
          mimeType,
          reason: 'unsupported-mime-type',
        }),
        false,
      );
      return;
    }

    cb(null, true);
  },
};
