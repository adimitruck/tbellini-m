import {
  AGGREGATE, BASE_LABEL, EDGE, EDGE_AGGREGATE, NODE_LABEL, OPERATION, RETIRED_AGGREGATE_REASON, nodeKey,
} from './graph-schema.mjs';

const skipped = (reason) => ({ status: 'skipped', reason });
const projected = { status: 'projected' };

async function projectEdge(driver, database, row, spec) {
  const p = row.payload;
  const params = {
    fromKey: nodeKey(spec.from, p[spec.fromField]), eventKey: nodeKey(AGGREGATE.EVENT, p.event_id), status: p.status ?? null,
  };
  const match = `(a:${BASE_LABEL} {key:$fromKey})-[r:${spec.edge}]->(e:${BASE_LABEL} {key:$eventKey})`;
  if (row.operation === OPERATION.DELETE) {
    await driver.executeQuery(`MATCH ${match} DELETE r`, params, { database });
    return projected;
  }
  const query = `MATCH (a:${BASE_LABEL} {key:$fromKey}), (e:${BASE_LABEL} {key:$eventKey}) `
    + `MERGE (a)-[r:${spec.edge}]->(e) SET r.status=$status RETURN count(r) AS count`;
  const result = await driver.executeQuery(query, params, { database });
  if (result.records[0]?.get('count').toNumber() !== 1) {
    throw new Error('Missing graph endpoint; leave outbox pending and repair projection.');
  }
  return projected;
}

/** Profile-IS-Person: a Person with member_id is the same human as that Profile. Order-independent. */
async function projectIdentity(driver, database, personKey, memberId) {
  await driver.executeQuery(`MATCH (:${BASE_LABEL} {key:$personKey})<-[r:${EDGE.IS}]-(:${BASE_LABEL}) DELETE r`, { personKey }, { database });
  if (!memberId) return;
  const query = `MATCH (person:${BASE_LABEL} {key:$personKey}) `
    + `MERGE (profile:${BASE_LABEL}:${NODE_LABEL[AGGREGATE.PROFILE]} {key:$profileKey}) MERGE (profile)-[:${EDGE.IS}]->(person)`;
  await driver.executeQuery(query, { personKey, profileKey: nodeKey(AGGREGATE.PROFILE, memberId) }, { database });
}

async function projectNode(driver, database, row) {
  const type = row.aggregate_type;
  const key = nodeKey(type, row.aggregate_id);
  if (row.operation === OPERATION.DELETE) {
    await driver.executeQuery(`MATCH (n:${BASE_LABEL} {key:$key}) DETACH DELETE n`, { key }, { database });
    return projected;
  }
  const p = row.payload;
  const query = `MERGE (n:${BASE_LABEL}:${NODE_LABEL[type]} {key:$key}) SET n.id=$id,n.title=$title,n.updatedAt=$updatedAt`;
  await driver.executeQuery(query, { key, id: row.aggregate_id, title: p.title ?? p.display_name ?? null, updatedAt: p.updated_at ?? null }, { database });
  if (type === AGGREGATE.PERSON) await projectIdentity(driver, database, key, p.member_id);
  return projected;
}

/** Project one outbox row. Returns {status:'projected'} or {status:'skipped', reason}; throws only on real failures. */
export async function projectGraphRow(driver, database, row) {
  const type = row.aggregate_type;
  if (Object.hasOwn(RETIRED_AGGREGATE_REASON, type)) return skipped(RETIRED_AGGREGATE_REASON[type]);
  if (Object.hasOwn(EDGE_AGGREGATE, type)) return projectEdge(driver, database, row, EDGE_AGGREGATE[type]);
  if (Object.hasOwn(NODE_LABEL, type)) return projectNode(driver, database, row);
  return skipped(`unknown aggregate type: ${type}`);
}
