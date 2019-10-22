require("dotenv").config();
const express = require("express");
const app = express();
const port = 3010;
const QueryHandler = require("./lib/QueryHandler");
const { Systems } = require("./lib/Constants");
const cors = require("cors");

app.use(cors());
app.use(express.json());

// maybe put this in a route so front end can get systems from api
function extractSystems(incoming) {
  let systems = [
    Systems.SINGLEVIEW,
    Systems.UHT_CONTACTS,
    Systems.UHT_HOUSING_REGISTER,
    Systems.UHW,
    Systems.JIGSAW,
    Systems.ACADEMY
  ];
  if (incoming.query.systems) {
    systems = incoming.query.systems.split(",");
  }
  return systems;
}

app.get("/systems", async (req, res) => {
  res.json([
    Systems.SINGLEVIEW,
    Systems.UHT_CONTACTS,
    Systems.UHT_HOUSING_REGISTER,
    Systems.UHW,
    Systems.JIGSAW,
    Systems.ACADEMY
  ]);
});

app.get("/customers", async (req, res) => {
  // Select which systems we want to query
  const systems = extractSystems(req);
  const results = await QueryHandler.searchCustomers(req.query, systems);
  res.send(results);
});

app.post("/customers", async (req, res) => {
  // Save the selected customer records
  const id = await QueryHandler.saveCustomer(req.body);
  res.redirect(`/customers/${id}`);
});

app.get("/customers/:id", async (req, res) => {
  const systems = extractSystems(req);
  const result = await QueryHandler.fetchCustomer(req.params.id, systems);
  res.send({ customer: result });
});

app.get("/customers/:id/notes", async (req, res) => {
  const systems = extractSystems(req);
  const results = await QueryHandler.fetchCustomerNotes(req.params.id, systems);
  res.send(results);
});

app.get("/customers/:id/documents", async (req, res) => {
  const systems = extractSystems(req);
  const results = await QueryHandler.fetchCustomerDocuments(
    req.params.id,
    systems
  );
  res.send(results);
});

app.listen(port, () => console.log(`Listening on port ${port}!`));
