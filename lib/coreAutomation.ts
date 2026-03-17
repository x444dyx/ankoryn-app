import { updateWorkspaceCore } from "./workspaces";

/*
  Deterministic rule-based extractor.
  No AI calls.
  Designed to work across SaaS, learning,
  school, research, and business workspaces.
*/

export type ExtractedFacts = Record<string, string>;

/* ============================
   Regex Patterns
============================ */

const PRICE_REGEX = /£\s?\d+(\.\d{1,2})?/i;

const PROJECT_NAME_REGEX =
  /(?:project|product|app|tool|platform)\s*(?:name)?\s*(?:is|called)?\s*[:\-]?\s*([A-Z][A-Za-z0-9]+)/i;

const TOPIC_REGEX =
  /(?:topic|subject|research topic)\s*(?:is)?\s*[:\-]?\s*([A-Za-z0-9\s]+)/i;

const GOAL_REGEX =
  /(?:goal|objective|aim)\s*(?:is|:)?\s*([A-Za-z0-9\s]+)/i;

const DEADLINE_REGEX =
  /(?:deadline|due date)\s*(?:is|:)?\s*([A-Za-z0-9\s]+)/i;

/* NEW: business / audience detection */

const TARGET_MARKET_REGEX =
  /(?:target market|target audience)\s*(?:is|:)?\s*([A-Za-z0-9\s]+)/i;

const PRIMARY_USERS_REGEX =
  /(?:primary users|main users|users are)\s*(?:is|:)?\s*([A-Za-z0-9\s]+)/i;

/* ============================
   Extract Facts
============================ */

export function extractStructuredFacts(text: string): {
  facts: ExtractedFacts;
  confidence: number;
} {
  const facts: ExtractedFacts = {};
  let score = 0;

  const priceMatch = text.match(PRICE_REGEX);
  if (priceMatch) {
    facts.pricing = priceMatch[0];
    score += 0.3;
  }

  const projectMatch = text.match(PROJECT_NAME_REGEX);
  if (projectMatch?.[1]) {
    facts.projectName = projectMatch[1];
    score += 0.3;
  }

  const topicMatch = text.match(TOPIC_REGEX);
  if (topicMatch?.[1]) {
    facts.topic = topicMatch[1].trim();
    score += 0.2;
  }

  const goalMatch = text.match(GOAL_REGEX);
  if (goalMatch?.[1]) {
    facts.goal = goalMatch[1].trim();
    score += 0.2;
  }

  const deadlineMatch = text.match(DEADLINE_REGEX);
  if (deadlineMatch?.[1]) {
    facts.deadline = deadlineMatch[1].trim();
    score += 0.2;
  }

  /* NEW EXTRACTIONS */

  const marketMatch = text.match(TARGET_MARKET_REGEX);
  if (marketMatch?.[1]) {
    facts.targetMarket = marketMatch[1].trim();
    score += 0.2;
  }

  const usersMatch = text.match(PRIMARY_USERS_REGEX);
  if (usersMatch?.[1]) {
    facts.primaryUsers = usersMatch[1].trim();
    score += 0.2;
  }

  return {
    facts,
    confidence: score,
  };
}

/*
  Automation Controller
*/

export async function attemptCoreAutoUpdate(
  workspaceId: number,
  userText: string
) {
  const confirmationMode = localStorage.getItem("core_confirm_mode") === "true";

  const { facts, confidence } = extractStructuredFacts(userText);

  if (Object.keys(facts).length === 0) return;

  // Require reasonable signal
  if (confidence < 0.4) return;

  if (confirmationMode) {
    console.log("Core update requires confirmation:", facts);
    return;
  }

  await updateWorkspaceCore(workspaceId, facts);
}