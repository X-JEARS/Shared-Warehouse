import assert from 'node:assert/strict';
import test from 'node:test';
import { addToCart, checkout, clearCart, getCart } from './cartController';
import { createReservation } from './reservationController';

const databaseModule = require('../config/database') as any;
const accessModule = require('../utils/access') as any;

const createResponse = () => {
  const response: any = {
    statusCode: 200,
    body: undefined,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };
  return response;
};

const createRequest = (userId: number, body: Record<string, unknown> = {}) => ({
  user: { userId },
  body,
  params: {},
}) as any;

test('createReservation locks the item before checking conflicts and inserting', async () => {
  const originalConnect = databaseModule.default.connect;
  const originalHasItemAccess = accessModule.hasItemAccess;
  const queries: string[] = [];
  const client = {
    async query(sql: string) {
      queries.push(sql);
      if (sql.includes('SELECT item_id FROM items')) return { rows: [{ item_id: 41 }] };
      if (sql.includes('SELECT * FROM reservations')) return { rows: [] };
      if (sql.includes('INSERT INTO reservations')) return { rows: [{ reservation_id: 1 }] };
      return { rows: [] };
    },
    release() {},
  };

  databaseModule.default.connect = async () => client;
  accessModule.hasItemAccess = async () => true;

  try {
    const response = createResponse();
    await createReservation(
      createRequest(7, { itemId: 41, startTime: 1000, endTime: 2000, orderId: 9 }),
      response
    );

    assert.equal(response.statusCode, 201);
    const lockIndex = queries.findIndex(sql => sql.includes('SELECT item_id FROM items'));
    const conflictIndex = queries.findIndex(sql => sql.includes('SELECT * FROM reservations'));
    const insertIndex = queries.findIndex(sql => sql.includes('INSERT INTO reservations'));
    assert.ok(lockIndex > queries.indexOf('BEGIN'));
    assert.ok(conflictIndex > lockIndex);
    assert.ok(insertIndex > conflictIndex);
    assert.ok(queries.includes('COMMIT'));
  } finally {
    databaseModule.default.connect = originalConnect;
    accessModule.hasItemAccess = originalHasItemAccess;
  }
});

test('checkout rolls back and restores the cart after a database failure', async () => {
  const userId = 701;
  const originalQuery = databaseModule.query;
  const originalConnect = databaseModule.default.connect;
  const originalHasItemAccess = accessModule.hasItemAccess;
  const originalConsoleError = console.error;
  const queries: string[] = [];

  databaseModule.query = async () => ({
    rows: [{ item_id: 51, item_name: 'Camera', box_belong_room_id: null }],
  });
  databaseModule.default.connect = async () => ({
    async query(sql: string) {
      queries.push(sql);
      if (sql.includes('SELECT item_id FROM items')) return { rows: [{ item_id: 51 }] };
      if (sql.includes('INSERT INTO orders')) throw new Error('database unavailable');
      return { rows: [] };
    },
    release() {},
  });
  accessModule.hasItemAccess = async () => true;
  console.error = () => {};

  try {
    await addToCart(
      createRequest(userId, { itemId: 51, roomId: 2, startTime: 1000, endTime: 2000 }),
      createResponse()
    );

    const checkoutResponse = createResponse();
    await checkout(createRequest(userId), checkoutResponse);
    assert.equal(checkoutResponse.statusCode, 500);
    assert.ok(queries.includes('ROLLBACK'));

    const cartResponse = createResponse();
    await getCart(createRequest(userId), cartResponse);
    assert.equal(cartResponse.body.data.length, 1);
    assert.equal(cartResponse.body.data[0].item_id, 51);
  } finally {
    await clearCart(createRequest(userId), createResponse());
    databaseModule.query = originalQuery;
    databaseModule.default.connect = originalConnect;
    accessModule.hasItemAccess = originalHasItemAccess;
    console.error = originalConsoleError;
  }
});

test('a second checkout cannot claim the same in-memory cart', async () => {
  const userId = 702;
  const originalQuery = databaseModule.query;
  const originalConnect = databaseModule.default.connect;
  const originalHasItemAccess = accessModule.hasItemAccess;

  databaseModule.query = async () => ({
    rows: [{ item_id: 52, item_name: 'Tripod', box_belong_room_id: null }],
  });
  databaseModule.default.connect = async () => ({
    async query(sql: string) {
      if (sql.includes('SELECT item_id FROM items')) return { rows: [{ item_id: 52 }] };
      if (sql.includes('SELECT * FROM reservations')) return { rows: [] };
      if (sql.includes('INSERT INTO orders')) return { rows: [{ order_id: 80 }] };
      if (sql.includes('INSERT INTO reservations')) return { rows: [{ reservation_id: 90 }] };
      return { rows: [] };
    },
    release() {},
  });
  accessModule.hasItemAccess = async () => true;

  try {
    await addToCart(
      createRequest(userId, { itemId: 52, roomId: 2, startTime: 1000, endTime: 2000 }),
      createResponse()
    );

    const firstResponse = createResponse();
    const firstCheckout = checkout(createRequest(userId), firstResponse);
    const secondResponse = createResponse();
    await checkout(createRequest(userId), secondResponse);
    await firstCheckout;

    assert.equal(firstResponse.statusCode, 201);
    assert.equal(secondResponse.statusCode, 400);
    assert.equal(secondResponse.body.message, 'Cart is empty');
  } finally {
    await clearCart(createRequest(userId), createResponse());
    databaseModule.query = originalQuery;
    databaseModule.default.connect = originalConnect;
    accessModule.hasItemAccess = originalHasItemAccess;
  }
});
