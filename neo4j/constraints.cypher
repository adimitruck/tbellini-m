CREATE CONSTRAINT archive_entity_key IF NOT EXISTS FOR (entity:ArchiveEntity) REQUIRE entity.key IS UNIQUE;
