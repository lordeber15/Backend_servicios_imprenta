'use strict';

const Redis = require('ioredis');

const redis = new Redis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT) || 6379,
  maxRetriesPerRequest: null, // requerido por BullMQ
  enableReadyCheck:     false,
});

redis.on('error', (err) => {
  console.error('[Redis] Error de conexión:', err.message);
});

redis.on('connect', () => {
  console.log('[Redis] Conectado en', process.env.REDIS_HOST || '127.0.0.1', ':', process.env.REDIS_PORT || 6379);
});

module.exports = redis;
