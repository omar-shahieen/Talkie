import { memoryStorage } from 'multer';
import { extname } from 'path';

import {
  MAX_FILE_SIZE_BYTES,
  ALLOWED_MIME_PREFIXES,
  ALLOWED_MIME_TYPES,
  DANGEROUS_EXTENSIONS,
  MAX_UPLOAD_FILES,
} from '../friends/upload.constant';
import { BadRequestException } from 'src/common/exceptions/domain.exception';
                                           
export const uploadFileInterceptorConfig = {
  storage: memoryStorage(),
  limits: {
    files: MAX_UPLOAD_FILES,
    fileSize: MAX_FILE_SIZE_BYTES,
  },
  fileFilter: (_req: any, file: any, cb: any): void => {
    // @ts-ignore - multer file and cb are loosely typed
    const original = (file?.originalname as string | undefined) ?? '';
    if (DANGEROUS_EXTENSIONS.has(extname(original).toLowerCase())) {
      // @ts-ignore - multer cb is loosely typed
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

    // @ts-ignore - multer file.mimetype is loosely typed
    const mimeType = (file?.mimetype as string | undefined) ?? '';
    const isAllowed =
      ALLOWED_MIME_PREFIXES.some((p) => mimeType.startsWith(p)) ||
      ALLOWED_MIME_TYPES.has(mimeType);

    if (!isAllowed) {
      // @ts-ignore - multer cb is loosely typed
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

    // @ts-ignore - multer cb is loosely typed
    cb(null, true);
  },
};
