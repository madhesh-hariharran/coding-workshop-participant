"""
Shared PostgreSQL connection and schema initialization.
"""
import logging
import os

import psycopg2
from psycopg2.extras import RealDictCursor

logger = logging.getLogger()
logger.setLevel(logging.INFO)

PG_CONFIG = (
    f"host={os.getenv('POSTGRES_HOST', 'localhost')} "
    f"port={os.getenv('POSTGRES_PORT', '5432')} "
    f"dbname={os.getenv('POSTGRES_NAME', 'postgres')} "
    f"user={os.getenv('POSTGRES_USER', 'postgres')} "
    f"password={os.getenv('POSTGRES_PASS', 'postgres123')} "
    f"connect_timeout=15"
)


def get_connection():
    return psycopg2.connect(PG_CONFIG, cursor_factory=RealDictCursor)


def init_schema():
    """
    Creates all tables if they don't exist.
    Called on Lambda cold start.
    """
    ddl = """
    CREATE TABLE IF NOT EXISTS users (
        id          SERIAL PRIMARY KEY,
        name        VARCHAR(255) NOT NULL,
        email       VARCHAR(255) NOT NULL UNIQUE,
        password    VARCHAR(255) NOT NULL,
        role        VARCHAR(50) NOT NULL DEFAULT 'viewer'
                    CHECK (role IN ('admin', 'manager', 'contributor', 'viewer')),
        created_at  TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS projects (
        id               SERIAL PRIMARY KEY,
        name             VARCHAR(255) NOT NULL,
        description      TEXT,
        status           VARCHAR(50) NOT NULL DEFAULT 'active'
                         CHECK (status IN ('active', 'at_risk', 'on_hold', 'completed')),
        start_date       DATE,
        end_date         DATE,
        budget_planned   NUMERIC(15,2) DEFAULT 0,
        budget_consumed  NUMERIC(15,2) DEFAULT 0,
        owner_id         INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at       TIMESTAMP DEFAULT NOW(),
        updated_at       TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS deliverables (
        id          SERIAL PRIMARY KEY,
        project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        title       VARCHAR(255) NOT NULL,
        description TEXT,
        status      VARCHAR(50) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'in_progress', 'completed')),
        due_date    DATE,
        assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        depends_on  INTEGER REFERENCES deliverables(id) ON DELETE SET NULL,
        created_at  TIMESTAMP DEFAULT NOW(),
        updated_at  TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS resources (
        id          SERIAL PRIMARY KEY,
        user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
        name        VARCHAR(255) NOT NULL,
        role_title  VARCHAR(255),
        department  VARCHAR(255),
        created_at  TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS allocations (
        id                    SERIAL PRIMARY KEY,
        resource_id           INTEGER NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
        project_id            INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        allocation_percentage INTEGER NOT NULL CHECK (allocation_percentage > 0 AND allocation_percentage <= 100),
        start_date            DATE,
        end_date              DATE,
        created_at            TIMESTAMP DEFAULT NOW(),
        UNIQUE (resource_id, project_id)
    );
    """
    conn = None
    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute(ddl)
        conn.commit()
        logger.info("Schema initialized successfully")
    except Exception as e:
        logger.error("Schema init failed: %s", str(e))
        if conn:
            conn.rollback()
        raise
    finally:
        if conn:
            conn.close()