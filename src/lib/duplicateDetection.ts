function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + 1
        );
      }
    }
  }
  return dp[m][n];
}

function similarity(str1: string, str2: string): number {
  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 1.0;
  const distance = levenshteinDistance(str1, str2);
  return 1.0 - distance / maxLen;
}

function normalizeString(str: string): string {
  return str.toLowerCase().trim().replace(/\s+/g, ' ');
}

export function fuzzyMatch(str1: string, str2: string, threshold = 0.85): boolean {
  const norm1 = normalizeString(str1);
  const norm2 = normalizeString(str2);
  return similarity(norm1, norm2) >= threshold;
}

export interface DuplicateContact {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  property_address?: string;
}

export function isDuplicate(
  newContact: Partial<DuplicateContact>,
  existingContact: DuplicateContact
): boolean {
  const emailMatch = newContact.email && existingContact.email &&
    normalizeString(newContact.email) === normalizeString(existingContact.email);

  const phoneMatch = newContact.phone && existingContact.phone &&
    newContact.phone.replace(/\D/g, '') === existingContact.phone.replace(/\D/g, '');

  const firstName = normalizeString(newContact.first_name || '');
  const lastName = normalizeString(newContact.last_name || '');
  const existingFirstName = normalizeString(existingContact.first_name || '');
  const existingLastName = normalizeString(existingContact.last_name || '');

  const nameMatch = (
    firstName && existingFirstName && fuzzyMatch(firstName, existingFirstName) &&
    lastName && existingLastName && fuzzyMatch(lastName, existingLastName)
  );

  if (emailMatch) return true;
  if (phoneMatch) return true;
  if (nameMatch && (emailMatch || phoneMatch)) return true;

  const addressMatch = newContact.property_address && existingContact.property_address &&
    fuzzyMatch(newContact.property_address, existingContact.property_address, 0.9);

  if (addressMatch && nameMatch) return true;

  return false;
}

export async function findDuplicate(
  supabase: any,
  contact: Partial<DuplicateContact>
): Promise<DuplicateContact | null> {
  const { data: existingContacts } = await supabase
    .from('contacts')
    .select('id, first_name, last_name, email, phone, property_address')
    .limit(1000);

  if (!existingContacts) return null;

  for (const existing of existingContacts) {
    if (isDuplicate(contact, existing)) {
      return existing;
    }
  }

  return null;
}
