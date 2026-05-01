require("dotenv").config();

const fs = require("fs/promises");
const path = require("path");
const axios = require("axios");

async function run() {
  const inputPath = process.argv[2] || path.join("test-data", "real-input.json");
  const baseUrl = process.env.TEST_API_BASE_URL || "http://localhost:3000";

  const raw = await fs.readFile(inputPath, "utf-8");
  const payload = JSON.parse(raw);

  if (!payload.job_description || !payload.resume_text) {
    throw new Error("Input JSON must contain non-empty job_description and resume_text.");
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputPath = path.join("outputs", `resume-${timestamp}.pdf`);

  const scriptKey = process.env.SCRIPT_API_KEY;
  const headers = { "Content-Type": "application/json" };
  if (scriptKey) {
    headers["x-api-key"] = scriptKey;
  }

  const response = await axios.post(`${baseUrl}/generate-resume?format=pdf`, payload, {
    responseType: "arraybuffer",
    timeout: 180000,
    headers,
    validateStatus: () => true,
  });

  if (response.status === 401) {
    throw new Error(
      "Authentication required. For scripts, set the same SCRIPT_API_KEY in your .env as the server, or use the app in the browser after signing up.",
    );
  }

  if (response.status !== 200) {
    let errorText = `Request failed with status ${response.status}`;
    try {
      const parsed = JSON.parse(Buffer.from(response.data).toString("utf-8"));
      if (parsed.error) {
        errorText = `${errorText}: ${parsed.error}`;
      }
    } catch (_error) {
      // Ignore parse errors; keep default message.
    }
    throw new Error(errorText);
  }

  await fs.writeFile(outputPath, Buffer.from(response.data));

  console.log(`PDF generated: ${outputPath}`);
}

run().catch((error) => {
  console.error(`Test failed: ${error.message}`);
  process.exit(1);
});
