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
  fileFilter: (_req, file, cb) => {
    const original = file?.originalname ?? '';
    if (DANGEROUS_EXTENSIONS.has(extname(original).toLowerCase())) {
      cb(
        new BadRequestException(
          `Blocked file extension: ${extname(original).toLowerCase()}`,
        ),
        false,
      );
      return;
    }

    const isAllowed =
      ALLOWED_MIME_PREFIXES.some((p) => file.mimetype.startsWith(p)) ||
      ALLOWED_MIME_TYPES.has(file.mimetype);

    if (!isAllowed) {
      cb(
        new BadRequestException(`Unsupported file type: ${file.mimetype}`),
        false,
      );
      return;
    }

    cb(null, true);
  },
};
