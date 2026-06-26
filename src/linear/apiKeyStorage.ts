import * as vscode from "vscode";
import { LINEAR_API_KEY_SECRET } from "../config";

export async function getStoredApiKey(
  secrets: vscode.SecretStorage
): Promise<string | undefined> {
  return secrets.get(LINEAR_API_KEY_SECRET);
}

export async function storeApiKey(
  secrets: vscode.SecretStorage,
  apiKey: string
): Promise<void> {
  await secrets.store(LINEAR_API_KEY_SECRET, apiKey.trim());
}

export async function clearApiKey(
  secrets: vscode.SecretStorage
): Promise<void> {
  await secrets.delete(LINEAR_API_KEY_SECRET);
}
