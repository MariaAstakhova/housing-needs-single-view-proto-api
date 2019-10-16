CREATE TABLE customers (
  id          INTEGER PRIMARY KEY,
  first_name  VARCHAR(30) NOT NULL,
  last_name   VARCHAR(50) NOT NULL,
  address     VARCHAR(200),
  nino        VARCHAR(11), 
  dob         TIMESTAMP,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE systems (
  id INTEGER PRIMARY KEY,
  name VARCHAR(32) NOT NULL, 
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE customer_links (
  id          INTEGER PRIMARY KEY,
  customer_id INTEGER NOT NULL,
  system_id   INTEGER NOT NULL,
  remote_id   VARCHAR(30) NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT customer_links_customer_fkey FOREIGN KEY (customer_id)
    REFERENCES customers (id) MATCH SIMPLE
    ON UPDATE NO ACTION ON DELETE NO ACTION,
  CONSTRAINT customer_links_systems_fkey FOREIGN KEY (system_id)
    REFERENCES systems (id) MATCH SIMPLE
    ON UPDATE NO ACTION ON DELETE NO ACTION
);

INSERT INTO systems (name) VALUES ('UHT-Contacts');
INSERT INTO systems (name) VALUES ('UHT-HousingRegister');
INSERT INTO systems (name) VALUES ('UHW');
INSERT INTO systems (name) VALUES ('JIGSAW');
INSERT INTO systems (name) VALUES ('ACADEMY');
INSERT INTO systems (name) VALUES ('COMINO');
