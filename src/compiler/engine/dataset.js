/**
 * Mock Database Datasets for Live Execution Engine
 * Principles of Compiler Design - Query Execution Subsystem
 */

export function generateDatabase() {
  const departments = [
    { id: 1, dept_name: 'Engineering', budget: 1500000, location: 'San Francisco' },
    { id: 2, dept_name: 'Product Design', budget: 600000, location: 'New York' },
    { id: 3, dept_name: 'Data Science & AI', budget: 1200000, location: 'Seattle' },
    { id: 4, dept_name: 'Marketing', budget: 400000, location: 'Chicago' },
    { id: 5, dept_name: 'Sales', budget: 800000, location: 'Austin' },
    { id: 6, dept_name: 'Customer Support', budget: 300000, location: 'Denver' },
    { id: 7, dept_name: 'Human Resources', budget: 250000, location: 'Boston' },
    { id: 8, dept_name: 'Finance & Legal', budget: 500000, location: 'New York' },
    { id: 9, dept_name: 'Infrastructure & Ops', budget: 950000, location: 'San Francisco' },
    { id: 10, dept_name: 'Security & Compliance', budget: 700000, location: 'Washington' }
  ];

  const firstNames = ['Alice', 'Bob', 'Charlie', 'Diana', 'Evan', 'Fiona', 'George', 'Hannah', 'Ian', 'Julia', 'Kevin', 'Laura', 'Michael', 'Nora', 'Oscar', 'Paula', 'Quinn', 'Rachel', 'Sam', 'Tina'];
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Miller', 'Davis', 'Wilson', 'Anderson', 'Taylor', 'Thomas', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'White', 'Harris', 'Clark', 'Lewis'];
  const statuses = ['active', 'active', 'active', 'active', 'on_leave', 'terminated'];

  const employees = [];
  const salaries = [];

  for (let i = 1; i <= 500; i++) {
    const fn = firstNames[(i * 7) % firstNames.length];
    const ln = lastNames[(i * 13) % lastNames.length];
    const deptId = (i % 10) + 1;
    const baseSalary = 40000 + (i * 230) % 110000;
    const age = 22 + (i % 40);
    const status = statuses[i % statuses.length];
    const year = 2015 + (i % 9);
    const hireDate = `${year}-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`;

    employees.push({
      id: i,
      name: `${fn} ${ln}`,
      dept_id: deptId,
      salary: baseSalary,
      age: age,
      status: status,
      hire_date: hireDate
    });

    // Generate 3 years of salary records per employee
    for (let yr = 2022; yr <= 2024; yr++) {
      salaries.push({
        emp_id: i,
        amount: baseSalary + (yr - 2022) * 5000,
        year: yr,
        bonus: (i % 5 === 0) ? (baseSalary * 0.1) : 0
      });
    }
  }

  const projects = [];
  const projectPrefixes = ['Apollo', 'Nebula', 'Quantum', 'Titan', 'Vanguard', 'Genesis', 'Horizon', 'Phoenix'];
  for (let i = 1; i <= 40; i++) {
    const pName = `${projectPrefixes[i % projectPrefixes.length]} ${100 + i}`;
    const deptId = (i % 10) + 1;
    const budget = 50000 + (i * 12000);
    projects.push({
      id: i,
      project_name: pName,
      dept_id: deptId,
      budget: budget
    });
  }

  const cities = ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio', 'San Diego', 'Dallas', 'San Jose'];
  const customers = [];
  for (let i = 1; i <= 300; i++) {
    const fn = firstNames[(i * 3) % firstNames.length];
    const ln = lastNames[(i * 11) % lastNames.length];
    customers.push({
      id: i,
      name: `${fn} ${ln}`,
      city: cities[i % cities.length],
      rating: (i % 5) + 1
    });
  }

  const orderStatuses = ['PENDING', 'COMPLETED', 'SHIPPED', 'CANCELLED'];
  const orders = [];
  for (let i = 1; i <= 1000; i++) {
    const custId = (i % 300) + 1;
    const total = 25 + (i * 17) % 4500;
    const st = orderStatuses[i % orderStatuses.length];
    const yr = 2023 + (i % 2);
    const orderDate = `${yr}-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`;
    orders.push({
      id: i,
      customer_id: custId,
      total: total,
      status: st,
      order_date: orderDate
    });
  }

  return {
    employees,
    departments,
    salaries,
    projects,
    customers,
    orders
  };
}
