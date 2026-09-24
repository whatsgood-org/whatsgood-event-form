import { test } from "node:test";
import assert from "node:assert/strict";
import { fitWithin, jpegName, MAX_EDGE, needsReencode, uploadErrorMessage } from "./image.ts";

const MB = 1024 * 1024;

test("ENG-671: a print-size flyer is scaled so its longest edge is MAX_EDGE", () => {
  // 11×17in @ 300dpi — a typical Canva/Photoshop PNG export that Cloudinary rejected.
  assert.deepEqual(fitWithin(3300, 5100), { width: 1553, height: MAX_EDGE });
  // 48 MP iPhone Pro photo, landscape.
  assert.deepEqual(fitWithin(8064, 6048), { width: MAX_EDGE, height: 1800 });
});

test("fitWithin never enlarges", () => {
  assert.deepEqual(fitWithin(800, 600), { width: 800, height: 600 });
  assert.deepEqual(fitWithin(MAX_EDGE, 10), { width: MAX_EDGE, height: 10 });
});

test("ENG-671: a large PNG is always re-encoded, even when its dimensions are in bounds", () => {
  assert.equal(needsReencode("image/png", 14 * MB, 2000, 2000), true);
});

test("oversized dimensions force a re-encode for any raster type", () => {
  assert.equal(needsReencode("image/jpeg", 800 * 1024, 4000, 3000), true);
});

test("a small, in-bounds JPEG or WebP is sent untouched", () => {
  assert.equal(needsReencode("image/jpeg", 900 * 1024, 1200, 1600), false);
  assert.equal(needsReencode("image/webp", 900 * 1024, 1200, 1600), false);
});

test("GIF and SVG are never re-encoded", () => {
  assert.equal(needsReencode("image/gif", 20 * MB, 5000, 5000), false);
  assert.equal(needsReencode("image/svg+xml", 1 * MB, 5000, 5000), false);
});

test("jpegName swaps the extension", () => {
  assert.equal(jpegName("Flyer Final.PNG"), "Flyer Final.jpg");
  assert.equal(jpegName("IMG_1234.HEIC"), "IMG_1234.jpg");
  assert.equal(jpegName("noext"), "noext.jpg");
  assert.equal(jpegName(".png"), "photo.jpg");
});

test("ENG-671: upload errors tell the submitter why, instead of a bare count", () => {
  // Exactly what events-api relays from Cloudinary for an oversized file.
  const cloudinary = "Upload failed: File size too large. Got 14680064. Maximum is 10485760.";
  assert.match(uploadErrorMessage("flyer.png", 502, cloudinary), /too large.*under 10 MB/);
  assert.match(uploadErrorMessage("flyer.png", 413), /too large/);
  assert.match(uploadErrorMessage("x.tiff", 502, "Upload failed: Invalid image file"), /supported image/);
  assert.match(uploadErrorMessage("a.jpg", null), /connection/);
  assert.match(uploadErrorMessage("a.jpg", 500, "boom"), /try again/);
});
