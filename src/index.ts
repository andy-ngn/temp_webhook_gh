import express from "express";
import "dotenv/config";
import { Client as EsClient } from "@elastic/elasticsearch";
import type { Client } from "@elastic/elasticsearch/api/new";
import { Webhooks, createNodeMiddleware } from "@octokit/webhooks";

const app = express();

const ELASTICSEARCH_USERNAME = process.env.ELASTICSEARCH_USERNAME;
const ELASTICSEARCH_EU_AWS_URL = process.env.ELASTICSEARCH_EU_AWS_URL;
const ELASTICSEARCH_EU_AWS_PASSWORD = process.env.ELASTICSEARCH_EU_AWS_PASSWORD;
const GITHUB_WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET;

if (
  !ELASTICSEARCH_EU_AWS_URL ||
  !ELASTICSEARCH_EU_AWS_PASSWORD ||
  !ELASTICSEARCH_USERNAME
) {
  throw new Error(
    "Missing environment variables for Elasticsearch configuration.",
  );
}

if (!GITHUB_WEBHOOK_SECRET) {
  throw new Error("Missing environment variable for GitHub webhook secret.");
}

const webhooks = new Webhooks({
  secret: GITHUB_WEBHOOK_SECRET,
});

// @ts-expect-error - Elasticsearch client typing mismatch
const esClient: Client = new EsClient({
  name: "eu-cluster",
  node: ELASTICSEARCH_EU_AWS_URL,
  auth: {
    username: ELASTICSEARCH_USERNAME,
    password: ELASTICSEARCH_EU_AWS_PASSWORD,
  },
  ssl: {
    rejectUnauthorized: false,
  },
});
webhooks.onAny(async ({ id, name, payload }) => {
  console.log(id, name, "event received");
  try {
    await esClient.index<{
      id: string;
      name: string;
      payload: unknown;
      timestamp: number;
    }>({
      index: "github-webhooks",
      body: {
        id,
        name,
        payload,
        timestamp: Math.floor(Date.now() / 1000),
      },
    });
  } catch (error) {
    console.error("Error indexing webhook event to Elasticsearch:", error);
  }
});

app.use("/api/webhooks", createNodeMiddleware(webhooks));

app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello World!");
});

export default app;
