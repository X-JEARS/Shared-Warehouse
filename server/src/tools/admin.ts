import { Pool, PoolConfig } from 'pg';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import path from 'path';
import readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';

// Load .env from server root directory
dotenv.config({ path: path.join(__dirname, '../../.env') });

const dbConfig: PoolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'warehouse',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

const pool = new Pool(dbConfig);
pool.on('error', (err) => {
  console.error('\n数据库连接错误:', err.message);
});

const rl = readline.createInterface({ input, output });

function formatDate(ms: number): string {
  return new Date(ms).toLocaleString('zh-CN');
}

function displayUsersTable(rows: any[]): void {
  if (rows.length === 0) {
    console.log('未找到用户');
    return;
  }
  console.log('');
  for (const row of rows) {
    console.log(`  ID: ${row.user_id}  登录名: ${row.user_login_name}  昵称: ${row.user_nickname}  电话: ${row.user_tel || '未设置'}  注册时间: ${formatDate(row.user_create_time)}`);
  }
  console.log(`\n共 ${rows.length} 个用户`);
}

async function prompt(message: string): Promise<string> {
  const answer = await rl.question(message);
  if (answer === undefined) throw new Error('INPUT_CANCELLED');
  return answer.trim();
}

async function confirm(message: string): Promise<boolean> {
  const answer = await rl.question(`${message} (y/n): `);
  return answer.toLowerCase() === 'y';
}

async function searchUsers(): Promise<void> {
  console.log('\n搜索方式:');
  console.log('  1. 按登录名（精确匹配）');
  console.log('  2. 按昵称（模糊匹配）');
  console.log('  3. 按用户ID');
  console.log('  4. 列出所有用户');

  const choice = await prompt('请选择: ');

  switch (choice) {
    case '1': {
      const loginName = await prompt('输入登录名: ');
      if (!loginName) { console.log('登录名不能为空'); return; }
      const result = await pool.query(
        'SELECT user_id, user_login_name, user_nickname, user_tel, user_create_time FROM users WHERE user_login_name = $1',
        [loginName]
      );
      displayUsersTable(result.rows);
      break;
    }
    case '2': {
      const nickname = await prompt('输入昵称关键词: ');
      if (!nickname) { console.log('关键词不能为空'); return; }
      const result = await pool.query(
        'SELECT user_id, user_login_name, user_nickname, user_tel, user_create_time FROM users WHERE user_nickname ILIKE $1 ORDER BY user_id',
        [`%${nickname}%`]
      );
      displayUsersTable(result.rows);
      break;
    }
    case '3': {
      const idStr = await prompt('输入用户ID: ');
      const userId = parseInt(idStr);
      if (isNaN(userId)) { console.log('无效的用户ID'); return; }
      const result = await pool.query(
        'SELECT user_id, user_login_name, user_nickname, user_tel, user_create_time FROM users WHERE user_id = $1',
        [userId]
      );
      displayUsersTable(result.rows);
      break;
    }
    case '4': {
      const result = await pool.query(
        'SELECT user_id, user_login_name, user_nickname, user_tel, user_create_time FROM users ORDER BY user_id LIMIT 100'
      );
      displayUsersTable(result.rows);
      break;
    }
    default:
      console.log('无效选择');
  }
}

async function modifyNickname(): Promise<void> {
  const idStr = await prompt('输入用户ID: ');
  const userId = parseInt(idStr);
  if (isNaN(userId)) { console.log('无效的用户ID'); return; }

  const userResult = await pool.query(
    'SELECT user_id, user_login_name, user_nickname, user_tel, user_create_time FROM users WHERE user_id = $1',
    [userId]
  );
  if (userResult.rows.length === 0) { console.log('用户不存在'); return; }

  const user = userResult.rows[0];
  console.log(`\n当前用户: ID=${user.user_id} 登录名=${user.user_login_name} 昵称="${user.user_nickname}"`);

  const newNickname = await prompt('输入新昵称: ');
  if (!newNickname) { console.log('昵称不能为空'); return; }
  if (newNickname.length > 16) { console.log('昵称不能超过16个字符'); return; }

  const confirmed = await confirm(`确认: 将用户 ${user.user_login_name} 的昵称从 "${user.user_nickname}" 改为 "${newNickname}"?`);
  if (!confirmed) { console.log('已取消'); return; }

  const result = await pool.query(
    'UPDATE users SET user_nickname = $1 WHERE user_id = $2 RETURNING user_id, user_login_name, user_nickname',
    [newNickname, userId]
  );
  console.log(`\n昵称已更新: "${result.rows[0].user_nickname}"`);
}

async function resetPassword(): Promise<void> {
  const idStr = await prompt('输入用户ID: ');
  const userId = parseInt(idStr);
  if (isNaN(userId)) { console.log('无效的用户ID'); return; }

  const userResult = await pool.query(
    'SELECT user_id, user_login_name, user_nickname, user_tel, user_create_time FROM users WHERE user_id = $1',
    [userId]
  );
  if (userResult.rows.length === 0) { console.log('用户不存在'); return; }

  const user = userResult.rows[0];
  console.log(`\n当前用户: ID=${user.user_id} 登录名=${user.user_login_name} 昵称="${user.user_nickname}"`);

  const newPassword = await prompt('输入新密码: ');
  if (!newPassword) { console.log('密码不能为空'); return; }
  if (newPassword.length < 6) { console.log('密码至少6个字符'); return; }

  const confirmed = await confirm(`确认: 重置用户 ${user.user_login_name} 的密码?`);
  if (!confirmed) { console.log('已取消'); return; }

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await pool.query(
    'UPDATE users SET user_password = $1 WHERE user_id = $2',
    [hashedPassword, userId]
  );
  console.log('\n密码已重置');
  console.log(`新密码: ${newPassword}`);
  console.log('请将此密码告知用户，并提醒其尽快修改');
}

async function mainMenu(): Promise<void> {
  while (true) {
    console.log('\n仓库管理系统 - 管理工具');
    console.log('====================');
    console.log('1. 搜索用户');
    console.log('2. 修改昵称');
    console.log('3. 重置密码');
    console.log('4. 退出');

    const choice = await prompt('\n请选择: ');

    switch (choice) {
      case '1':
        await searchUsers();
        break;
      case '2':
        await modifyNickname();
        break;
      case '3':
        await resetPassword();
        break;
      case '4':
        return;
      default:
        console.log('无效选择，请输入 1-4');
    }
  }
}

async function main(): Promise<void> {
  try {
    process.on('SIGINT', async () => {
      console.log('\n正在退出...');
      await pool.end();
      process.exit(0);
    });

    rl.on('close', async () => {
      await pool.end();
      process.exit(0);
    });

    console.log('正在连接数据库...');
    await pool.query('SELECT 1');
    console.log('数据库连接成功');

    await mainMenu();

    await pool.end();
    console.log('已退出管理工具');
    process.exit(0);
  } catch (err: any) {
    if (err.message === 'INPUT_CANCELLED') {
      console.log('\n输入已取消');
      await pool.end();
      process.exit(0);
    }
    console.error('错误:', err.message || err);
    await pool.end();
    process.exit(1);
  }
}

main();