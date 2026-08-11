#!/bin/bash
set -e

# Create the users database
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
    CREATE DATABASE ${USERS_DB_NAME:-users_db};
    CREATE DATABASE ${NOTIFICATIONS_DB_NAME:-notifications_db};
EOSQL

echo "Databases created successfully: ${USERS_DB_NAME:-users_db}, ${NOTIFICATIONS_DB_NAME:-notifications_db}"
