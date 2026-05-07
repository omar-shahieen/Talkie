export const MAX_UPLOAD_FILES = 10;
export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;
export const ALLOWED_MIME_PREFIXES = ['image/', 'video/'];
export const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/zip',
  'application/x-zip-compressed',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
]);
export const DANGEROUS_EXTENSIONS = new Set([
  '.exe',
  '.js',
  '.mjs',
  '.cjs',
  '.bat',
  '.cmd',
  '.ps1',
  '.sh',
  '.com',
  '.scr',
  '.dll',
  '.msi',
  '.vbs',
  '.jar',
]);
