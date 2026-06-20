import multer from 'multer';
import { AppError } from '../../common/exceptions/app.exception';
import { HttpStatus } from '@nestjs/common';

export const multerMemoryStorage = multer.memoryStorage();

export const multerFileFilter: multer.Options['fileFilter'] = (
  _req,
  file,
  cb,
) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new AppError(
        'Unsupported file type. Allowed: JPEG, PNG, WEBP, PDF',
        HttpStatus.BAD_REQUEST,
      ) as unknown as null,
      false,
    );
  }
};

export const multerLimits: multer.Options['limits'] = {
  fileSize: parseInt(process.env.MAX_FILE_SIZE_BYTES ?? '5242880', 10),
};
