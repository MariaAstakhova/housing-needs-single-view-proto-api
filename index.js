require('dotenv').config();
const express = require('express');
const app = express();
const host = '0.0.0.0';
const port = process.env.PORT || 3000;
const QueryHandler = require('./lib/QueryHandler');
const { Systems } = require('./lib/Constants');
const cors = require('cors');

app.use(cors());
app.use(express.json());

app.get('/customers', async (req, res) => {
  const results = await QueryHandler.searchCustomers(req.query);
  res.send(results);
});

app.post('/customers', async (req, res) => {
  // Save the selected customer records
  const id = await QueryHandler.saveCustomer(req.body);
  res.redirect(`/customers/${id}`);
});

app.get('/customers/:id', async (req, res) => {
  const result = await QueryHandler.fetchCustomer(req.params.id);
  res.send({ customer: result });
});

app.get('/customers/:id/notes', async (req, res) => {
  const results = await QueryHandler.fetchCustomerNotes(req.params.id);
  res.send(results);
});

app.get('/customers/:id/documents', async (req, res) => {
  const results = await QueryHandler.fetchCustomerDocuments(req.params.id);
  res.send(results);
});

app.listen(port, host, () => console.log(`Listening on ${host}:${port}!`));
