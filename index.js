const express = require('express')
const app = express()
const port = 3010
const QueryHandler = require('./lib/QueryHandler');
const cors = require('cors');

app.use(cors())

app.get('/customers', (req, res) => {
  // Select which systems we want to query
  let systems = ['SingleView', 'UHT', 'Jigsaw', 'Academy']
  if(req.query.systems){
    systems = req.query.systems.split(',');
  }
  
  QueryHandler.customerSearch(req.query, systems, (results) => {
    res.send(results)
  });
})

app.listen(port, () => console.log(`Listening on port ${port}!`))