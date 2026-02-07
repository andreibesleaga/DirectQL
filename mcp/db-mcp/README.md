# MindsDB Integration (db-mcp)

This service runs **MindsDB**, allowing you to federate data from multiple sources and query them via SQL or the MCP protocol.

## Access
- **GUI**: [http://localhost:47334](http://localhost:47334)
- **MCP Endpoint**: `http://localhost:47334/mcp/sse`
- **MySQL Port**: 47335
10: 
11: ## Deployment
12: 
13: ### Railway / Cloud
14: This service includes a startup script that automatically detects the `PORT` environment variable provided by platforms like Railway.
15: - If `PORT` is set, MindsDB will listen on that port.
16: - If `PORT` is not set, it defaults to `47334`.

## Configuration Examples

You can connect various data sources using the `CREATE DATABASE` SQL command in the MindsDB GUI or via API.

### PostgreSQL
```sql
CREATE DATABASE my_postgres
WITH ENGINE = 'postgres',
PARAMETERS = {
    "user": "postgres",
    "password": "password",
    "host": "host.docker.internal", -- or 'db' if on the same docker network
    "port": "5432",
    "database": "postgres"
};
```

### MySQL
```sql
CREATE DATABASE my_mysql
WITH ENGINE = 'mysql',
PARAMETERS = {
    "user": "root",
    "password": "password",
    "host": "host.docker.internal",
    "port": "3306",
    "database": "mysql"
};
```

### MongoDB
```sql
CREATE DATABASE my_mongo
WITH ENGINE = 'mongodb',
PARAMETERS = {
    "host": "mongodb+srv://user:pass@cluster.mongodb.net/test"
};
```

### Redis
```sql
CREATE DATABASE my_redis
WITH ENGINE = 'redis',
PARAMETERS = {
    "host": "host.docker.internal",
    "port": "6379",
    "password": "password"
};
```

### Google Sheets
```sql
CREATE DATABASE my_sheet
WITH ENGINE = 'google_sheets',
PARAMETERS = {
    "spreadsheet_id": "1234567890abcdef",
    "sheet_name": "Sheet1"
};
```

## Useful Commands

**List Databases:**
```sql
SHOW DATABASES;
```

**Query Data:**
```sql
SELECT * FROM my_postgres.users LIMIT 10;
```

**Join Data:**
```sql
SELECT u.name, o.amount 
FROM my_postgres.users u
JOIN my_mongo.orders o ON u.id = o.user_id;
```


---

*Note: for `host.docker.internal` to work, ensure the target service is reachable from the `db-mcp` container network.*

