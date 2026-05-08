export interface UploadedFileAttachment {
  url: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface FileUploadResult {
  count: number;
  attachments: UploadedFileAttachment[];
}