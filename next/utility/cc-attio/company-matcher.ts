import { attioClient } from "./attio-client";

export interface CompanyMatchResult {
  companyName: string;
  recordId: string | null;
  matchedVia: "name" | "domain" | null;
  matchedDomain?: string;
}

function extractDomainsFromEmails(emails: string[]): string[] {
  const domains = new Set<string>();

  for (const email of emails) {
    if (email.includes("@")) {
      const domain = email.split("@")[1].toLowerCase().trim();
      if (domain) {
        domains.add(domain);
      }
    }
  }

  return Array.from(domains);
}

export async function matchCompaniesToAttio(
  companyNames: string[],
  participantEmails: string[],
): Promise<CompanyMatchResult[]> {
  const results: CompanyMatchResult[] = [];

  console.log(
    `Starting company matching for ${companyNames.length} companies`,
  );

  for (const companyName of companyNames) {
    console.log(`\nAttempting to match company: ${companyName}`);

    // Strategy 1: Try name-based matching
    const nameMatchId = await attioClient.findCompanyByName(companyName);

    if (nameMatchId) {
      console.log(`Found company by name: ${companyName} (${nameMatchId})`);
      results.push({
        companyName,
        recordId: nameMatchId,
        matchedVia: "name",
      });
      continue;
    }

    // Strategy 2: Try domain-based matching
    console.log(`Name match failed, trying domain matching for: ${companyName}`);
    const domains = extractDomainsFromEmails(participantEmails);
    console.log(`Extracted domains from participants: ${domains.join(", ")}`);

    let domainMatchFound = false;

    for (const domain of domains) {
      const domainMatchId = await attioClient.findCompanyByDomain(domain);

      if (domainMatchId) {
        console.log(
          `Found company by domain: ${companyName} matched to ${domain} (${domainMatchId})`,
        );
        results.push({
          companyName,
          recordId: domainMatchId,
          matchedVia: "domain",
          matchedDomain: domain,
        });
        domainMatchFound = true;
        break;
      }
    }

    if (!domainMatchFound) {
      console.log(`No match found for company: ${companyName}`);
      results.push({
        companyName,
        recordId: null,
        matchedVia: null,
      });
    }
  }

  return results;
}