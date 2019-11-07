var request = require('request-promise');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const { Systems } = require('../Constants');
const {
  nameCase,
  formatAddress,
  formatDisplayDate,
  formatRecordDate
} = require('../Utils');
const merge = require('@brikcss/merge');
const moment = require('moment');

let jigsawEnv = process.env.ENV || 'training';
let jigsawLoginEnv = {
  training: 'training',
  production: 'live'
}[jigsawEnv];

const loginUrl = `https://${jigsawLoginEnv}.housingjigsaw.co.uk/auth/login`;
const searchUrl = `https://zebracustomers${jigsawEnv}.azurewebsites.net/api/customerSearch`;
const caseUrl = `https://zebrahomelessness${jigsawEnv}.azurewebsites.net/api/casecheck/`;
const accomPlacementsUrl = caseId =>
  `https://zebraaccommodation${jigsawEnv}.azurewebsites.net/api/CaseAccommodationPlacement?caseId=${caseId}`;
const customerUrl = id =>
  `https://zebracustomers${jigsawEnv}.azurewebsites.net/api/CustomerOverview/${id}`;
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

let fetchCases = async function(id, token) {
  return await doJigsawGetRequest(caseUrl + id, null, token);
};

let fetchAccomPlacements = async function(caseId, token) {
  return await doJigsawGetRequest(accomPlacementsUrl(caseId), null, token);
};

let fetchCustomer = async function(id, token) {
  return await doJigsawGetRequest(customerUrl(id), null, token);
};

let fetchCustomerNotes = async function(id, token) {
  return await doJigsawGetRequest(notesUrl(id), null, token);
};

let fetchCustomerDocuments = async function(id, token) {
  let result = await fetchCases(id, token);
  let caseId = result.cases.filter(x => x.isCurrent)[0].id;
  return await doJigsawPostRequest(docsUrl + caseId, {}, token);
};

let processSearchResults = function(results) {
  if (results.length == 1 && results[0].id == 0) {
    return [];
  } else {
    results = results.reduce((acc, curr) => {
      if (acc.filter(x => x.id === curr.id).length === 0) {
        acc.push(curr);
      }
      return acc;
    }, []);

    return results.map(record => {
      return {
        id: record.id.toString(),
        firstName: nameCase(record.firstName),
        lastName: nameCase(record.lastName),
        dob: formatDisplayDate(record.doB),
        nino: record.niNumber,
        address: formatAddress(record.address).join(','),
        source: Systems.JIGSAW
      };
    });
  }
};

const processCases = function(id, result) {
  let customer = {
    systemIds: {
      jigsaw: [id]
    },
    housingNeeds: {}
  };
  if (result.cases && result.cases.filter(c => c.isCurrent).length > 0) {
    const curr = result.cases.filter(c => c.isCurrent)[0];
    customer.housingNeeds.jigsawCaseId = curr.id.toString();
    customer.housingNeeds.status = curr.statusName;
  } else {
    customer.housingNeeds.status = 'No homelessness case';
  }
  return customer;
};

const processAccomPlacements = function(result) {
  let customer = {
    housingNeeds: {}
  };

  if (result.isCurrentlyInPlacement) {
    const curr = result.placements.filter(
      p => p.endDate === null || moment(p.endDate).isAfter()
    )[0];

    customer.housingNeeds.currentPlacement = {};

    customer.housingNeeds.currentPlacement.address = curr.address;
    customer.housingNeeds.currentPlacement.duty = curr.placementDuty;
    customer.housingNeeds.currentPlacement.type = curr.placementType;
    customer.housingNeeds.currentPlacement.rentCostCustomer =
      curr.rentCostCustomer;
    customer.housingNeeds.currentPlacement.tenancyId = curr.tenancyId;

    if (curr.startDate !== null) {
      customer.housingNeeds.currentPlacement.startDate = formatRecordDate(
        curr.startDate
      );
    }

    if (curr.endDate !== null) {
      customer.housingNeeds.currentPlacement.endDate = formatRecordDate(
        curr.endDate
      );
    }
  }

  return customer;
};

const processCustomer = function(result) {
  const info = result.personInfo;

  let customer = {
    team: {}
  };

  customer.address = [
    {
      source: [Systems.JIGSAW],
      address: formatAddress(info.addressString)
    }
  ];
  customer.dob = [formatRecordDate(info.dateOfBirth)];
  customer.email = [info.emailAddress];
  customer.phone = [info.homePhoneNumber, info.mobilePhoneNumber];
  customer.nhsNumber = info.nhsNumber;
  customer.nino = [info.nationalInsuranceNumber];

  if (result.personInfo.supportWorker !== null) {
    customer.team.name = nameCase(info.supportWorker.fullName);
    customer.team.jobTitle = info.supportWorker.jobTitle;
    customer.team.agency = info.supportWorker.agency;
    customer.team.phone = info.supportWorker.phoneNumber;
    customer.team.email = info.supportWorker.emailAddress;
  }

  return customer;
};

let processNotesResults = function(results) {
  return results.map(note => {
    return {
      title: 'Note',
      text: note.content,
      date: formatRecordDate(note.interviewDate),
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
          date: formatRecordDate(doc.date),
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

      const caseDetails = processCases(id, await fetchCases(id, token));

      let accomPlacements = {};
      if (caseDetails.housingNeeds.jigsawCaseId) {
        accomPlacements = processAccomPlacements(
          await fetchAccomPlacements(
            caseDetails.housingNeeds.jigsawCaseId,
            token
          )
        );
      }

      const customerDetails = processCustomer(await fetchCustomer(id, token));

      const customer = merge(
        ...[caseDetails, accomPlacements, customerDetails]
      );

      return customer;
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
