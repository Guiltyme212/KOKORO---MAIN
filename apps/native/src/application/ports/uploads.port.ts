export type UploadResponse = {
  audioUrl: string;
  key: string;
  mimeType: string;
};

export type CaptureBlob = {
  uri: string;
  mimeType: string;
};

export interface UploadsPort {
  uploadCapture(blob: CaptureBlob): Promise<UploadResponse>;
}
