CREATE CONSTRAINT archive_entity_key IF NOT EXISTS FOR (entity:ArchiveEntity) REQUIRE entity.key IS UNIQUE;
CREATE INDEX archive_entity_id IF NOT EXISTS FOR (entity:ArchiveEntity) ON (entity.id);
