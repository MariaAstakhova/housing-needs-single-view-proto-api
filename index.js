const express = require('express')
const app = express()
const port = 3010
const QueryHandler = require('./lib/QueryHandler');
const cors = require('cors');

app.use(cors());
app.use(express.json());

app.get('/customers', (req, res) => {
  // Select which systems we want to query
  let systems = ['SingleView', 'UHT', 'Jigsaw', 'Academy']
  if(req.query.systems){
    systems = req.query.systems.split(',');
  }
  
  QueryHandler.searchCustomers(req.query, systems, (results) => {
    res.send(results)
  });
})

app.post('/customers', (req, res) => {
  // Save the selected customer records
  QueryHandler.saveCustomer(req.body, (results) => {
    res.send(results)
  });
})

app.get('/customers/:id', (req, res) => {

})

app.get('/customers/:id/notes', (req, res) => {

})

app.get('/customers/:id/documents', (req, res) => {

})

app.listen(port, () => console.log(`Listening on port ${port}!`))