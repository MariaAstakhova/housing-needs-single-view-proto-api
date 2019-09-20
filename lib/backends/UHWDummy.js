let Backend = {
  customerSearch: function(query, cb){
    cb([
      {
        id: "2342321312",
        firstName: "Eileen",
        lastName: "Clough",
        dob: "28/05/1976",
        nino: "DD123988D",
        source: "UHW"
      },
      {
        id: "32232132143",
        firstName: "Eileen",
        lastName: "McClough",
        dob: "18/02/1974",
        nino: "HS109833A",
        source: "UHW"
      }
    ])
  }
}

module.exports = Backend;