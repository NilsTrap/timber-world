export function mayPermanentlyDeletePerson(actorPersonId: string | null, targetPersonId: string): boolean {
  return Boolean(actorPersonId) && actorPersonId !== targetPersonId;
}
