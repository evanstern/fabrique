type NamedSession = {
  session_id: string;
  name?: string;
};

export function displaySessionName(session: NamedSession): string {
  const name = session.name?.trim();
  return name && name.length > 0 ? name : session.session_id;
}
