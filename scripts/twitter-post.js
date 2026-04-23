/**
 * Twitter OAuth 1.0a Poster
 * Posts text + image to Twitter directly via API v1.1
 * Credentials from .env: TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_SECRET
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const https = require("https");

// Load .env
const envPath = path.join(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf8")
    .split("\n")
    .forEach((line) => {
      const [key, ...val] = line.split("=");
      if (key && val.length) process.env[key.trim()] = val.join("=").trim();
    });
}

const API_KEY = process.env.TWITTER_API_KEY;
const API_SECRET = process.env.TWITTER_API_SECRET;
const ACCESS_TOKEN = process.env.TWITTER_ACCESS_TOKEN;
const ACCESS_SECRET = process.env.TWITTER_ACCESS_SECRET;

if (!API_KEY || !API_SECRET || !ACCESS_TOKEN || !ACCESS_SECRET) {
  console.error("Missing Twitter credentials in .env");
  process.exit(1);
}

/**
 * Build OAuth 1.0a signature per RFC 5849
 */
function oauthSign(method, url, params, consumerSecret, tokenSecret = "") {
  const sigParams = { ...params, oauth_signature: "" };
  const sorted = Object.keys(sigParams).sort().map(
    (k) => `${encodeURIComponent(k)}=${encodeURIComponent(sigParams[k])}`
  );
  const paramStr = sorted.join("&");
  const sigBase = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(paramStr)}`;
  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;
  return crypto.createHmac("sha1", signingKey).update(sigBase).digest("base64");
}

/**
 * Build Authorization header
 */
function authHeader(method, url, extraParams, consumerKey, consumerSecret, token, tokenSecret) {
  const oauthParams = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: crypto.randomBytes(32).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: token,
    oauth_version: "1.0",
  };
  const allParams = { ...oauthParams, ...extraParams };
  oauthParams.oauth_signature = oauthSign(method, url, allParams, consumerSecret, tokenSecret);

  const authParts = Object.keys(oauthParams)
    .sort()
    .map((k) => `${k}="${encodeURIComponent(oauthParams[k])}"`);
  return `OAuth ${authParts.join(", ")}`;
}

/**
 * Make an HTTPS request with OAuth headers
 */
function request(method, urlPath, postData, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(urlPath.startsWith("http") ? urlPath : `https://api.twitter.com${urlPath}`);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: headers.Authorization,
        "Content-Length": postData ? Buffer.byteLength(postData) : 0,
        ...headers,
      },
    };

    const req = https.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on("error", reject);
    if (postData) req.write(postData);
    req.end();
  });
}

/**
 * Upload media to Twitter and return media_id
 */
async function uploadMedia(imagePath) {
  if (!imagePath || !fs.existsSync(imagePath)) {
    console.log("No image to upload");
    return null;
  }

  const imageData = fs.readFileSync(imagePath);
  const boundary = `----FormBoundary${crypto.randomBytes(16).toString("hex")}`;
  const mediaType = imagePath.endsWith(".png") ? "image/png" : "image/jpeg";

  // Build multipart body
  const bodyParts = [
    `--${boundary}\r\nContent-Disposition: form-data; name="media"; filename="${path.basename(imagePath)}"\r\nContent-Type: ${mediaType}\r\n\r\n`,
  ];
  const bodyPre = Buffer.concat([
    Buffer.from(bodyParts.join("")),
    Buffer.from(imageData),
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);

  return new Promise((resolve, reject) => {
    const options = {
      hostname: "upload.twitter.com",
      path: "/1.1/media/upload.json",
      method: "POST",
      headers: {
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        Authorization: authHeader(
          "POST",
          "https://upload.twitter.com/1.1/media/upload.json",
          {},
          API_KEY,
          API_SECRET,
          ACCESS_TOKEN,
          ACCESS_SECRET
        ),
        "Content-Length": bodyPre.length,
      },
    };

    const req = https.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          const data = JSON.parse(body);
          resolve(data.media_id_string || data.media_id);
        } catch {
          reject(new Error(`Media upload failed: ${body}`));
        }
      });
    });
    req.on("error", reject);
    req.write(bodyPre);
    req.end();
  });
}

/**
 * Post a tweet
 */
async function postTweet(text, mediaId) {
  const params = { status: text };
  if (mediaId) params.media_ids = mediaId;

  const postBody = Object.keys(params)
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
    .join("&");

  const auth = authHeader(
    "POST",
    "https://api.twitter.com/1.1/statuses/update.json",
    {},
    API_KEY,
    API_SECRET,
    ACCESS_TOKEN,
    ACCESS_SECRET
  );

  return request(
    "POST",
    "https://api.twitter.com/1.1/statuses/update.json",
    postBody,
    { Authorization: auth }
  );
}

// Main
async function main() {
  const args = process.argv.slice(2);
  const text = args[0] || "";
  const imagePath = args[1] || null;

  if (!text) {
    console.error("Usage: node twitter-post.js \"tweet text\" [image-path]");
    process.exit(1);
  }

  console.log(` Posting tweet: ${text.substring(0, 50)}...`);

  let mediaId = null;
  if (imagePath) {
    try {
      mediaId = await uploadMedia(imagePath);
      console.log(` Media uploaded: ${mediaId}`);
    } catch (e) {
      console.error(` Media upload warning: ${e.message}`);
    }
  }

  try {
    const result = await postTweet(text, mediaId);
    if (result.status === 200 || result.status === 201) {
      console.log(` Tweet posted successfully!`);
      console.log(` URL: https://twitter.com/i/status/${result.data.id_str}`);
    } else {
      console.error(` Failed: ${JSON.stringify(result.data)}`);
      process.exit(1);
    }
  } catch (e) {
    console.error(` Error: ${e.message}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
