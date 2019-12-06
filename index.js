require('dotenv').config();
const express = require('express');
const app = express();
const host = '0.0.0.0';
const port = process.env.PORT || 3000;
const QueryHandler = require('./lib/QueryHandler');
const cors = require('cors');

app.use(cors());
app.use(express.json());

if (process.env.ENABLE_CACHING === 'true') {
  console.log('Enabling Cache');
  const ExpressCache = require('express-cache-middleware');
  const cacheManager = require('cache-manager');

  const cacheMiddleware = new ExpressCache(
    cacheManager.caching({
      store: 'memory',
      max: 10000,
      ttl: 3600
    }),
    {
      hydrate: (req, res, data, cb) => {
        res.contentType('application/json');
        cb(null, data);
      }
    }
  );
  cacheMiddleware.attach(app);
}

app.get('/customers', async (req, res) => {
  const q = Object.entries(req.query)
    .map(([k, v]) => {
      return `${k}:${v}`;
    })
    .join(',');
  console.log(`CUSTOMER SEARCH "${q}"`);
  console.time(`CUSTOMER SEARCH "${q}"`);
  try {
    const results = await QueryHandler.searchCustomers(req.query);
    res.send(results);
  } catch (err) {
    console.log(err);
    res.send(500);
  }
  console.timeEnd(`CUSTOMER SEARCH "${q}"`);
});

app.post('/customers', async (req, res) => {
  console.log('SAVING CUSTOMER');
  console.time('SAVING CUSTOMER');
  // Save the selected customer records
  const id = await QueryHandler.saveCustomer(req.body);
  console.timeEnd('SAVING CUSTOMER');
  res.send({
    customer: {
      id: id
    }
  });
});

app.get('/customers/:id', async (req, res) => {
  console.log(`GET CUSTOMER LINKS id="${req.params.id}"`);
  console.time(`GET CUSTOMER LINKS id="${req.params.id}"`);
  const result = await QueryHandler.fetchCustomer(req.params.id);
  console.timeEnd(`GET CUSTOMER LINKS id="${req.params.id}"`);
  res.send({ customer: result });
});

app.delete('/customers/:id', async (req, res) => {
  console.log(`DELETE CUSTOMER id="${req.params.id}"`);
  console.time(`DELETE CUSTOMER id="${req.params.id}"`);
  await QueryHandler.deleteCustomer(req.params.id);
  console.timeEnd(`DELETE CUSTOMER id="${req.params.id}"`);
  res.sendStatus(200);
});

app.get('/customers/:id/record', async (req, res) => {
  console.log(`GET CUSTOMER id="${req.params.id}"`);
  console.time(`GET CUSTOMER id="${req.params.id}"`);
  const result = await QueryHandler.fetchCustomerRecord(req.params.id);
  console.timeEnd(`GET CUSTOMER id="${req.params.id}"`);
  res.send({ customer: result });
});

app.get('/customers/:id/notes', async (req, res) => {
  console.log(`GET CUSTOMER NOTES id="${req.params.id}"`);
  console.time(`GET CUSTOMER NOTES id="${req.params.id}"`);
  const results = await QueryHandler.fetchCustomerNotes(req.params.id);
  console.timeEnd(`GET CUSTOMER NOTES id="${req.params.id}"`);
  res.send(results);
});

app.get('/customers/:id/documents', async (req, res) => {
  console.log(`GET CUSTOMER DOCS id="${req.params.id}"`);
  console.time(`GET CUSTOMER DOCS id="${req.params.id}"`);
  const results = await QueryHandler.fetchCustomerDocuments(req.params.id);
  console.timeEnd(`GET CUSTOMER DOCS id="${req.params.id}"`);
  res.send(results);
});

app.listen(port, host, () => console.log(`Listening on ${host}:${port}!`));
