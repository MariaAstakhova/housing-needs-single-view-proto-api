SELECT
  member.member_sid,
  member.title,
  member.forename,
  member.surname,
  member.dob,
  member.ni_no,
  member.house_ref,
  contacts.con_address AS address,
  contacts.con_postcode AS postcode,
  contacts.con_key,
  contacts.con_phone1,
  contacts.con_phone2,
  contacts.con_phone3,
  tenagree.tag_ref,
  tenagree.cot as start_date,
  tenagree.eot as end_date,
  tenure.ten_desc as tenure,
  tenagree.cur_bal as current_balance,
  tenagree.rent,
  tenagree.prop_ref as prop_ref,
  addresses.post_preamble,
  addresses.aline1,
  addresses.aline2,
  addresses.aline3,
  addresses.aline4,
  addresses.post_code,
  period.prd_desc as rent_period
FROM
  member
  JOIN househ AS househ ON member.house_ref = househ.house_ref
  JOIN contacts AS contacts ON contacts.con_ref = househ.house_ref
  LEFT JOIN tenagree ON tenagree.house_ref = member.house_ref
  LEFT JOIN period ON tenagree.prd_code = period.prd_code
  LEFT JOIN tenure ON tenure.ten_type = tenagree.tenure
  LEFT JOIN Addresses as addresses ON tenagree.prop_ref = addresses.prop_ref

WHERE  member.house_ref = @house_ref
  AND member.person_no = @person_no