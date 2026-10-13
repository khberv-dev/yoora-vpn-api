import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AppModule } from '../app.module.js';
import { WireguardSettings } from './wireguard.settings.js';
import { WireguardCli } from './wireguard.cli.js';

describe('WireGuard HTTP API', () => {
  let app: INestApplication;
  let directory: string;
  const apiKey = 'test-secret-'.repeat(4);
  const publicKey = Buffer.alloc(32, 1).toString('base64');
  const peers = new Map<string, string[]>();
  const cli = {
    peers: vi.fn(async () => peers),
    addPeer: vi.fn(async (key: string, ip: string) => {
      peers.set(key, [`${ip}/32`]);
    }),
    save: vi.fn(async () => undefined),
  };

  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), 'yoora-http-'));
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(WireguardSettings)
      .useValue({
        interface: 'wg0',
        stateFile: join(directory, 'state.json'),
        apiKey,
      })
      .overrideProvider(WireguardCli)
      .useValue(cli)
      .compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterAll(async () => {
    await app?.close();
    await rm(directory, { recursive: true, force: true });
  });

  it('keeps the health endpoint available', async () => {
    await request(app.getHttpServer()).get('/').expect(200, { ok: true });
  });
  it('requires authentication for allocation and joining', async () => {
    for (const path of ['ip-allocations', 'clients', 'join']) {
      await request(app.getHttpServer())
        .post(`/wireguard/${path}`)
        .send({ publicKey })
        .expect(401);
    }
    expect(cli.addPeer).not.toHaveBeenCalled();
  });
  it('validates the request body', async () => {
    await request(app.getHttpServer())
      .post('/wireguard/join')
      .set('x-api-key', apiKey)
      .send({ publicKey: 'invalid' })
      .expect(400);
  });
  it('allocates, adds the client, and accepts repeat joins', async () => {
    const allocated = await request(app.getHttpServer())
      .post('/wireguard/ip-allocations')
      .set('x-api-key', apiKey)
      .send({ publicKey })
      .expect(201);
    expect(allocated.body.ip).toBe('10.0.0.2');
    expect(allocated.body.status).toBe('reserved');
    for (const path of ['clients', 'join']) {
      const joined = await request(app.getHttpServer())
        .post(`/wireguard/${path}`)
        .set('x-api-key', apiKey)
        .send({ publicKey })
        .expect(201);
      expect(joined.body.address).toBe('10.0.0.2/32');
      expect(joined.body.status).toBe('active');
    }
    expect(cli.addPeer).toHaveBeenCalledTimes(1);
  });
});
