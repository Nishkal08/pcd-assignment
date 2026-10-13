/**
 * Database Catalog & Schema Metadata & Table Statistics
 * Principles of Compiler Design - Symbol Table & Catalog Subsystem
 */

export const DATABASE_CATALOG = {
  tables: {
    employees: {
      name: 'employees',
      primaryKey: 'id',
      columns: {
        id: { type: 'INTEGER', nullable: false, isPrimary: true },
        name: { type: 'VARCHAR', nullable: false },
        dept_id: { type: 'INTEGER', nullable: true, foreignKey: 'departments.id' },
        salary: { type: 'FLOAT', nullable: false },
        age: { type: 'INTEGER', nullable: false },
        status: { type: 'VARCHAR', nullable: false },
        hire_date: { type: 'DATE', nullable: false }
      },
      indexes: [
        { name: 'idx_emp_id', columns: ['id'], unique: true, type: 'BTREE' },
        { name: 'idx_emp_dept', columns: ['dept_id'], unique: false, type: 'BTREE' },
        { name: 'idx_emp_salary', columns: ['salary'], unique: false, type: 'BTREE' }
      ],
      statistics: {
        rowCount: 500,
        pageCount: 25,
        avgRowSize: 64, // bytes
        columns: {
          id: { distinctValues: 500, min: 1, max: 500, nullCount: 0 },
          name: { distinctValues: 450, nullCount: 0 },
          dept_id: { distinctValues: 10, min: 1, max: 10, nullCount: 15 },
          salary: { distinctValues: 300, min: 30000, max: 150000, nullCount: 0 },
          age: { distinctValues: 40, min: 21, max: 62, nullCount: 0 },
          status: { distinctValues: 3, values: ['active', 'on_leave', 'terminated'], nullCount: 0 },
          hire_date: { distinctValues: 400, nullCount: 0 }
        }
      }
    },
    departments: {
      name: 'departments',
      primaryKey: 'id',
      columns: {
        id: { type: 'INTEGER', nullable: false, isPrimary: true },
        dept_name: { type: 'VARCHAR', nullable: false },
        budget: { type: 'FLOAT', nullable: false },
        location: { type: 'VARCHAR', nullable: false }
      },
      indexes: [
        { name: 'idx_dept_id', columns: ['id'], unique: true, type: 'BTREE' },
        { name: 'idx_dept_name', columns: ['dept_name'], unique: true, type: 'BTREE' }
      ],
      statistics: {
        rowCount: 10,
        pageCount: 2,
        avgRowSize: 48,
        columns: {
          id: { distinctValues: 10, min: 1, max: 10, nullCount: 0 },
          dept_name: { distinctValues: 10, nullCount: 0 },
          budget: { distinctValues: 10, min: 50000, max: 2000000, nullCount: 0 },
          location: { distinctValues: 5, nullCount: 0 }
        }
      }
    },
    salaries: {
      name: 'salaries',
      primaryKey: null,
      columns: {
        emp_id: { type: 'INTEGER', nullable: false, foreignKey: 'employees.id' },
        amount: { type: 'FLOAT', nullable: false },
        year: { type: 'INTEGER', nullable: false },
        bonus: { type: 'FLOAT', nullable: true }
      },
      indexes: [
        { name: 'idx_salaries_emp', columns: ['emp_id'], unique: false, type: 'BTREE' },
        { name: 'idx_salaries_year', columns: ['year'], unique: false, type: 'BTREE' }
      ],
      statistics: {
        rowCount: 1500,
        pageCount: 75,
        avgRowSize: 32,
        columns: {
          emp_id: { distinctValues: 500, min: 1, max: 500, nullCount: 0 },
          amount: { distinctValues: 400, min: 30000, max: 180000, nullCount: 0 },
          year: { distinctValues: 4, min: 2021, max: 2024, nullCount: 0 },
          bonus: { distinctValues: 50, min: 0, max: 25000, nullCount: 200 }
        }
      }
    },
    projects: {
      name: 'projects',
      primaryKey: 'id',
      columns: {
        id: { type: 'INTEGER', nullable: false, isPrimary: true },
        project_name: { type: 'VARCHAR', nullable: false },
        dept_id: { type: 'INTEGER', nullable: false, foreignKey: 'departments.id' },
        budget: { type: 'FLOAT', nullable: false }
      },
      indexes: [
        { name: 'idx_proj_id', columns: ['id'], unique: true, type: 'BTREE' },
        { name: 'idx_proj_dept', columns: ['dept_id'], unique: false, type: 'BTREE' }
      ],
      statistics: {
        rowCount: 40,
        pageCount: 4,
        avgRowSize: 40,
        columns: {
          id: { distinctValues: 40, min: 1, max: 40, nullCount: 0 },
          project_name: { distinctValues: 40, nullCount: 0 },
          dept_id: { distinctValues: 10, min: 1, max: 10, nullCount: 0 },
          budget: { distinctValues: 30, min: 10000, max: 500000, nullCount: 0 }
        }
      }
    },
    customers: {
      name: 'customers',
      primaryKey: 'id',
      columns: {
        id: { type: 'INTEGER', nullable: false, isPrimary: true },
        name: { type: 'VARCHAR', nullable: false },
        city: { type: 'VARCHAR', nullable: false },
        rating: { type: 'INTEGER', nullable: false }
      },
      indexes: [
        { name: 'idx_cust_id', columns: ['id'], unique: true, type: 'BTREE' },
        { name: 'idx_cust_city', columns: ['city'], unique: false, type: 'BTREE' }
      ],
      statistics: {
        rowCount: 300,
        pageCount: 15,
        avgRowSize: 50,
        columns: {
          id: { distinctValues: 300, min: 1, max: 300, nullCount: 0 },
          name: { distinctValues: 290, nullCount: 0 },
          city: { distinctValues: 20, nullCount: 0 },
          rating: { distinctValues: 5, min: 1, max: 5, nullCount: 0 }
        }
      }
    },
    orders: {
      name: 'orders',
      primaryKey: 'id',
      columns: {
        id: { type: 'INTEGER', nullable: false, isPrimary: true },
        customer_id: { type: 'INTEGER', nullable: false, foreignKey: 'customers.id' },
        total: { type: 'FLOAT', nullable: false },
        status: { type: 'VARCHAR', nullable: false },
        order_date: { type: 'DATE', nullable: false }
      },
      indexes: [
        { name: 'idx_orders_id', columns: ['id'], unique: true, type: 'BTREE' },
        { name: 'idx_orders_cust', columns: ['customer_id'], unique: false, type: 'BTREE' }
      ],
      statistics: {
        rowCount: 1000,
        pageCount: 50,
        avgRowSize: 45,
        columns: {
          id: { distinctValues: 1000, min: 1, max: 1000, nullCount: 0 },
          customer_id: { distinctValues: 280, min: 1, max: 300, nullCount: 0 },
          total: { distinctValues: 600, min: 10, max: 5000, nullCount: 0 },
          status: { distinctValues: 4, values: ['PENDING', 'COMPLETED', 'SHIPPED', 'CANCELLED'], nullCount: 0 },
          order_date: { distinctValues: 300, nullCount: 0 }
        }
      }
    }
  }
};
