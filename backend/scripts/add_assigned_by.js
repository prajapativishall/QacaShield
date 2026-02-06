
import 'dotenv/config';
import { sequelize } from '../config/db.js';

async function migrate() {
  try {
    await sequelize.query('ALTER TABLE trips ADD COLUMN assigned_by INTEGER UNSIGNED NULL;');
    console.log('Migration successful');
  } catch (error) {
    if (error.original && error.original.code === 'ER_DUP_FIELDNAME') {
      console.log('Column already exists');
    } else {
      console.error('Migration failed:', error);
    }
  } finally {
    await sequelize.close();
  }
}

migrate();
