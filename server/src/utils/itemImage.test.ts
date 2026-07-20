import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  deleteItemImageFile,
  isValidItemImagePath,
  resolveItemImagePath,
} from './itemImage';

test('resolves an item image URL inside the public directory', () => {
  const publicDir = path.join(path.sep, 'srv', 'warehouse', 'public');

  assert.equal(
    resolveItemImagePath(publicDir, '/images/item_123.webp'),
    path.join(publicDir, 'images', 'item_123.webp')
  );
});

test('rejects traversal, absolute filesystem, and avatar paths', () => {
  assert.equal(isValidItemImagePath('/images/../../etc/passwd'), false);
  assert.equal(isValidItemImagePath('/etc/passwd'), false);
  assert.equal(isValidItemImagePath('/avatars/user.jpg'), false);
  assert.equal(resolveItemImagePath('/srv/public', '../images/item.jpg'), null);
});

test('deletes valid item images without touching files outside images', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'warehouse-image-test-'));
  const publicDir = path.join(tempDir, 'public');
  const imagesDir = path.join(publicDir, 'images');
  const outsideFile = path.join(tempDir, 'outside.jpg');
  const itemFile = path.join(imagesDir, 'item_123.jpg');

  fs.mkdirSync(imagesDir, { recursive: true });
  fs.writeFileSync(itemFile, 'item');
  fs.writeFileSync(outsideFile, 'outside');

  try {
    assert.equal(deleteItemImageFile(publicDir, '/images/item_123.jpg'), true);
    assert.equal(fs.existsSync(itemFile), false);
    assert.equal(deleteItemImageFile(publicDir, '../outside.jpg'), false);
    assert.equal(fs.existsSync(outsideFile), true);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
