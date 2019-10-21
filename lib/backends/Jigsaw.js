const request = require("request");
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const strftime = require("strftime");

let loginUrl = "https://training.housingjigsaw.co.uk/auth/login";
let searchUrl =
  "https://zebracustomerstraining.azurewebsites.net/api/customerSearch";
let caseUrl =
  "https://zebrahomelessnesstraining.azurewebsites.net/api/casecheck/";
let notesUrl = id =>
  `https://zebracustomerstraining.azurewebsites.net/api/Customer/${id}/Notes`;
let docsUrl =
  "https://zebrahomelessnesstraining.azurewebsites.net/api/cases/getcasedocs/";

let bearerToken = null;
let lastLogin = null;

let getCSRFTokens = function(cb) {
  request.get(
    {
      url: loginUrl
    },
    function(err, httpResponse, body) {
      let out = {
        cookies: httpResponse.headers["set-cookie"].map(
          cookie => cookie.split(";")[0]
        )
      };

      const dom = new JSDOM(body);
      out.token = dom.window.document.querySelector(
        "input[name=__RequestVerificationToken]"
      ).value;

      cb(out);
    }
  );
};

let login = function(cb) {
  if (bearerToken && lastLogin && lastLogin > new Date() - 3600) {
    cb(null, bearerToken);
  } else {
    getCSRFTokens(function(tokens) {
      // make auth request to Jigsaw
      let authCredentials = {
        Email: process.env.Jigsaw_email,
        Password: process.env.Jigsaw_password,
        __RequestVerificationToken: tokens.token
      };

      request.post(
        {
          url: loginUrl,
          form: authCredentials,
          headers: {
            Cookie: tokens.cookies.join("; ")
          }
        },
        function(err, httpResponse, body) {
          let matched = httpResponse.headers.location.match(
            /accesstoken=([^&]*)/
          );
          if (matched) {
            bearerToken = matched[1];
            lastLogin = new Date();
            cb(null, bearerToken);
          } else {
            cb("Could not get auth token");
          }
        }
      );
    });
  }
};

let doJigsawGetRequest = function(url, qs, token, cb) {
  let options = {
    url: url,
    headers: {
      Authorization: `Bearer ${token}`
    }
  };

  if (qs) {
    options.qs = qs;
  }

  request.get(options, function(err, httpResponse, body) {
    try {
      cb(null, JSON.parse(body));
    } catch (err) {
      cb(err);
    }
  });
};

let doJigsawPostRequest = function(url, body, token, cb) {
  let options = {
    url: url,
    json: body,
    headers: {
      Authorization: `Bearer ${token}`
    }
  };

  request.post(options, function(err, httpResponse, body) {
    try {
      cb(null, body);
    } catch (err) {
      cb(err);
    }
  });
};

let runSearchQuery = function(query, token, cb) {
  query.firstName = query.firstName || "";
  query.lastName = query.lastName || "";

  let qs = {
    search: `${query.firstName} ${query.lastName}`.trim()
  };

  doJigsawGetRequest(searchUrl, qs, token, cb);
};

let fetchCaseDetails = function(id, token, cb) {
  doJigsawGetRequest(caseUrl + id, null, token, cb);
};

let fetchCustomerNotes = function(id, token, cb) {
  doJigsawGetRequest(notesUrl(id), null, token, cb);
};

let fetchCustomerDocuments = function(id, token, cb) {
  fetchCaseDetails(id, token, function(err, result) {
    let caseId = result.cases.filter(x => x.isCurrent)[0].id;
    doJigsawPostRequest(docsUrl + caseId, {}, token, cb);
  });
};

let processResults = function(results) {
  if (results.length == 1 && results[0].id == 0) {
    return [];
  } else {
    return results.map(record => {
      return {
        id: record.id,
        firstName: record.firstName,
        lastName: record.lastName,
        dob: strftime("%d/%m/%Y", new Date(Date.parse(record.doB))),
        nino: record.niNumber,
        address: record.adddress ? record.address.trim() : null,
        source: "JIGSAW"
      };
    });
  }
};

let processCustomer = function(result, customer) {
  let currentCase = false;
  if (result.cases && result.cases.length > 0) {
    for (caseId in result.cases) {
      if (result.cases[caseId].isCurrent) {
        currentCase = true;
        customer.jigsawCaseId = result.cases[caseId].id.toString();
        customer.housingNeedsStatus = result.cases[caseId].statusName;
      }
    }
  } else {
    customer.housingNeedsStatus = "No homelessness case";
  }
};

let processNotesResults = function(results) {
  try {
    return results.map(note => {
      return {
        text: note.content,
        date: new Date(note.interviewDate),
        user: null,
        system: "JIGSAW"
      };
    });
  } catch (e) {
    console.log(e);
  }
};

let processDocumentsResults = function(results) {
  return results
    .map(r => {
      return r.caseDocuments.map(doc => {
        return {
          desc: doc.name,
          date: doc.date,
          user: doc.casePersonName,
          system: "JIGSAW"
        };
      });
    })
    .flat();
};

let Backend = {
  customerSearch: function(query, cb) {
    login((err, token) => {
      runSearchQuery(query, token, function(err, results) {
        cb(processResults(results));
      });
    });
  },

  fetchCustomer: function(id, customer, cb) {
    login((err, token) => {
      fetchCaseDetails(id, token, function(err, result) {
        customer.jigsawId = id;
        processCustomer(result, customer);
        cb();
      });
    });
  },

  fetchCustomerNotes: function(id, cb) {
    login((err, token) => {
      fetchCustomerNotes(id, token, function(err, result) {
        cb(processNotesResults(result));
      });
    });
  },

  fetchCustomerDocuments: function(id, cb) {
    login((err, token) => {
      fetchCustomerDocuments(id, token, function(err, result) {
        cb(processDocumentsResults(result));
      });
    });
  }
};

module.exports = Backend;
