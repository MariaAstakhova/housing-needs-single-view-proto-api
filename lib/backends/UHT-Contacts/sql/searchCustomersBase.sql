SELECT
  member.house_ref,
  member.person_no,
  member.forename,
  member.surname,
  member.dob,
  member.ni_no,
  contacts.con_address as address,
  contacts.con_postcode as postcode,
  contacts.con_key
FROM
	member
JOIN househ AS househ
  ON member.house_ref = househ.house_ref
JOIN contacts AS contacts
  ON contacts.con_ref = househ.house_ref