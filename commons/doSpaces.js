const AWS = require("aws-sdk");

const spacesEndpoint = new AWS.Endpoint("fra1.digitaloceanspaces.com");

const s3 = new AWS.S3({
  endpoint: spacesEndpoint,
  accessKeyId: process.env.DIGITAL_OCEAN_ACCESS_KEY,
  secretAccessKey: process.env.DIGITAL_OCEAN_SECRET_KEY,
});

module.exports = s3;
