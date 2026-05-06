declare module "express-fileupload" {
  import type { RequestHandler } from "express";

  export interface UploadedFile {
    name: string;
    data: Buffer;
    size: number;
    encoding: string;
    tempFilePath: string;
    truncated: boolean;
    mimetype: string;
    md5: string;
    mv: (path: string, callback?: (error: Error) => void) => Promise<void>;
  }

  export interface FileArray {
    [fieldname: string]: UploadedFile | UploadedFile[];
  }

  export interface Options {
    abortOnLimit?: boolean;
    createParentPath?: boolean;
    limits?: {
      fileSize?: number;
    };
    parseNested?: boolean;
    preserveExtension?: boolean | number;
    safeFileNames?: boolean | RegExp;
    tempFileDir?: string;
    uriDecodeFileNames?: boolean;
    useTempFiles?: boolean;
  }

  const fileUpload: (options?: Options) => RequestHandler;
  export default fileUpload;
}

declare namespace Express {
  interface Request {
    files?: import("express-fileupload").FileArray | null;
  }
}
