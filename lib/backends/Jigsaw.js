var request = require('request-promise');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const strftime = require('strftime');
const { Systems } = require('../Constants');
const { checkString, nameCase, formatAddress } = require('../Utils');

let jigsawEnv = process.env.ENV || 'training';
let jigsawLoginEnv = {
  training: 'training',
  production: 'live'
}[jigsawEnv];

const loginUrl = `https://${jigsawLoginEnv}.housingjigsaw.co.uk/auth/login`;
const searchUrl = `https://zebracustomers${jigsawEnv}.azurewebsites.net/api/customerSearch`;
const caseUrl = `https://zebrahomelessness${jigsawEnv}.azurewebsites.net/api/casecheck/`;
const notesUrl = id =>
  `https://zebracustomers${jigsawEnv}.azurewebsites.net/api/Customer/${id}/Notes`;
const docsUrl = `https://zebrahomelessness${jigsawEnv}.azurewebsites.net/api/cases/getcasedocs/`;

let bearerToken = null;
let lastLogin = null;

const getCSRFTokens = async function() {
  const httpResponse = await request.get({
    url: loginUrl,
    resolveWithFullResponse: true
  });

  const cookies = httpResponse.headers['set-cookie'].map(
    cookie => cookie.split(';')[0]
  );

  const dom = new JSDOM(httpResponse.body);
  const token = dom.window.document.querySelector(
    'input[name=__RequestVerificationToken]'
  ).value;

  return {
    cookies,
    token
  };
};

const login = async function() {
  if (bearerToken && lastLogin && lastLogin > new Date() - 3600) {
    return bearerToken;
  } else {
    let tokens = await getCSRFTokens();
    // make auth request to Jigsaw
    let authCredentials = {
      Email: process.env.Jigsaw_email,
      Password: process.env.Jigsaw_password,
      __RequestVerificationToken: tokens.token
    };

    const httpResponse = await request.post({
      url: loginUrl,
      form: authCredentials,
      headers: {
        Cookie: tokens.cookies.join('; ')
      },
      resolveWithFullResponse: true,
      simple: false
    });

    let matched = httpResponse.headers.location.match(/accesstoken=([^&]*)/);
    if (matched) {
      bearerToken = matched[1];
      lastLogin = new Date();
      return bearerToken;
    } else {
      throw 'Could not get auth token';
    }
  }
};

let doJigsawGetRequest = async function(url, qs, token) {
  let options = {
    url: url,
    headers: {
      Authorization: `Bearer ${token}`
    },
    resolveWithFullResponse: true
  };

  if (qs) {
    options.qs = qs;
  }

  const httpResponse = await request.get(options);
  return JSON.parse(httpResponse.body);
};

let doJigsawPostRequest = async function(url, data, token) {
  let options = {
    url: url,
    json: data,
    headers: {
      Authorization: `Bearer ${token}`
    },
    resolveWithFullResponse: true
  };

  const httpResponse = await request.post(options);
  return httpResponse.body;
};

let runSearchQuery = async function(query, token) {
  query.firstName = query.firstName || '';
  query.lastName = query.lastName || '';

  let qs = {
    search: `${query.firstName} ${query.lastName}`.trim()
  };

  return await doJigsawGetRequest(searchUrl, qs, token);
};

let fetchCaseDetails = async function(id, token) {
  return await doJigsawGetRequest(caseUrl + id, null, token);
};

let fetchCustomerNotes = async function(id, token) {
  return await doJigsawGetRequest(notesUrl(id), null, token);
};

let fetchCustomerDocuments = async function(id, token) {
  let result = await fetchCaseDetails(id, token);
  let caseId = result.cases.filter(x => x.isCurrent)[0].id;
  return await doJigsawPostRequest(docsUrl + caseId, {}, token);
};

let processSearchResults = function(results) {
  if (results.length == 1 && results[0].id == 0) {
    return [];
  } else {
    return results.map(record => {
      return {
        id: record.id.toString(),
        firstName: record.firstName,
        lastName: record.lastName,
        dob: strftime('%d/%m/%Y', new Date(Date.parse(record.doB))),
        nino: record.niNumber,
        address: formatAddress(record.adddress),
        source: Systems.JIGSAW
      };
    });
  }
};

let processCustomer = function(id, result) {
  let customer = {
    systemIds: {
      jigsaw: [id]
    },
    housingNeeds: {}
  };
  if (result.cases && result.cases.length > 0) {
    for (const caseId in result.cases) {
      if (result.cases[caseId].isCurrent) {
        customer.housingNeeds.jigsawCaseId = result.cases[caseId].id.toString();
        customer.housingNeeds.status = result.cases[caseId].statusName;
      }
    }
  } else {
    customer.housingNeeds.status = 'No homelessness case';
  }
  return customer;
};

let processNotesResults = function(results) {
  return results.map(note => {
    return {
      title: 'Note',
      text: note.content,
      date: new Date(note.interviewDate),
      user: note.officerName,
      system: Systems.JIGSAW
    };
  });
};

let processDocumentsResults = function(results) {
  return results
    .map(r => {
      return r.caseDocuments.map(doc => {
        return {
          title: 'Document',
          text: doc.name,
          date: doc.date,
          user: doc.casePersonName,
          system: Systems.JIGSAW
        };
      });
    })
    .flat();
};

let Backend = {
  customerSearch: async function(query) {
    try {
      const token = await login();
      const results = await runSearchQuery(query, token);
      return processSearchResults(results);
    } catch (err) {
      console.log(`Error searching customers in Jigsaw: ${err}`);
    }
  },

  fetchCustomer: async function(id) {
    try {
      const token = await login();
      const result = await fetchCaseDetails(id, token);
      return processCustomer(id, result);
    } catch (err) {
      console.log(`Error fetching customers in Jigsaw: ${err}`);
    }
  },

  fetchCustomerNotes: async function(id) {
    try {
      const token = await login();
      const result = await fetchCustomerNotes(id, token);
      return processNotesResults(result);
    } catch (err) {
      console.log(`Error fetching customer notes in Jigsaw: ${err}`);
    }
  },

  fetchCustomerDocuments: async function(id) {
    try {
      const token = await login();
      const result = await fetchCustomerDocuments(id, token);
      return processDocumentsResults(result);
    } catch (err) {
      `Error fetching customer documents in Jigsaw: ${err}`;
    }
  }
};

module.exports = Backend;
