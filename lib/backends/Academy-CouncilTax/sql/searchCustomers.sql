SELECT
	ctaccount.account_ref,
	ctaccount.account_cd,
	ctaccount.lead_liab_title,
	ctaccount.lead_liab_forename,
	ctaccount.lead_liab_surname,
	ctproperty.addr1,
	ctproperty.addr2,
	ctproperty.addr3,
	ctproperty.addr4,
	ctproperty.postcode,
	(
		SELECT
			TOP 1 claim_id
		FROM
			hbctaxclaim
		WHERE
			ctax_ref = CONCAT(CAST(ctaccount.account_ref AS NVARCHAR), CAST(ctaccount.account_cd AS NVARCHAR))
		ORDER BY
			ctax_claim_id DESC) AS hb_claim_id
	FROM
		ctaccount
	LEFT JOIN ctoccupation ON ctaccount.account_ref = ctoccupation.account_ref
	LEFT JOIN ctproperty ON ctproperty.property_ref = ctoccupation.property_ref
WHERE
	ctoccupation.vacation_date IN(
		SELECT
			MAX(vacation_date)
			FROM ctoccupation
		WHERE
			ctoccupation.account_ref = ctaccount.account_ref)
	AND lead_liab_name LIKE @full_name
