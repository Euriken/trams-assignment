import { pool } from '../db/connection.js';
import { createLogger } from '@microservices/shared';
import type { User, CreateUserDto, UpdateUserDto } from '@microservices/shared';

const logger = createLogger('user-service:repository');

export class UserRepository {
  async create(dto: CreateUserDto): Promise<User> {
    const { rows } = await pool.query<User>(
      'INSERT INTO users (email, name) VALUES ($1, $2) RETURNING *',
      [dto.email, dto.name]
    );
    logger.info({ userId: rows[0].id }, 'User created in database');
    return rows[0];
  }

  async findById(id: string): Promise<User | null> {
    const { rows } = await pool.query<User>(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );
    return rows[0] || null;
  }

  async findAll(limit = 50, offset = 0): Promise<{ users: User[]; total: number }> {
    const countResult = await pool.query<{ count: string }>('SELECT COUNT(*) FROM users');
    const total = parseInt(countResult.rows[0].count, 10);

    const { rows } = await pool.query<User>(
      'SELECT * FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );

    return { users: rows, total };
  }

  async update(id: string, dto: UpdateUserDto): Promise<User | null> {
    const fields: string[] = [];
    const values: (string | undefined)[] = [];
    let paramIndex = 1;

    if (dto.email !== undefined) {
      fields.push(`email = $${paramIndex++}`);
      values.push(dto.email);
    }
    if (dto.name !== undefined) {
      fields.push(`name = $${paramIndex++}`);
      values.push(dto.name);
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const query = `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
    const { rows } = await pool.query<User>(query, values);

    if (rows[0]) {
      logger.info({ userId: rows[0].id }, 'User updated in database');
    }
    return rows[0] || null;
  }

  async delete(id: string): Promise<boolean> {
    const { rowCount } = await pool.query('DELETE FROM users WHERE id = $1', [id]);
    const deleted = (rowCount ?? 0) > 0;
    if (deleted) {
      logger.info({ userId: id }, 'User deleted from database');
    }
    return deleted;
  }

  async existsByEmail(email: string, excludeId?: string): Promise<boolean> {
    let query = 'SELECT 1 FROM users WHERE email = $1';
    const params: string[] = [email];

    if (excludeId) {
      query += ' AND id != $2';
      params.push(excludeId);
    }

    const { rows } = await pool.query(query, params);
    return rows.length > 0;
  }
}
