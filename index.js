const express = require('express')
const app = express()
const port = 3010
const QueryHandler = require('./lib/QueryHandler');
const cors = require('cors');

app.use(cors());
app.use(express.json());

function extractSystems(incoming){
  let systems = ['SINGLEVIEW', 'UHT', 'UHW', 'JIGSAW']
  if(incoming.query.systems){
    systems = incoming.query.systems.split(',');
  }
  return systems;
}

app.get('/customers', (req, res) => {
  // Select which systems we want to query
  let systems = extractSystems(req);
  
  QueryHandler.searchCustomers(req.query, systems, (results) => {
    res.send(results)
  });
})

app.post('/customers', (req, res) => {
  // Save the selected customer records
  QueryHandler.saveCustomer(req.body, (id) => {
    res.redirect(`/customers/${id}`);
  });
})

app.get('/customers/:id', (req, res) => {
  let systems = extractSystems(req);
  QueryHandler.fetchCustomer(req.params.id, systems, (resp) => {
    res.send({customer: resp})
  });
})

app.get('/customers/:id/notes', (req, res) => {

})

app.get('/customers/:id/documents', (req, res) => {

})

app.listen(port, () => console.log(`Listening on port ${port}!`))