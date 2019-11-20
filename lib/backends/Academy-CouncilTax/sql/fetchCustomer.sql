WITH ctoccupation_cte (
    account_ref,
    property_ref
  ) AS (
    SELECT TOP 1 account_ref, property_ref FROM ctoccupation WHERE
      ctoccupation.account_ref = @account_ref
    ORDER BY vacation_date DESC
)
SELECT
  ctaccount.account_ref,
  ctaccount.account_cd,
  ctaccount.lead_liab_title,
  ctaccount.lead_liab_forename,
  ctaccount.lead_liab_surname,
  ctaccount.for_addr1,
  ctaccount.for_addr2,
  ctaccount.for_addr3,
  ctaccount.for_addr4,
  ctaccount.for_postcode,
  ctproperty.addr1,
  ctproperty.addr2,
  ctproperty.addr3,
  ctproperty.addr4,
  ctproperty.postcode,
  vw_acc_bal.total AS account_balance,
  ctpaymethod.paymeth_desc AS payment_method,
  (SELECT TOP 1 claim_id FROM hbctaxclaim WHERE
      ctax_ref = CONCAT(CAST(ctaccount.account_ref AS NVARCHAR), CAST(ctaccount.account_cd AS NVARCHAR))
    ORDER BY ctax_claim_id DESC) AS hb_claim_id
  FROM
    ctaccount
    JOIN vw_acc_bal ON vw_acc_bal.account_ref = ctaccount.account_ref
    JOIN ctpaymethod ON ctpaymethod.paymeth_code = ctaccount.paymeth_code
    JOIN ctoccupation_cte ON ctaccount.account_ref = ctoccupation_cte.account_ref
    JOIN ctproperty ON ctproperty.property_ref = ctoccupation_cte.property_ref
  WHERE
    ctpaymethod.paymeth_year = '2019-04-01'
    AND ctaccount.account_ref = @account_ref