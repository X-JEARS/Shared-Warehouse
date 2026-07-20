import fs from 'fs';
import path from 'path';

const ITEM_IMAGE_PATH_PATTERN = /^\/images\/[a-zA-Z0-9_-]+\.(jpg|png|gif|webp)$/;

export const isValidItemImagePath = (imagePath: unknown): imagePath is string => (
  typeof imagePath === 'string' && ITEM_IMAGE_PATH_PATTERN.test(imagePath)
);

export const resolveItemImagePath = (publicDir: string, imagePath: unknown): string | null => {
  if (!isValidItemImagePath(imagePath)) return null;

  const resolvedPublicDir = path.resolve(publicDir);
  const resolvedPath = path.resolve(resolvedPublicDir, imagePath.slice(1));
  return resolvedPath.startsWith(resolvedPublicDir + path.sep) ? resolvedPath : null;
};

export const deleteItemImageFile = (publicDir: string, imagePath: unknown): boolean => {
  const resolvedPath = resolveItemImagePath(publicDir, imagePath);
  if (!resolvedPath || !fs.existsSync(resolvedPath)) return false;

  fs.unlinkSync(resolvedPath);
  return true;
};
