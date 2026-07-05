/** The two people. Who is "me" is decided by the signed-in account's email. */
export const TANISH_EMAIL = 'tanish.waykole@gmail.com'

export function getNames(email?: string | null): { my: string; friend: string } {
  const isTanish = !email || email.toLowerCase() === TANISH_EMAIL
  return isTanish ? { my: 'Tanish', friend: 'Mukta' } : { my: 'Mukta', friend: 'Tanish' }
}
