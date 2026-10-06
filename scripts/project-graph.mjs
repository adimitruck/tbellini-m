const TBELLINI = '00000000-0000-4000-8000-000000000001';

/** Replay both legacy private rows and the forward community migration snapshot. */
export async function projectGraphRow(driver, database, row) {
  const p = row.payload;
  const communityId = p.community_id ?? (row.aggregate_type === 'profile' ? TBELLINI : null);
  const privateKey = `${row.owner_id}:${row.aggregate_type}:${row.aggregate_id}`;
  const key = row.aggregate_type === 'event' && communityId ? `${communityId}:event:${row.aggregate_id}` : row.aggregate_type === 'profile' ? `${TBELLINI}:profile:${p.id}` : privateKey;
  const params = { key, ownerId: row.owner_id, communityId };
  if (['attendance', 'user_tag', 'rsvp'].includes(row.aggregate_type)) {
    const privateAttendance = row.aggregate_type === 'attendance';
    params.eventKey = `${communityId ?? row.owner_id}:event:${p.event_id}`;
    params.personKey = privateAttendance ? `${row.owner_id}:person:${p.person_id}` : `${communityId}:profile:${p.user_id}`;
    params.visibility = privateAttendance ? 'private' : 'community';
    params.status = p.status ?? null;
    const relationship = privateAttendance ? 'ATTENDED' : row.aggregate_type === 'user_tag' ? 'TAGGED_IN' : 'RSVP';
    const endpointScope = privateAttendance ? 'ownerId:$ownerId' : 'communityId:$communityId';
    const query = row.operation === 'delete'
      ? `MATCH (p:ArchiveEntity {key:$personKey,${endpointScope}})-[r:${relationship}]->(e:ArchiveEntity {key:$eventKey}) DELETE r`
      : `MATCH (p:ArchiveEntity {key:$personKey,${endpointScope}}), (e:ArchiveEntity {key:$eventKey}) MERGE (p)-[r:${relationship}]->(e) SET r.ownerId=$ownerId,r.communityId=$communityId,r.visibility=$visibility,r.status=$status RETURN count(r) AS count`;
    const result = await driver.executeQuery(query, params, { database });
    if (row.operation !== 'delete' && result.records[0]?.get('count').toNumber() !== 1) throw new Error('Missing graph endpoint; leave outbox pending and repair projection.');
  } else if (row.operation === 'delete') {
    await driver.executeQuery('MATCH (n:ArchiveEntity {key:$key,ownerId:$ownerId}) DETACH DELETE n', params, { database });
  } else {
    const labels = { event: 'Event', person: 'Person', profile: 'Profile' };
    const label = labels[row.aggregate_type];
    if (!label) throw new Error(`Unsupported graph aggregate type: ${row.aggregate_type}`);
    if (row.aggregate_type === 'event' && communityId) {
      // Migration snapshot removes the earlier private event node; private links are requeued afterwards.
      await driver.executeQuery('MATCH (legacy:ArchiveEntity {key:$legacyKey,ownerId:$ownerId}) DETACH DELETE legacy', { ...params, legacyKey: privateKey }, { database });
    }
    await driver.executeQuery(`MERGE (n:ArchiveEntity:${label} {key:$key}) SET n.ownerId=$ownerId,n.communityId=$communityId,n.visibility=$visibility,n.id=$id,n.title=$title,n.updatedAt=$updatedAt`, {
      ...params, visibility: communityId ? 'community' : 'private', id: p.id, title: p.title ?? p.display_name, updatedAt: p.updated_at,
    }, { database });
  }
}
