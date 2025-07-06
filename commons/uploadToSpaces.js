// utils/uploadToSpaces.js
const s3 = require("./doSpaces");
const { v4: uuidv4 } = require("uuid");
const path = require("path");

/**
 * Uploads a file to DigitalOcean Spaces.
 * @param {Buffer} buffer - File buffer
 * @param {string} originalName - Original filename
 * @param {string} folder - Destination folder
 * @param {string} type - 'public-read' or 'private'
 * @returns {string} File URL
 */
async function uploadToSpaces(buffer, originalName, folder, access = "public-read") {
  const fileExt = path.extname(originalName);
  const filename = `${folder}/${path.basename(originalName, fileExt)}-${Date.now()}${fileExt}`;

  await s3
    .putObject({
      Bucket: "as-solutions-storage",
      Key: filename,
      Body: buffer,
      ACL: access, // 'public-read' or 'private'
      ContentType: getMimeType(fileExt),
    })
    .promise();

  return `https://as-solutions-storage.fra1.cdn.digitaloceanspaces.com/${filename}`;
}

function getMimeType(ext) {
  const map = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".pdf": "application/pdf",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".ppt": "application/vnd.ms-powerpoint",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".csv": "text/csv",
    ".txt": "text/plain",
    ".zip": "application/zip",
    ".rar": "application/vnd.rar",
  };
  return map[ext.toLowerCase()] || "application/octet-stream";
}

module.exports = uploadToSpaces;
