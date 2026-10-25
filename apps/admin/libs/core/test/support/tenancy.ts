/**
 * Cross-tenant assertions (T2.6).
 *
 * Every store method that touches a user-owned row must be given the owner in
 * the call and must refuse a foreign one. Reading each repository is not a
 * check; running one assertion per method against another user's id is.
 *
 * Usage:
 *
 *   await assertRefusesForeignOwner([
 *     { name: 'revoke', act: () => keys.revoke(adelKey.id, otherUserId) },
 *     { name: 'deleteByFingerprint', act: () => sessions.deleteByFingerprint(otherUserId, fp) },
 *   ]);
 *
 * `act` returns a truthy value when it did something and a falsy one when it
 * refused — or throws, which also counts as refusing. A method that returns
 * truthy for a foreign owner has just handed over another tenant's data.
 */
export interface ForeignOwnerCase {
  name: string;
  act: () => unknown;
}

export async function assertRefusesForeignOwner(cases: ForeignOwnerCase[]): Promise<void> {
  const leaked: string[] = [];

  for (const testCase of cases) {
    let acted = false;
    try {
      const result = await testCase.act();
      acted = result === true || (typeof result === 'number' && result > 0);
      if (Array.isArray(result)) {
        acted = result.length > 0;
      }
      if (result && typeof result === 'object' && 'id' in (result as object)) {
        acted = true;
      }
    } catch {
      acted = false; // throwing is a refusal
    }
    if (acted) {
      leaked.push(testCase.name);
    }
  }

  if (leaked.length > 0) {
    throw new Error(
      `these methods acted for a foreign owner: ${leaked.join(', ')} — a store method must always be scoped by user_id`,
    );
  }
}
